import {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  OverwriteType,
} from 'discord.js';
import * as dotenv from 'dotenv';
dotenv.config();

const GUILD_ID = '1525390373281857546';
const DUTY_CATEGORY_ID = '1525395644192395376';

// Role IDs in XLANTIS Medical Department
const ROLES = {
  EVERYONE: '1525390373281857546',
  XMD: '1526551893235470406',
  DIRECTOR: '1525391222158659754',
  CHIEF: '1525391646936662066',
  ASST_CHIEF: '1525391750103826524',
  CLINICAL_OPS: '1525391856140161045',
  SUPERVISOR: '1525392168573992991',
  MANAGEMENT_PORTAL: '1525522899002327062',
};

async function main() {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  });

  await client.login(process.env.DISCORD_TOKEN);
  console.log(`Logged in as ${client.user?.tag}`);

  const guild = await client.guilds.fetch(GUILD_ID);
  if (!guild) {
    throw new Error('Guild not found');
  }

  // Check if channel already exists
  const existing = guild.channels.cache.find(
    (c) => c.parentId === DUTY_CATEGORY_ID && c.name.includes('ᴛʀᴀɪɴ')
  );

  if (existing) {
    console.log(`Channel already exists: ${existing.name} (${existing.id})`);
    process.exit(0);
  }

  console.log('Creating channel in DUTY SYSTEM...');

  const channel = await guild.channels.create({
    name: 'ᴛʀᴀɪɴɪɴɢ-ᴘʀᴏᴍᴏᴛɪᴏɴꜱ',
    type: ChannelType.GuildText,
    parent: DUTY_CATEGORY_ID,
    topic: 'Official announcements for new Trainees, assigned Trainers / FTOs, and Department Promotions.',
    permissionOverwrites: [
      {
        id: ROLES.EVERYONE,
        type: OverwriteType.Role,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: ROLES.XMD,
        type: OverwriteType.Role,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AddReactions,
        ],
        deny: [
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.CreatePublicThreads,
          PermissionFlagsBits.CreatePrivateThreads,
          PermissionFlagsBits.SendMessagesInThreads,
        ],
      },
      {
        id: ROLES.DIRECTOR,
        type: OverwriteType.Role,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.MentionEveryone,
        ],
      },
      {
        id: ROLES.CHIEF,
        type: OverwriteType.Role,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.MentionEveryone,
        ],
      },
      {
        id: ROLES.ASST_CHIEF,
        type: OverwriteType.Role,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.AttachFiles,
        ],
      },
      {
        id: ROLES.CLINICAL_OPS,
        type: OverwriteType.Role,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.AttachFiles,
        ],
      },
      {
        id: ROLES.SUPERVISOR,
        type: OverwriteType.Role,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.AttachFiles,
        ],
      },
      {
        id: ROLES.MANAGEMENT_PORTAL,
        type: OverwriteType.Role,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.AttachFiles,
        ],
      },
      {
        id: client.user!.id,
        type: OverwriteType.Member,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ManageMessages,
        ],
      },
    ],
  });

  console.log(`Successfully created channel: ${channel.name} (${channel.id})`);

  // Send an official introductory welcome embed
  const bannerEmbed = new EmbedBuilder()
    .setTitle('🚑 XLANTIS MEDICAL DEPARTMENT — TRAINING & PROMOTIONS')
    .setDescription(
      'Welcome to the official department channel for **New Trainee Onboarding, Trainer Assignments, and Official Rank Promotions**.\n\nAll departmental training progress and milestones will be formally logged and broadcast here.'
    )
    .setColor(0xE63946)
    .addFields(
      {
        name: '🎓 New Trainee & Trainer Pairings',
        value:
          'When recruits enter the academy or transition to active duty, their assigned **Field Training Officer (FTO) / Senior Doctor** and training phase instructions will be published here.',
        inline: false,
      },
      {
        name: '🎖️ Rank Promotions & Elevations',
        value:
          'Members who complete evaluation phases, display exemplary medical service, or pass command boards will receive their official promotion announcements here.',
        inline: false,
      },
      {
        name: '🤖 Automated Announcements with SRB NEXUS Bot',
        value:
          'Supervisors and Management can use SRB NEXUS slash commands to publish formatted announcements:\n• `/xmd-trainee` — Assign a trainer and announce a new recruit\n• `/xmd-promotion` — Issue an official rank promotion certificate',
        inline: false,
      }
    )
    .setFooter({
      text: 'XLANTIS Medical Department • Automated by SRB NEXUS',
      iconURL: guild.iconURL() || undefined,
    })
    .setTimestamp();

  const msg = await channel.send({ embeds: [bannerEmbed] });
  await msg.pin();

  console.log('Pinned welcome announcement posted successfully!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
