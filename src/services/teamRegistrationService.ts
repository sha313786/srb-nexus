import {
  ButtonInteraction,
  ModalSubmitInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  Client,
  TextChannel,
} from 'discord.js';
import { db } from '../core/database';
import { logger } from '../core/logger';

const GUILD_ID = '1558245529417293884'; // NAADAN LEGACY ESPORTS
const STAFF_REVIEW_CHANNEL_ID = '1570853707317379185'; // 📋・ᴛᴇᴀᴍ-ʀᴇɢɪꜱᴛʀᴀᴛɪᴏɴꜱ
const TEAM_ZONE_CATEGORY_ID = '1570853712459604179'; // 🏆 ══════ 𝐓𝐄𝐀𝐌 𝐙𝐎𝐍𝐄 ══════ 🏆
const REGISTERED_ROLE_ID = '1566440573513244682'; // @registered

// Helper to sanitize team name into a clean discord channel slug
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 30) || 'squad';
}

function clientAppId(guild: any): string {
  return guild.client?.user?.id || '1526885301736177705';
}

/**
 * 1. Open the Discord Registration Modal (if triggered via Discord)
 */
export async function openTeamRegistrationModal(interaction: ButtonInteraction): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId('ndl_team_reg_modal')
    .setTitle('🏆 Squad & Team Registration');

  const teamInput = new TextInputBuilder()
    .setCustomId('team_name')
    .setLabel('Squad / Clan Name')
    .setPlaceholder('e.g. Velocity Esports / NDL Phoenix')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(64);

  const captainInput = new TextInputBuilder()
    .setCustomId('captain_ign')
    .setLabel('Team Captain IGN')
    .setPlaceholder('e.g. VLX・Predator')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(64);

  const gameInput = new TextInputBuilder()
    .setCustomId('game_title')
    .setLabel('Game / Tournament Title')
    .setPlaceholder('e.g. BGMI Squad / Valorant / PUBG')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(64);

  const rosterInput = new TextInputBuilder()
    .setCustomId('roster')
    .setLabel('4-5 Players (IGNs & Game IDs)')
    .setPlaceholder('P1: Name (ID)\nP2: Name (ID)\nP3: Name (ID)\nP4: Name (ID)')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(500);

  const contactInput = new TextInputBuilder()
    .setCustomId('contact')
    .setLabel('Captain Discord / Contact')
    .setPlaceholder('e.g. Discord username or phone')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(100);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(teamInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(captainInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(gameInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(rosterInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(contactInput)
  );

  await interaction.showModal(modal);
}

/**
 * 2. Handle Discord Modal Submit
 */
export async function handleTeamRegModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const teamName = interaction.fields.getTextInputValue('team_name').trim();
  const captainIGN = interaction.fields.getTextInputValue('captain_ign').trim();
  const game = interaction.fields.getTextInputValue('game_title').trim();
  const roster = interaction.fields.getTextInputValue('roster').trim();
  const contact = interaction.fields.getTextInputValue('contact')?.trim() || '';

  const regId = `NDL-${Date.now().toString(36).toUpperCase()}`;

  // Store in database
  await db.query(
    `INSERT INTO tournament_registrations 
     (id, guild_id, team_name, captain_ign, captain_discord, event_title, game, roster, contact, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING')`,
    [regId, interaction.guildId || GUILD_ID, teamName, captainIGN, interaction.user.tag, game, game, roster, contact]
  );

  // Send Staff Review Card
  const client = interaction.client;
  await dispatchStaffReviewCard(client, {
    regId,
    teamName,
    captainIGN,
    captainDiscord: interaction.user.tag,
    captainUserId: interaction.user.id,
    game,
    roster,
    contact,
    source: 'Discord Client',
  });

  // User Confirmation
  const confirmEmbed = new EmbedBuilder()
    .setColor('#10B981')
    .setTitle('✅ Team Registration Submitted!')
    .setDescription(
      `Thank you, <@${interaction.user.id}>! Your squad **${teamName}** has been submitted for verification.\n\n` +
      `• **Registration ID:** \`${regId}\`\n` +
      `• **Game:** ${game}\n` +
      `• **Captain:** ${captainIGN}\n\n` +
      `*Our tournament administration team will review your roster shortly. Once approved, your dedicated team role and private channels will be created automatically.*`
    )
    .setFooter({ text: 'NAADAN LEGACY ESPORTS • Powered by SRB NEXUS' })
    .setTimestamp();

  await interaction.editReply({ embeds: [confirmEmbed] });
}

/**
 * 3. Dispatch Staff Review Card (used by both Discord Modal and Website API)
 */
export async function dispatchStaffReviewCard(
  client: Client,
  data: {
    regId: string;
    teamName: string;
    captainIGN: string;
    captainDiscord: string;
    captainUserId?: string;
    game: string;
    roster: string;
    contact?: string;
    source: string;
  }
): Promise<void> {
  const guild = client.guilds.cache.get(GUILD_ID) || (await client.guilds.fetch(GUILD_ID).catch(() => null));
  if (!guild) return;

  const reviewChannel = guild.channels.cache.get(STAFF_REVIEW_CHANNEL_ID) as TextChannel;
  if (!reviewChannel || !reviewChannel.isTextBased()) {
    logger.error('[TEAM-REG] Staff review channel not found');
    return;
  }

  const captainDisplay = data.captainUserId
    ? `<@${data.captainUserId}> (\`${data.captainDiscord}\`)`
    : `\`${data.captainDiscord}\``;

  const embed = new EmbedBuilder()
    .setColor('#F59E0B')
    .setAuthor({
      name: 'NAADAN LEGACY ESPORTS • Squad Review Queue',
      iconURL: guild.iconURL() || undefined,
    })
    .setTitle(`🛡️ New Squad Registration: ${data.teamName}`)
    .setDescription(
      `A new competitive squad has registered via **${data.source}**.\nReview the roster below and choose an action.`
    )
    .addFields(
      { name: '🏆 Squad Name', value: `**${data.teamName}**`, inline: true },
      { name: '🎮 Game', value: data.game || 'Tournament', inline: true },
      { name: '🆔 Reg ID', value: `\`${data.regId}\``, inline: true },
      { name: '👑 Captain IGN', value: data.captainIGN, inline: true },
      { name: '💬 Discord', value: captainDisplay, inline: true },
      { name: '📞 Contact', value: data.contact || 'N/A', inline: true },
      { name: '📋 Roster (Players & IDs)', value: `\`\`\`\n${data.roster.slice(0, 1000)}\n\`\`\``, inline: false }
    )
    .setFooter({ text: 'Click Approve to automatically provision Role, VC, and Text Channel.' })
    .setTimestamp();

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`team_approve_${data.regId}`)
      .setLabel('Approve Team ✅')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`team_reject_${data.regId}`)
      .setLabel('Reject ❌')
      .setStyle(ButtonStyle.Danger)
  );

  await reviewChannel.send({ embeds: [embed], components: [actionRow] });
}

/**
 * 4. Core Automated Provisioning Service
 * Callable via Staff Discord Buttons, Admin Website API, or Supabase Webhook!
 */
export async function provisionTeamDiscordSpace(
  client: Client,
  data: {
    teamName: string;
    captainDiscord?: string;
    captainIGN?: string;
    game?: string;
    roster?: string;
    approvedBy?: string;
    regId?: string;
  }
): Promise<{
  success: boolean;
  teamRole?: { id: string; name: string };
  textChannel?: { id: string; name: string };
  voiceChannel?: { id: string; name: string };
  captainFound?: boolean;
  error?: string;
}> {
  const guild = client.guilds.cache.get(GUILD_ID) || (await client.guilds.fetch(GUILD_ID).catch(() => null));
  if (!guild) {
    logger.error(`[TEAM-REG] Guild ${GUILD_ID} not found.`);
    return { success: false, error: 'Discord Guild not found' };
  }

  const teamName = data.teamName.trim();
  const slug = slugify(teamName);

  try {
    // A. Create or Find Team Role
    let teamRole = guild.roles.cache.find(
      (r) =>
        r.name.toLowerCase() === `team ${teamName}`.toLowerCase() ||
        r.name.toLowerCase() === teamName.toLowerCase()
    );

    if (!teamRole) {
      teamRole = await guild.roles.create({
        name: `Team ${teamName}`,
        color: '#EAB308', // Gold
        mentionable: true,
        reason: `Tournament Team Approval for ${teamName} (${data.approvedBy || 'Admin'})`,
      });
      logger.info(`[TEAM-REG] Created role ${teamRole.name} (${teamRole.id})`);
    }

    // B. Assign role to captain if on server
    let captainMember = null;
    let captainFound = false;
    if (data.captainDiscord) {
      const cleanTag = data.captainDiscord.toLowerCase().replace(/^@/, '').trim();
      const allMembers = await guild.members.fetch().catch(() => guild.members.cache);
      captainMember = allMembers.find(
        (m) =>
          m.user.tag.toLowerCase() === cleanTag ||
          m.user.username.toLowerCase() === cleanTag ||
          (m.user.globalName && m.user.globalName.toLowerCase() === cleanTag) ||
          m.id === cleanTag
      );

      if (captainMember) {
        captainFound = true;
        await captainMember.roles.add(teamRole).catch(() => {});
        // Also grant @registered
        const regRole = guild.roles.cache.get(REGISTERED_ROLE_ID);
        if (regRole) await captainMember.roles.add(regRole).catch(() => {});
        logger.info(`[TEAM-REG] Assigned role to captain ${captainMember.user.tag}`);
      }
    }

    // C. Resolve Target Category (TEAM ZONE)
    let category = guild.channels.cache.get(TEAM_ZONE_CATEGORY_ID);
    if (!category || category.type !== ChannelType.GuildCategory) {
      category = guild.channels.cache.find(
        (c) => c.type === ChannelType.GuildCategory && c.name.includes('TEAM ZONE')
      ) as any;
    }

    const categoryId = category ? category.id : undefined;

    // D. Create or Find Private Text Channel
    let textChannel = guild.channels.cache.find(
      (c) => c.parentId === categoryId && (c.name === `💬・${slug}` || c.name === slug)
    ) as TextChannel;

    if (!textChannel) {
      textChannel = await guild.channels.create({
        name: `💬・${slug}`,
        type: ChannelType.GuildText,
        parent: categoryId,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
          },
          {
            id: teamRole.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          },
          {
            id: guild.members.me?.id || clientAppId(guild),
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ManageChannels,
            ],
          },
        ],
      });

      // Send Team Welcome Announcement
      const teamWelcomeEmbed = new EmbedBuilder()
        .setColor('#EAB308')
        .setTitle(`🏆 Welcome, ${teamName}!`)
        .setDescription(
          `Congratulations! Your squad registration for **${data.game || 'Tournament'}** has been officially **APPROVED**.\n\n` +
          `• **Squad Role:** <@&${teamRole.id}>\n` +
          `• **Text Channel:** <#${textChannel.id}>\n` +
          (captainMember ? `• **Team Captain:** <@${captainMember.id}>\n\n` : `\n`) +
          `Use this private channel and voice room for your scrims, team comms, and tournament updates. Room credentials and match schedules will be dispatched here!`
        )
        .setFooter({ text: 'NAADAN LEGACY ESPORTS • Powered by SRB NEXUS' })
        .setTimestamp();

      await textChannel.send({
        content: captainMember ? `<@${captainMember.id}>` : undefined,
        embeds: [teamWelcomeEmbed],
      });
    }

    // E. Create or Find Private Voice Channel
    let voiceChannel = guild.channels.cache.find(
      (c) => c.parentId === categoryId && (c.name === `🔊・${slug}` || c.name === slug)
    );

    if (!voiceChannel) {
      voiceChannel = await guild.channels.create({
        name: `🔊・${slug}`,
        type: ChannelType.GuildVoice,
        parent: categoryId,
        userLimit: 6,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
          },
          {
            id: teamRole.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.Connect,
              PermissionFlagsBits.Speak,
              PermissionFlagsBits.Stream,
            ],
          },
          {
            id: guild.members.me?.id || clientAppId(guild),
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.Connect,
              PermissionFlagsBits.ManageChannels,
            ],
          },
        ],
      });
    }

    // F. Notify Staff Channel (#📋・ᴛᴇᴀᴍ-ʀᴇɢɪꜱᴛʀᴀᴛɪᴏɴꜱ)
    const reviewChannel = guild.channels.cache.get(STAFF_REVIEW_CHANNEL_ID) as TextChannel;
    if (reviewChannel && reviewChannel.isTextBased()) {
      const staffLogEmbed = new EmbedBuilder()
        .setColor('#10B981')
        .setTitle(`⚡ Squad Auto-Provisioned: ${teamName}`)
        .setDescription(`A team has been approved via **${data.approvedBy || 'Admin Portal'}** and provisioned in Discord.`)
        .addFields(
          { name: '🏆 Squad Name', value: teamName, inline: true },
          { name: '🎮 Game', value: data.game || 'Valorant', inline: true },
          { name: '⚡ Role', value: `<@&${teamRole.id}>`, inline: true },
          { name: '💬 Channel', value: `<#${textChannel.id}>`, inline: true },
          { name: '🔊 VC', value: `<#${voiceChannel.id}>`, inline: true },
          {
            name: '👑 Captain',
            value: captainMember
              ? `<@${captainMember.id}> (${data.captainIGN || ''})`
              : `\`${data.captainDiscord || 'N/A'}\` *(Not yet on server)*`,
            inline: true,
          }
        )
        .setTimestamp();

      await reviewChannel.send({ embeds: [staffLogEmbed] });
    }

    return {
      success: true,
      teamRole: { id: teamRole.id, name: teamRole.name },
      textChannel: { id: textChannel.id, name: textChannel.name },
      voiceChannel: { id: voiceChannel.id, name: voiceChannel.name },
      captainFound,
    };
  } catch (err: any) {
    logger.error({ err }, `[TEAM-REG] Failed provisioning team ${teamName}`);
    return { success: false, error: err.message };
  }
}

/**
 * 5. Handle Staff Button Approval in Discord
 */
export async function handleTeamApproval(interaction: ButtonInteraction, regId: string): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;

  // Check Staff Permission
  const member = interaction.member as any;
  const isStaff =
    member?.permissions?.has(PermissionFlagsBits.ManageChannels) ||
    member?.roles?.cache?.some((r: any) =>
      ['staff', 'administrator', 'management', 'admin'].some((roleName) =>
        r.name.toLowerCase().includes(roleName)
      )
    );

  if (!isStaff) {
    await interaction.reply({ content: '❌ Only staff and tournament administrators can approve team registrations.', ephemeral: true });
    return;
  }

  await interaction.deferUpdate();

  // Query DB
  const res = await db.query('SELECT * FROM tournament_registrations WHERE id = $1', [regId]);
  const reg = res.rows[0];

  if (!reg) {
    await interaction.followUp({ content: '❌ Registration record not found in database.', ephemeral: true });
    return;
  }

  if (reg.status === 'APPROVED') {
    await interaction.followUp({ content: '⚠️ This team has already been approved.', ephemeral: true });
    return;
  }

  const result = await provisionTeamDiscordSpace(interaction.client, {
    teamName: reg.team_name,
    captainDiscord: reg.captain_discord,
    captainIGN: reg.captain_ign,
    game: reg.game,
    roster: reg.roster,
    approvedBy: interaction.user.tag,
    regId,
  });

  if (!result.success) {
    await interaction.followUp({ content: `❌ Error while provisioning channels/roles: ${result.error}`, ephemeral: true });
    return;
  }

  // Update Database
  await db.query(
    `UPDATE tournament_registrations 
     SET status = 'APPROVED',
         approved_by = $1,
         role_id = $2,
         text_channel_id = $3,
         voice_channel_id = $4,
         updated_at = NOW()
     WHERE id = $5`,
    [interaction.user.id, result.teamRole?.id, result.textChannel?.id, result.voiceChannel?.id, regId]
  );

  // Update Staff Review Embed
  const originalEmbed = interaction.message.embeds[0];
  const updatedEmbed = EmbedBuilder.from(originalEmbed)
    .setColor('#10B981')
    .setTitle(`✅ Squad APPROVED: ${reg.team_name}`)
    .addFields(
      { name: '⚡ Provisioned Role', value: `<@&${result.teamRole?.id}>`, inline: true },
      { name: '💬 Team Text Channel', value: `<#${result.textChannel?.id}>`, inline: true },
      { name: '🔊 Team VC', value: `<#${result.voiceChannel?.id}>`, inline: true },
      { name: '👤 Approved By', value: `<@${interaction.user.id}>`, inline: true }
    );

  await interaction.editReply({
    embeds: [updatedEmbed],
    components: [], // remove buttons
  });

  logger.info(`[TEAM-REG] Approved team ${reg.team_name} (${regId}) by ${interaction.user.tag}`);
}

/**
 * 6. Handle Staff Button Rejection in Discord
 */
export async function handleTeamRejection(interaction: ButtonInteraction, regId: string): Promise<void> {
  const member = interaction.member as any;
  const isStaff =
    member?.permissions?.has(PermissionFlagsBits.ManageChannels) ||
    member?.roles?.cache?.some((r: any) =>
      ['staff', 'administrator', 'management', 'admin'].some((roleName) =>
        r.name.toLowerCase().includes(roleName)
      )
    );

  if (!isStaff) {
    await interaction.reply({ content: '❌ Only staff can reject team registrations.', ephemeral: true });
    return;
  }

  await interaction.deferUpdate();

  await db.query(
    `UPDATE tournament_registrations 
     SET status = 'REJECTED', approved_by = $1, updated_at = NOW() 
     WHERE id = $2`,
    [interaction.user.id, regId]
  );

  const originalEmbed = interaction.message.embeds[0];
  const updatedEmbed = EmbedBuilder.from(originalEmbed)
    .setColor('#EF4444')
    .setTitle(`❌ Squad REJECTED`)
    .addFields({ name: '👤 Rejected By', value: `<@${interaction.user.id}>`, inline: true });

  await interaction.editReply({
    embeds: [updatedEmbed],
    components: [],
  });

  logger.info(`[TEAM-REG] Rejected team reg ${regId} by ${interaction.user.tag}`);
}
