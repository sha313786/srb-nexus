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
  BOTS: '1525076121274683463',
  SRB_NEXUS: '1539185033485615156',
};

const staffRoleIds = [
  ROLES.FOUNDER,
  ROLES.ADMINISTRATOR,
  ROLES.PROJECT_MANAGER,
  ROLES.DEVELOPER,
  ROLES.DESIGNER,
  ROLES.SUPPORT_TEAM,
];

const clientRoleIds = [ROLES.CLIENT, ROLES.VIP_CLIENT];

const getStaffAllowOverrides = () => {
  return staffRoleIds.map((id) => ({
    id,
    allow: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.AddReactions,
      PermissionFlagsBits.UseExternalEmojis,
      PermissionFlagsBits.Connect,
      PermissionFlagsBits.Speak,
      PermissionFlagsBits.ManageMessages,
    ],
  }));
};

const getClientPortalCategoryOverrides = () => {
  return [
    // @everyone: Hide category completely
    {
      id: ROLES.EVERYONE,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    // Verified Members: Hide category (only onboarded clients & staff can see)
    {
      id: ROLES.VERIFIED_MEMBER,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    // Staff Overrides: Full access
    ...getStaffAllowOverrides(),
    // Client Overrides: Allowed to view & participate in the portal
    ...clientRoleIds.map((id) => ({
      id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.AddReactions,
        PermissionFlagsBits.UseExternalEmojis,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak,
      ],
    })),
  ];
};

async function main() {
  console.log('🚀 Deploying Client Portal category & channels for SRB Studio Discord...');

  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  await client.login(process.env.DISCORD_TOKEN);
  console.log(`🤖 Logged in as ${client.user?.tag}`);

  const guild = await client.guilds.fetch(GUILD_ID);
  if (!guild) {
    throw new Error(`Guild ${GUILD_ID} not found.`);
  }

  // Pre-fetch roles and channels so discord.js cache resolves IDs
  await guild.roles.fetch();
  await guild.channels.fetch();

  // 1. Check or Create Category: 💎 CLIENT PORTAL
  let catClientPortal = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name.includes('CLIENT PORTAL')
  ) as any;

  if (!catClientPortal) {
    catClientPortal = await guild.channels.create({
      name: '💎 CLIENT PORTAL',
      type: ChannelType.GuildCategory,
      position: 2, // Position right below CLIENT HUB
      permissionOverwrites: getClientPortalCategoryOverrides(),
      reason: 'SRB Studio Client Expansion: Shared VIP Client Portal',
    });
    console.log(`✅ Created category: 💎 CLIENT PORTAL (${catClientPortal.id})`);
  } else {
    await catClientPortal.edit({
      name: '💎 CLIENT PORTAL',
      position: 2,
      permissionOverwrites: getClientPortalCategoryOverrides(),
    });
    console.log(`✅ Updated category: 💎 CLIENT PORTAL (${catClientPortal.id})`);
  }

  // Helper to find or create text channel inside category
  const getOrCreateTextChannel = async (name: string, position: number, customOverwrites?: any[]) => {
    let chan = guild.channels.cache.find(
      (c) => c.parentId === catClientPortal.id && c.name === name
    ) as any;

    if (!chan) {
      chan = await guild.channels.create({
        name,
        type: ChannelType.GuildText,
        parent: catClientPortal.id,
        position,
        permissionOverwrites: customOverwrites || undefined,
        reason: `SRB Studio Client Portal: Create ${name}`,
      });
      console.log(`  + Created text channel: #${name} (${chan.id})`);
    } else {
      await chan.edit({
        position,
        ...(customOverwrites ? { permissionOverwrites: customOverwrites } : {}),
      });
      console.log(`  ~ Updated text channel: #${name} (${chan.id})`);
    }
    return chan;
  };

  // Helper to find or create voice channel inside category
  const getOrCreateVoiceChannel = async (name: string, position: number) => {
    let chan = guild.channels.cache.find(
      (c) => c.parentId === catClientPortal.id && c.name === name && c.type === ChannelType.GuildVoice
    ) as any;

    if (!chan) {
      chan = await guild.channels.create({
        name,
        type: ChannelType.GuildVoice,
        parent: catClientPortal.id,
        position,
        reason: `SRB Studio Client Portal: Create ${name}`,
      });
      console.log(`  + Created voice channel: 🔊 ${name} (${chan.id})`);
    } else {
      await chan.edit({ position });
      console.log(`  ~ Updated voice channel: 🔊 ${name} (${chan.id})`);
    }
    return chan;
  };

  // Channel 1: 📢・client-bulletins (Read-only for clients, announcements from staff)
  const bulletinsOverwrites = [
    { id: ROLES.EVERYONE, deny: [PermissionFlagsBits.ViewChannel] },
    { id: ROLES.VERIFIED_MEMBER, deny: [PermissionFlagsBits.ViewChannel] },
    ...getStaffAllowOverrides(),
    ...clientRoleIds.map((id) => ({
      id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AddReactions],
      deny: [PermissionFlagsBits.SendMessages],
    })),
  ];
  const chanBulletins = await getOrCreateTextChannel('📢・client-bulletins', 0, bulletinsOverwrites);

  // Channel 2: 🚀・client-onboarding-guide (Read-only for clients, onboarding guidelines)
  const onboardingOverwrites = [
    { id: ROLES.EVERYONE, deny: [PermissionFlagsBits.ViewChannel] },
    { id: ROLES.VERIFIED_MEMBER, deny: [PermissionFlagsBits.ViewChannel] },
    ...getStaffAllowOverrides(),
    ...clientRoleIds.map((id) => ({
      id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AddReactions],
      deny: [PermissionFlagsBits.SendMessages],
    })),
  ];
  const chanOnboarding = await getOrCreateTextChannel('🚀・client-onboarding-guide', 1, onboardingOverwrites);

  // Channel 3: 💬・client-lounge (Open collaboration chat between clients & team)
  const chanLounge = await getOrCreateTextChannel('💬・client-lounge', 2);

  // Channel 4: 📁・deliverables-and-assets (Previews, links, file sharing)
  const chanDeliverables = await getOrCreateTextChannel('📁・deliverables-and-assets', 3);

  // Channel 5: ⚡・priority-client-desk (Priority assistance desk)
  const chanPriorityDesk = await getOrCreateTextChannel('⚡・priority-client-desk', 4);

  // Channel 6: 🎙 Client Strategy VC (Voice room for meetings & reviews)
  const chanVoice = await getOrCreateVoiceChannel('🎙 Client Strategy VC', 5);

  // 2. POST BRANDED EMBEDS (if channel has 0 messages or to deploy initial guide)
  console.log('\n--- 2. INITIALIZING BRANDED EMBEDS ---');

  // Embed 1: Bulletins Announcement
  const bulletinsMsgs = await chanBulletins.messages.fetch({ limit: 5 });
  if (bulletinsMsgs.size === 0) {
    const bulletinsEmbed = new EmbedBuilder()
      .setTitle('📢 SRB STUDIO ・ CLIENT BULLETINS & ANNOUNCEMENTS')
      .setDescription(
        'Welcome to the private **SRB Studio Client Portal**!\n\n' +
        'This channel provides verified clients with essential updates directly from the engineering and design leads:\n\n' +
        '🔹 **Maintenance & Releases:** Advance notice of planned deployments, server maintenance, and API upgrades.\n' +
        '🔹 **Studio Announcements:** Studio schedule, holiday timings, and capacity updates.\n' +
        '🔹 **Exclusive Features:** Early access to new SRB Studio digital tools, Discord bot modules, and automation templates.\n\n' +
        '─────────────────────────────────────\n' +
        '*Note: This channel is announcement-only to ensure critical updates remain easily accessible. For general questions and discussion, please visit <#' + chanLounge.id + '>.*'
      )
      .setColor(0x5865F2)
      .setFooter({ text: 'SRB Studio Client Operations • Verified Client Access Only' })
      .setTimestamp();

    await chanBulletins.send({ embeds: [bulletinsEmbed] });
    console.log('  ✓ Deployed header embed to #📢・client-bulletins');
  }

  // Embed 2: Client Working Guide & Best Practices
  const onboardingMsgs = await chanOnboarding.messages.fetch({ limit: 5 });
  if (onboardingMsgs.size === 0) {
    const onboardingEmbed = new EmbedBuilder()
      .setTitle('🚀 SRB STUDIO ・ CLIENT WORKING PROTOCOL & WORKFLOW')
      .setDescription(
        'Welcome onboard! Here is our quick reference guide on how we collaborate with you throughout your project lifecycle.\n\n' +
        '─────────────────────────────────────'
      )
      .addFields(
        {
          name: '1️⃣ Project Lifecycle & Sprints',
          value:
            '• **Discovery & Scope:** Defining architecture, milestones, and deliverable timelines.\n' +
            '• **Design & Prototyping:** UI/UX wireframes and interactive mockups.\n' +
            '• **Development Sprints:** Clean code implementation with iterative progress updates.\n' +
            '• **Staging & QA:** Dedicated staging environments for client preview and feedback.\n' +
            '• **Production Launch:** Seamless domain connection, database migration, and handoff.',
        },
        {
          name: '2️⃣ Communication Guidelines',
          value:
            '• **General Chat:** Use <#' + chanLounge.id + '> for informal updates, ideas, and day-to-day coordination.\n' +
            '• **Deliverables & Files:** Shared builds, design exports, and preview links are cataloged in <#' + chanDeliverables.id + '>.\n' +
            '• **Voice Reviews:** Sync with our developers and designers inside <#' + chanVoice.id + '>.\n' +
            '• **Urgent Help:** If you encounter a critical blocker or urgent issue, ping the team in <#' + chanPriorityDesk.id + '>.',
        },
        {
          name: '3️⃣ Feedback & Revision Rounds',
          value:
            'To ensure lightning-fast turnarounds, please consolidate revision notes into structured bullet points or annotated screenshots.',
        },
        {
          name: '4️⃣ Deliverables, Ownership & Confidentiality',
          value:
            'All custom code, assets, and documentation produced for your contract are 100% proprietary to your team upon milestone settlement.',
        }
      )
      .setColor(0x57F287)
      .setFooter({ text: 'SRB Studio • Engineering & Design Standards' });

    await chanOnboarding.send({ embeds: [onboardingEmbed] });
    console.log('  ✓ Deployed protocol embed to #🚀・client-onboarding-guide');
  }

  // Embed 3: Lounge Welcome
  const loungeMsgs = await chanLounge.messages.fetch({ limit: 5 });
  if (loungeMsgs.size === 0) {
    const loungeEmbed = new EmbedBuilder()
      .setTitle('💬 SRB STUDIO ・ CLIENT COLLABORATION LOUNGE')
      .setDescription(
        'Welcome to your private client hub!\n\n' +
        'This space is shared between verified SRB Studio clients and our core engineering, PM, and design staff.\n\n' +
        '💡 **Feel free to:**\n' +
        '• Ask questions about project timelines and technical stacks.\n' +
        '• Share design inspirations or feature requirements.\n' +
        '• Connect directly with our developers and project managers.\n\n' +
        '*We are thrilled to build with you!*'
      )
      .setColor(0xFEE75C)
      .setFooter({ text: 'SRB Studio • Client Partnership Network' });

    await chanLounge.send({ embeds: [loungeEmbed] });
    console.log('  ✓ Deployed welcome embed to #💬・client-lounge');
  }

  // Embed 4: Deliverables Hub
  const deliverablesMsgs = await chanDeliverables.messages.fetch({ limit: 5 });
  if (deliverablesMsgs.size === 0) {
    const deliverablesEmbed = new EmbedBuilder()
      .setTitle('📁 SRB STUDIO ・ DELIVERABLES & ASSETS HUB')
      .setDescription(
        'This channel serves as your centralized drop-zone for project deliverables:\n\n' +
        '📦 **What goes here:**\n' +
        '• Staging & development preview URLs (Vercel, Render, AWS, Firebase)\n' +
        '• UI/UX design deliverables (Figma boards, SVGs, high-res mockups)\n' +
        '• Bot invitations, slash command summaries, and test environments\n' +
        '• Release notes, change logs, and production documentation'
      )
      .setColor(0x9B59B6)
      .setFooter({ text: 'SRB Studio Asset Management' });

    await chanDeliverables.send({ embeds: [deliverablesEmbed] });
    console.log('  ✓ Deployed assets embed to #📁・deliverables-and-assets');
  }

  // Embed 5: Priority Desk
  const priorityDeskMsgs = await chanPriorityDesk.messages.fetch({ limit: 5 });
  if (priorityDeskMsgs.size === 0) {
    const priorityDeskEmbed = new EmbedBuilder()
      .setTitle('⚡ SRB STUDIO ・ PRIORITY CLIENT DESK')
      .setDescription(
        'Welcome to the dedicated high-priority assistance desk for active clients.\n\n' +
        '🚨 **When to use this desk:**\n' +
        '• Critical production bugs or downtime on deployed systems\n' +
        '• Urgent scope changes or timeline adjustments\n' +
        '• Expedited technical support inquiries\n\n' +
        '**How to reach us:** State your issue with relevant screenshots/URLs, and tag our <@&' + ROLES.SUPPORT_TEAM + '> or <@&' + ROLES.PROJECT_MANAGER + '> for swift resolution.'
      )
      .setColor(0xED4245)
      .setFooter({ text: 'SRB Studio Priority SLA Desk' });

    await chanPriorityDesk.send({ embeds: [priorityDeskEmbed] });
    console.log('  ✓ Deployed priority desk embed to #⚡・priority-client-desk');
  }

  console.log('\n🎉 Successfully deployed 💎 CLIENT PORTAL and all client channels!');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Error executing deployClientPortal:', err);
  process.exit(1);
});
