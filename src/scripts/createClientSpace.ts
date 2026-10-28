import {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import * as dotenv from 'dotenv';
dotenv.config();

const GUILD_ID = '1525065834572021851';

// Role IDs
const ROLES = {
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

const staffRoleIds = [
  ROLES.FOUNDER,
  ROLES.ADMINISTRATOR,
  ROLES.PROJECT_MANAGER,
  ROLES.DEVELOPER,
  ROLES.DESIGNER,
  ROLES.SUPPORT_TEAM,
];

function parseArgs() {
  const args = process.argv.slice(2);
  let clientName = '';
  let clientTargetId = '';
  let withVoice = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) {
      clientName = args[++i];
    } else if ((args[i] === '--client' || args[i] === '--id') && args[i + 1]) {
      clientTargetId = args[++i];
    } else if (args[i] === '--voice') {
      withVoice = true;
    } else if (!clientName && !args[i].startsWith('--')) {
      clientName = args[i];
    }
  }

  return { clientName, clientTargetId, withVoice };
}

async function main() {
  const { clientName, clientTargetId, withVoice } = parseArgs();

  if (!clientName) {
    console.error('❌ Please provide a client or project name:');
    console.error('Usage: ts-node src/scripts/createClientSpace.ts --name "ClientName" [--client <UserIdOrRoleId>] [--voice]');
    process.exit(1);
  }

  console.log(`🚀 Creating dedicated client workspace for: "${clientName}"...`);

  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  await client.login(process.env.DISCORD_TOKEN);
  const guild = await client.guilds.fetch(GUILD_ID);
  if (!guild) {
    throw new Error(`Guild ${GUILD_ID} not found.`);
  }

  // Pre-fetch roles and channels
  await guild.roles.fetch();
  await guild.channels.fetch();

  // 1. Locate or create 📁 ACTIVE CLIENTS category
  let catActiveClients = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name.includes('ACTIVE CLIENTS')
  ) as any;

  if (!catActiveClients) {
    catActiveClients = await guild.channels.create({
      name: '📁 ACTIVE CLIENTS',
      type: ChannelType.GuildCategory,
      position: 3,
      permissionOverwrites: [
        { id: ROLES.EVERYONE, deny: [PermissionFlagsBits.ViewChannel] },
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
      reason: 'Category for isolated active client workspaces',
    });
    console.log(`✅ Created category: 📁 ACTIVE CLIENTS (${catActiveClients.id})`);
  }

  const slug = clientName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const channelName = `🔒・${slug}`;

  // Permissions for client channel
  const overwrites: any[] = [
    { id: ROLES.EVERYONE, deny: [PermissionFlagsBits.ViewChannel] },
    { id: ROLES.VERIFIED_MEMBER, deny: [PermissionFlagsBits.ViewChannel] },
    { id: ROLES.CLIENT, deny: [PermissionFlagsBits.ViewChannel] }, // Don't let other clients see this channel
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

  if (clientTargetId) {
    overwrites.push({
      id: clientTargetId,
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

  // Create or retrieve text channel
  let textChan = guild.channels.cache.find(
    (c) => c.parentId === catActiveClients.id && c.name === channelName
  ) as any;

  if (!textChan) {
    textChan = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: catActiveClients.id,
      permissionOverwrites: overwrites,
      reason: `Client workspace for ${clientName}`,
    });
    console.log(`✅ Created client channel: #${channelName} (${textChan.id})`);
  } else {
    console.log(`ℹ️ Client channel #${channelName} already exists (${textChan.id})`);
  }

  // Voice channel if requested
  let voiceChan = null;
  if (withVoice) {
    const vcName = `🎙 ${clientName} Room`;
    voiceChan = guild.channels.cache.find(
      (c) => c.parentId === catActiveClients.id && c.name === vcName
    ) as any;

    if (!voiceChan) {
      voiceChan = await guild.channels.create({
        name: vcName,
        type: ChannelType.GuildVoice,
        parent: catActiveClients.id,
        permissionOverwrites: overwrites,
        reason: `Voice workspace for ${clientName}`,
      });
      console.log(`✅ Created client voice room: 🔊 ${vcName} (${voiceChan.id})`);
    }
  }

  // Post welcome project embed
  const mentionText = clientTargetId ? `<@${clientTargetId}>` : `**${clientName} Team**`;

  const welcomeEmbed = new EmbedBuilder()
    .setTitle(`🤝 PRIVATE WORKSPACE ・ ${clientName.toUpperCase()}`)
    .setDescription(
      `Welcome ${mentionText} to your dedicated private workspace with **SRB Studio**!\n\n` +
      `This channel is private to you and the SRB Studio engineering and design team.\n\n` +
      `─────────────────────────────────────\n` +
      `### 📌 Project Workspace Details\n` +
      `• **Client / Project:** ${clientName}\n` +
      `• **Dedicated PM:** <@&${ROLES.PROJECT_MANAGER}>\n` +
      `• **Engineering Leads:** <@&${ROLES.DEVELOPER}>\n` +
      `• **Design Lead:** <@&${ROLES.DESIGNER}>\n\n` +
      `### 🎯 Collaboration Flow\n` +
      `1. **Daily Communications:** Use this channel for daily updates, questions, and revision notes.\n` +
      `2. **Deliverables:** Staging URLs, previews, and asset links will be dropped here.\n` +
      `3. **Reviews:** We can jump on screen share anytime in our private voice room.\n\n` +
      `*Let's build something exceptional together!*`
    )
    .setColor(0x00E5FF)
    .setFooter({ text: 'SRB Studio Private Client Workspace' })
    .setTimestamp();

  await textChan.send({ embeds: [welcomeEmbed] });
  console.log(`✅ Deployed welcome project embed to #${channelName}`);

  console.log('\n🎉 Client workspace successfully prepared!');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Error executing createClientSpace:', err);
  process.exit(1);
});
