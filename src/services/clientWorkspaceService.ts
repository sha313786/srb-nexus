import {
  Guild,
  TextChannel,
  User,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  VoiceBasedChannel,
} from 'discord.js';
import { db } from '../core/database';
import { logger } from '../core/logger';
import { archiveAndSendTicketTranscript } from './transcriptService';

export const ROLES = {
  EVERYONE: '1525065834572021851',
  VERIFIED_MEMBER: '1525076439748182087',
  CLIENT: '1525076385192874024',
  VIP_CLIENT: '1525076410467614770',
  FOUNDER: '1525076160990543892',
  ADMINISTRATOR: '1525076232247705711',
  PROJECT_MANAGER: '1525111469056987268',
  DEVELOPER: '1525095643972894730',
  DESIGNER: '1525076321854685305',
  SUPPORT_TEAM: '1525111410651041973',
};

export const staffRoleIds = [
  ROLES.FOUNDER,
  ROLES.ADMINISTRATOR,
  ROLES.PROJECT_MANAGER,
  ROLES.DEVELOPER,
  ROLES.DESIGNER,
  ROLES.SUPPORT_TEAM,
];

export interface ApproveTicketOptions {
  guild: Guild;
  ticketChannel: TextChannel;
  approvedBy: User;
  clientName?: string;
  projectNotes?: string;
  withVoice?: boolean;
}

export async function approveTicketAndCreateWorkspace(options: ApproveTicketOptions): Promise<{
  clientChannel: TextChannel;
  voiceChannel: VoiceBasedChannel | null;
  clientUser: User | null;
}> {
  const { guild, ticketChannel, approvedBy, projectNotes, withVoice = true } = options;

  if (guild.id !== '1525065834572021851') {
    throw new Error('Client workspace creation is an exclusive feature configured for SRB Studio.');
  }

  await guild.roles.fetch();
  await guild.channels.fetch();

  // 1. Fetch ticket details from database
  const ticketRes = await db.query(
    `SELECT user_id, ticket_type, project_type, timeline, budget, details, subject, created_at 
     FROM guild_tickets 
     WHERE channel_id = $1 
     LIMIT 1`,
    [ticketChannel.id]
  ).catch(() => null);

  const ticketData = ticketRes?.rows?.[0];
  let targetUserId = ticketData?.user_id;

  // If not found in DB, inspect channel permission overwrites for the client
  if (!targetUserId) {
    const nonStaffOverwrite = ticketChannel.permissionOverwrites.cache.find(
      (po) =>
        po.type === 1 && // Member overwrite
        !staffRoleIds.includes(po.id) &&
        po.id !== guild.client.user?.id
    );
    if (nonStaffOverwrite) {
      targetUserId = nonStaffOverwrite.id;
    }
  }

  // Resolve Client User
  let clientUser: User | null = null;
  if (targetUserId) {
    clientUser = await guild.client.users.fetch(targetUserId).catch(() => null);
  }

  // Resolve client name
  const finalClientName =
    options.clientName?.trim() ||
    ticketData?.project_type ||
    clientUser?.username ||
    ticketChannel.name.replace(/^(ticket|quote|report|inquiry)-/i, '').replace(/-[0-9]+$/, '') ||
    'Client';

  // 2. Grant @Client role to user
  if (targetUserId) {
    try {
      const member = await guild.members.fetch(targetUserId).catch(() => null);
      if (member && !member.roles.cache.has(ROLES.CLIENT)) {
        await member.roles.add(ROLES.CLIENT, 'Client role granted via Ticket Approval');
        logger.info(`[TICKET APPROVE] Assigned @Client role to ${member.user.tag}`);
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to auto-assign Client role');
    }
  }

  // 3. Locate or create 📁 ACTIVE CLIENTS category
  let catActiveClients = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name.includes('ACTIVE CLIENTS')
  ) as any;

  if (!catActiveClients) {
    catActiveClients = await guild.channels.create({
      name: '📁 ACTIVE CLIENTS',
      type: ChannelType.GuildCategory,
      position: 3,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: ROLES.VERIFIED_MEMBER, deny: [PermissionFlagsBits.ViewChannel] },
        ...staffRoleIds.map((id) => ({
          id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.ManageMessages,
          ],
        })),
      ],
      reason: 'Automated category for private active client workspaces',
    });
  }

  const slug = finalClientName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const channelName = `🔒・${slug}`;

  // 4. Set Private Overwrites
  const overwrites: any[] = [
    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: ROLES.VERIFIED_MEMBER, deny: [PermissionFlagsBits.ViewChannel] },
    { id: ROLES.CLIENT, deny: [PermissionFlagsBits.ViewChannel] }, // Isolate from other clients
    ...staffRoleIds.map((id) => ({
      id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.AddReactions,
        PermissionFlagsBits.ManageMessages,
      ],
    })),
  ];

  if (targetUserId) {
    overwrites.push({
      id: targetUserId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.AddReactions,
      ],
    });
  }

  // 5. Create Private Client Text Channel
  let clientChannel = guild.channels.cache.find(
    (c) => c.parentId === catActiveClients.id && c.name === channelName && c.type === ChannelType.GuildText
  ) as TextChannel;

  if (!clientChannel) {
    clientChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: catActiveClients.id,
      permissionOverwrites: overwrites,
      reason: `Client workspace approved by ${approvedBy.tag} for ${finalClientName}`,
    });
  }

  // 6. Create Private Voice Room
  let voiceChannel: any = null;
  if (withVoice) {
    const vcName = `🎙 ${finalClientName} Room`;
    voiceChannel = guild.channels.cache.find(
      (c) => c.parentId === catActiveClients.id && c.name === vcName && c.type === ChannelType.GuildVoice
    );

    if (!voiceChannel) {
      voiceChannel = await guild.channels.create({
        name: vcName,
        type: ChannelType.GuildVoice,
        parent: catActiveClients.id,
        permissionOverwrites: overwrites,
        reason: `Client voice room approved by ${approvedBy.tag} for ${finalClientName}`,
      });
    }
  }

  // 7. Post Welcome Onboarding & Ticket Scope Embed
  const mentionText = targetUserId ? `<@${targetUserId}>` : `**${finalClientName} Team**`;

  const welcomeEmbed = new EmbedBuilder()
    .setTitle(`🤝 CLIENT WORKSPACE ・ ${finalClientName.toUpperCase()}`)
    .setDescription(
      `Welcome ${mentionText} to your dedicated private workspace with **SRB Studio**!\n\n` +
      `Your support ticket has been officially approved, and your project discussion has been transitioned to this private hub.\n\n` +
      `─────────────────────────────────────`
    )
    .addFields(
      {
        name: '📌 Client / Project',
        value: `**${finalClientName}**`,
        inline: true,
      },
      {
        name: '🛡️ Handled By',
        value: `**SRB Studio Team**`,
        inline: true,
      },
      {
        name: '🎫 Origin Ticket',
        value: `\`#${ticketChannel.name}\``,
        inline: true,
      }
    )
    .setColor(0x00E5FF)
    .setTimestamp();

  if (projectNotes && projectNotes.trim().length > 0) {
    welcomeEmbed.addFields({
      name: '📝 Agreed Scope & Project Deliverables',
      value: `\`\`\`${projectNotes.slice(0, 950)}\`\`\``,
      inline: false,
    });
  } else if (ticketData?.details) {
    welcomeEmbed.addFields({
      name: '📝 Project Requirements (from Ticket)',
      value: `\`\`\`${ticketData.details.slice(0, 950)}\`\`\``,
      inline: false,
    });
  }

  if (ticketData?.budget || ticketData?.timeline) {
    welcomeEmbed.addFields(
      { name: '💰 Budget / Target', value: ticketData.budget ? `\`${ticketData.budget}\`` : '*Not specified*', inline: true },
      { name: '⏱️ Target Timeline', value: ticketData.timeline ? `\`${ticketData.timeline}\`` : '*Flexible*', inline: true }
    );
  }

  welcomeEmbed.addFields(
    {
      name: '👥 Dedicated Engineering & Design Leads',
      value:
        `• **Project Management:** <@&${ROLES.PROJECT_MANAGER}>\n` +
        `• **Engineering Lead:** <@&${ROLES.DEVELOPER}>\n` +
        `• **Design Lead:** <@&${ROLES.DESIGNER}>\n` +
        (voiceChannel ? `• **Meeting Voice Room:** <#${voiceChannel.id}>\n` : ''),
      inline: false,
    },
    {
      name: '🔒 Workspace Communication & No-DM Policy',
      value:
        `• **All communications must stay within this dedicated channel.**\n` +
        `• **No Personal DMs:** Staff members do **not** answer project queries or take requests in personal direct messages.\n` +
        `• **Fast & Guaranteed Turnaround:** Keeping all discussion, revisions, and files in this channel ensures our entire team has visibility and can support you without delays.`,
      inline: false,
    }
  );

  welcomeEmbed.setFooter({ text: 'SRB Studio Private Client Workspace • Confidential' });

  await clientChannel.send({ embeds: [welcomeEmbed] });

  // 8. Generate & Send Transcript Archive to Staff #ticket-transcripts channel
  await archiveAndSendTicketTranscript(guild, ticketChannel, approvedBy);

  // 9. Update database ticket status
  await db.query(
    `UPDATE guild_tickets SET status = 'APPROVED_AND_CLOSED', closed_at = NOW() WHERE channel_id = $1`,
    [ticketChannel.id]
  ).catch(() => {});

  logger.info(`[TICKET APPROVE] Successfully approved ticket #${ticketChannel.name} -> created #${clientChannel.name}`);

  return { clientChannel, voiceChannel, clientUser };
}
