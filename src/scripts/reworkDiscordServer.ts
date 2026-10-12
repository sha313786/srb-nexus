import {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import * as dotenv from 'dotenv';
dotenv.config();

const GUILD_ID = '1525065834572021851';

async function main() {
  console.log('🚀 Starting Discord Server Rework for SRB Studio...');

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  });

  await client.login(process.env.DISCORD_TOKEN);
  console.log(`🤖 Logged in as ${client.user?.tag}`);

  const guild = await client.guilds.fetch(GUILD_ID);
  if (!guild) {
    throw new Error(`Guild ${GUILD_ID} not found.`);
  }

  // 1. ROLES MANAGEMENT
  console.log('\n--- 1. ROLES CONFIGURATION ---');
  const roles = await guild.roles.fetch();
  let verifiedRole = roles.get('1525076439748182087'); // Currently '👀 Visitor'
  if (verifiedRole) {
    if (verifiedRole.name !== '✅ Verified Member') {
      verifiedRole = await verifiedRole.edit({
        name: '✅ Verified Member',
        color: 0x57F287,
        hoist: true,
        reason: 'SRB Studio Rework: Renamed Visitor to Verified Member',
      });
      console.log(`Updated role: ${verifiedRole.name} (${verifiedRole.id})`);
    }
  } else {
    verifiedRole = await guild.roles.create({
      name: '✅ Verified Member',
      color: 0x57F287,
      hoist: true,
      reason: 'SRB Studio Rework: Created Verified Member role',
    });
    console.log(`Created verified role: ${verifiedRole.name}`);
  }

  const staffRoleIds = [
    '1525076160990543892', // Founder
    '1525076232247705711', // Administrator
    '1525111469056987268', // Project Manager
    '1525111410651041973', // Support Team
    '1525095643972894730', // Developer
    '1525076321854685305', // Designer
  ];
  const clientRoleIds = [
    '1525076385192874024', // Client
    '1525076410467614770', // VIP Client
  ];

  // Helper for staff overrides
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
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak,
      ],
    }));
  };

  // Helper for client overrides
  const getClientOverrides = (canSend = false) => {
    return clientRoleIds.map((id) => ({
      id,
      allow: canSend
        ? [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.AddReactions,
          ]
        : [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.ReadMessageHistory,
          ],
      deny: canSend ? [] : [PermissionFlagsBits.SendMessages],
    }));
  };

  // 2. CATEGORIES CONFIGURATION
  console.log('\n--- 2. CATEGORIES REORGANIZATION ---');

  // Category 0: 📌 INFORMATION & ONBOARDING
  let catInfo = guild.channels.cache.get('1525066374206984192') as any;
  if (catInfo) {
    await catInfo.edit({
      name: '📌 INFORMATION & ONBOARDING',
      position: 0,
      permissionOverwrites: [
        {
          id: guild.id, // @everyone
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
          deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions],
        },
        ...getStaffAllowOverrides(),
      ],
    });
    console.log('Updated category: 📌 INFORMATION & ONBOARDING');
  }

  // Category 1: 💼 CLIENT HUB
  let catClient = guild.channels.cache.get('1525070012887601172') as any;
  if (catClient) {
    await catClient.edit({
      name: '💼 CLIENT HUB',
      position: 1,
      permissionOverwrites: [
        {
          id: guild.id, // @everyone
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: verifiedRole.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
          deny: [PermissionFlagsBits.SendMessages],
        },
        ...getClientOverrides(false),
        ...getStaffAllowOverrides(),
      ],
    });
    console.log('Updated category: 💼 CLIENT HUB');
  }

  // Category 2: 🎫 SUPPORT CENTER
  let catSupport = guild.channels.cache.get('1525114945568768131') as any;
  if (catSupport) {
    await catSupport.edit({
      name: '🎫 SUPPORT CENTER',
      position: 2,
      permissionOverwrites: [
        {
          id: guild.id, // @everyone
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: verifiedRole.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        ...getStaffAllowOverrides(),
      ],
    });
    console.log('Updated category: 🎫 SUPPORT CENTER');
  }

  // Category 3: 💬 COMMUNITY & NETWORK
  let catCommunity = guild.channels.cache.get('1525072023007657994') as any;
  if (catCommunity) {
    await catCommunity.edit({
      name: '💬 COMMUNITY & NETWORK',
      position: 3,
      permissionOverwrites: [
        {
          id: guild.id, // @everyone
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: verifiedRole.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.AddReactions,
          ],
        },
        ...getClientOverrides(true),
        ...getStaffAllowOverrides(),
      ],
    });
    console.log('Updated category: 💬 COMMUNITY & NETWORK');
  }

  // Category 4: 🛠 DEVELOPMENT & UPDATES
  let catDev = guild.channels.cache.get('1525072212359381042') as any;
  if (catDev) {
    await catDev.edit({
      name: '🛠 DEVELOPMENT & UPDATES',
      position: 4,
      permissionOverwrites: [
        {
          id: guild.id, // @everyone
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: verifiedRole.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
        },
        ...getClientOverrides(false),
        ...getStaffAllowOverrides(),
      ],
    });
    console.log('Updated category: 🛠 DEVELOPMENT & UPDATES');
  }

  // Category 5: 🔒 STAFF HQ
  let catStaff = guild.channels.cache.get('1525072335185645589') as any;
  if (catStaff) {
    await catStaff.edit({
      name: '🔒 STAFF HQ',
      position: 5,
      permissionOverwrites: [
        {
          id: guild.id, // @everyone
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: verifiedRole.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        ...clientRoleIds.map((id) => ({ id, deny: [PermissionFlagsBits.ViewChannel] })),
        ...getStaffAllowOverrides(),
      ],
    });
    console.log('Updated category: 🔒 STAFF HQ');
  }

  // Category 6: 🎙 VOICE CHANNELS
  let catVoice = guild.channels.cache.get('1525073203473678396') as any;
  if (catVoice) {
    await catVoice.edit({
      name: '🎙 VOICE CHANNELS',
      position: 6,
      permissionOverwrites: [
        {
          id: guild.id, // @everyone
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: verifiedRole.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
          ],
        },
        ...clientRoleIds.map((id) => ({
          id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
          ],
        })),
        ...getStaffAllowOverrides(),
      ],
    });
    console.log('Updated category: 🎙 VOICE CHANNELS');
  }

  // 3. CHANNELS RESTRUCTURING & RENAMING
  console.log('\n--- 3. CHANNELS RESTRUCTURING ---');

  // --- Category 0 Channels ---
  // Welcome & Verify (1525066482160238724)
  const chanWelcome = guild.channels.cache.get('1525066482160238724') as any;
  if (chanWelcome) {
    await chanWelcome.edit({
      name: '👋・welcome-and-verify',
      parent: catInfo.id,
      position: 0,
      permissionOverwrites: [
        {
          id: guild.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
          deny: [PermissionFlagsBits.SendMessages],
        },
        ...getStaffAllowOverrides(),
      ],
    });
    console.log('Updated: 👋・welcome-and-verify');
  }

  // Rules & Guidelines (create if needed)
  let chanRules = guild.channels.cache.find(
    (c) => c.parentId === catInfo.id && c.name.includes('rules')
  ) as any;
  if (!chanRules) {
    chanRules = await guild.channels.create({
      name: '📜・rules-guidelines',
      type: ChannelType.GuildText,
      parent: catInfo.id,
      position: 1,
      permissionOverwrites: [
        {
          id: guild.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
          deny: [PermissionFlagsBits.SendMessages],
        },
        ...getStaffAllowOverrides(),
      ],
    });
    console.log('Created: 📜・rules-guidelines');
  } else {
    await chanRules.edit({ name: '📜・rules-guidelines', position: 1 });
  }

  // Announcements (1525066507355160596)
  const chanAnnounce = guild.channels.cache.get('1525066507355160596') as any;
  if (chanAnnounce) {
    await chanAnnounce.edit({
      name: '📢・announcements',
      parent: catInfo.id,
      position: 2,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: verifiedRole.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
          deny: [PermissionFlagsBits.SendMessages],
        },
        ...getStaffAllowOverrides(),
      ],
    });
    console.log('Updated: 📢・announcements');
  }

  // Services & Pricing (1525066533238476951)
  const chanServices = guild.channels.cache.get('1525066533238476951') as any;
  if (chanServices) {
    await chanServices.edit({
      name: '🚀・services-pricing',
      parent: catInfo.id,
      position: 3,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: verifiedRole.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
          deny: [PermissionFlagsBits.SendMessages],
        },
        ...getStaffAllowOverrides(),
      ],
    });
    console.log('Updated: 🚀・services-pricing');
  }

  // Portfolio (1525066567103287396)
  const chanPortfolio = guild.channels.cache.get('1525066567103287396') as any;
  if (chanPortfolio) {
    await chanPortfolio.edit({
      name: '💼・portfolio',
      parent: catInfo.id,
      position: 4,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: verifiedRole.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
          deny: [PermissionFlagsBits.SendMessages],
        },
        ...getStaffAllowOverrides(),
      ],
    });
    console.log('Updated: 💼・portfolio');
  }

  // --- Category 1: Client Hub ---
  // Request a Quote (1559108384614252666)
  const chanQuote = guild.channels.cache.get('1559108384614252666') as any;
  if (chanQuote) {
    await chanQuote.edit({
      name: '💡・request-a-quote',
      parent: catClient.id,
      position: 0,
    });
    console.log('Updated: 💡・request-a-quote');
  }

  // Project Inquiry (1525071886214762496)
  const chanInquiry = guild.channels.cache.get('1525071886214762496') as any;
  if (chanInquiry) {
    await chanInquiry.edit({
      name: '📩・project-inquiry',
      parent: catClient.id,
      position: 1,
    });
    console.log('Updated: 📩・project-inquiry');
  }

  // Book a Meeting (1525071962437582908)
  const chanMeeting = guild.channels.cache.get('1525071962437582908') as any;
  if (chanMeeting) {
    await chanMeeting.edit({
      name: '📅・book-a-meeting',
      parent: catClient.id,
      position: 2,
    });
    console.log('Updated: 📅・book-a-meeting');
  }

  // Client Reviews (1558940011557167175)
  const chanReviews = guild.channels.cache.get('1558940011557167175') as any;
  if (chanReviews) {
    await chanReviews.edit({
      name: '⭐・client-reviews',
      parent: catClient.id,
      position: 3,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: verifiedRole.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
          ],
        },
        ...getClientOverrides(true),
        ...getStaffAllowOverrides(),
      ],
    });
    console.log('Updated: ⭐・client-reviews');
  }

  // --- Category 2: Support Center ---
  // Ticket Transcripts (1525111714985545859) -> Move to Support Center
  const chanTranscripts = guild.channels.cache.get('1525111714985545859') as any;
  if (chanTranscripts) {
    await chanTranscripts.edit({
      name: '📄・ticket-transcripts',
      parent: catSupport.id,
      position: 0,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: verifiedRole.id, deny: [PermissionFlagsBits.ViewChannel] },
        ...clientRoleIds.map((id) => ({ id, deny: [PermissionFlagsBits.ViewChannel] })),
        ...getStaffAllowOverrides(),
      ],
    });
    console.log('Moved: 📄・ticket-transcripts to 🎫 SUPPORT CENTER');
  }

  // Support Waiting Room (1525115176829980672, voice)
  const chanSupportVoice = guild.channels.cache.get('1525115176829980672') as any;
  if (chanSupportVoice) {
    await chanSupportVoice.edit({
      name: '🎧 Support Waiting Room',
      parent: catSupport.id,
      position: 1,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: verifiedRole.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
          ],
        },
        ...getStaffAllowOverrides(),
      ],
    });
    console.log('Updated: 🎧 Support Waiting Room');
  }

  // --- Category 3: Community & Network ---
  // General Chat (1525072103865581629)
  const chanGeneral = guild.channels.cache.get('1525072103865581629') as any;
  if (chanGeneral) {
    await chanGeneral.edit({
      name: '💬・general-discussion',
      parent: catCommunity.id,
      position: 0,
    });
    console.log('Updated: 💬・general-discussion');
  }

  // Showcase Work (1525072174036287618)
  const chanShowcase = guild.channels.cache.get('1525072174036287618') as any;
  if (chanShowcase) {
    await chanShowcase.edit({
      name: '🎨・showcase-work',
      parent: catCommunity.id,
      position: 1,
    });
    console.log('Updated: 🎨・showcase-work');
  }

  // Tech and Ideas (1525072142214103061)
  const chanIdeas = guild.channels.cache.get('1525072142214103061') as any;
  if (chanIdeas) {
    await chanIdeas.edit({
      name: '💡・tech-and-ideas',
      parent: catCommunity.id,
      position: 2,
    });
    console.log('Updated: 💡・tech-and-ideas');
  }

  // Bot Commands (create if not exists)
  let chanBotCmd = guild.channels.cache.find(
    (c) => c.parentId === catCommunity.id && c.name.includes('bot-commands')
  ) as any;
  if (!chanBotCmd) {
    chanBotCmd = await guild.channels.create({
      name: '🤖・bot-commands',
      type: ChannelType.GuildText,
      parent: catCommunity.id,
      position: 3,
    });
    console.log('Created: 🤖・bot-commands');
  } else {
    await chanBotCmd.edit({ name: '🤖・bot-commands', position: 3 });
  }

  // --- Category 4: Development & Updates ---
  // Project Updates (1525072367930314883)
  const chanUpdates = guild.channels.cache.get('1525072367930314883') as any;
  if (chanUpdates) {
    await chanUpdates.edit({
      name: '📌・project-updates',
      parent: catDev.id,
      position: 0,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: verifiedRole.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
          deny: [PermissionFlagsBits.SendMessages],
        },
        ...getStaffAllowOverrides(),
      ],
    });
    console.log('Updated: 📌・project-updates');
  }

  // Bug Reports (1525072391167017043)
  const chanBugs = guild.channels.cache.get('1525072391167017043') as any;
  if (chanBugs) {
    await chanBugs.edit({
      name: '🐞・bug-reports',
      parent: catDev.id,
      position: 1,
    });
    console.log('Updated: 🐞・bug-reports');
  }

  // Feature Requests (1525072419570843729)
  const chanFeatures = guild.channels.cache.get('1525072419570843729') as any;
  if (chanFeatures) {
    await chanFeatures.edit({
      name: '💡・feature-requests',
      parent: catDev.id,
      position: 2,
    });
    console.log('Updated: 💡・feature-requests');
  }

  // --- Category 5: Staff HQ ---
  // Staff Lounge (1525072475837304894)
  const chanStaffLounge = guild.channels.cache.get('1525072475837304894') as any;
  if (chanStaffLounge) {
    await chanStaffLounge.edit({
      name: '🔒・staff-lounge',
      parent: catStaff.id,
      position: 0,
    });
    console.log('Updated: 🔒・staff-lounge');
  }

  // Quotation Leads (create if not exists)
  let chanLeads = guild.channels.cache.find(
    (c) => c.parentId === catStaff.id && c.name.includes('quotation-leads')
  ) as any;
  if (!chanLeads) {
    chanLeads = await guild.channels.create({
      name: '💼・quotation-leads',
      type: ChannelType.GuildText,
      parent: catStaff.id,
      position: 1,
    });
    console.log('Created: 💼・quotation-leads');
  } else {
    await chanLeads.edit({ name: '💼・quotation-leads', position: 1 });
  }

  // Task Management (1525072440013750353)
  const chanTasks = guild.channels.cache.get('1525072440013750353') as any;
  if (chanTasks) {
    await chanTasks.edit({
      name: '📋・task-management',
      parent: catStaff.id,
      position: 2,
    });
    console.log('Updated: 📋・task-management');
  }

  // Active Projects (1525072455759167550)
  const chanProjects = guild.channels.cache.get('1525072455759167550') as any;
  if (chanProjects) {
    await chanProjects.edit({
      name: '📁・active-projects',
      parent: catStaff.id,
      position: 3,
    });
    console.log('Updated: 📁・active-projects');
  }

  // Mod & Audit Logs (create if not exists)
  let chanModLogs = guild.channels.cache.find(
    (c) => c.parentId === catStaff.id && (c.name.includes('mod-and-audit') || c.name.includes('mod-logs'))
  ) as any;
  if (!chanModLogs) {
    chanModLogs = await guild.channels.create({
      name: '🛡️・mod-and-audit-logs',
      type: ChannelType.GuildText,
      parent: catStaff.id,
      position: 4,
    });
    console.log('Created: 🛡️・mod-and-audit-logs');
  } else {
    await chanModLogs.edit({ name: '🛡️・mod-and-audit-logs', position: 4 });
  }

  // Staff VC (1525073576670007387)
  const chanStaffVC = guild.channels.cache.get('1525073576670007387') as any;
  if (chanStaffVC) {
    await chanStaffVC.edit({
      name: '🔒 Staff Lounge VC',
      parent: catStaff.id,
      position: 5,
    });
    console.log('Updated: 🔒 Staff Lounge VC');
  }

  // --- Category 6: Voice Channels ---
  // Community Lounge (1525073420151427192)
  const chanLounge = guild.channels.cache.get('1525073420151427192') as any;
  if (chanLounge) {
    await chanLounge.edit({
      name: '🔊 Community Lounge',
      parent: catVoice.id,
      position: 0,
    });
  }

  // Client Meeting 1 (1525073451155722310)
  const chanClientMeeting1 = guild.channels.cache.get('1525073451155722310') as any;
  if (chanClientMeeting1) {
    await chanClientMeeting1.edit({
      name: '💼 Client Meeting 1',
      parent: catVoice.id,
      position: 1,
      userLimit: 5,
    });
  }

  // Client Meeting 2 (create if needed)
  let chanClientMeeting2 = guild.channels.cache.find(
    (c) => c.parentId === catVoice.id && c.name.includes('Client Meeting 2')
  ) as any;
  if (!chanClientMeeting2) {
    chanClientMeeting2 = await guild.channels.create({
      name: '💼 Client Meeting 2',
      type: ChannelType.GuildVoice,
      parent: catVoice.id,
      position: 2,
      userLimit: 5,
    });
    console.log('Created: 💼 Client Meeting 2');
  }

  // Dev Huddle (1525073475629355099)
  const chanDevHuddle = guild.channels.cache.get('1525073475629355099') as any;
  if (chanDevHuddle) {
    await chanDevHuddle.edit({
      name: '💻 Dev Huddle',
      parent: catVoice.id,
      position: 3,
    });
  }

  // Creative Room (1525073516125356053)
  const chanCreative = guild.channels.cache.get('1525073516125356053') as any;
  if (chanCreative) {
    await chanCreative.edit({
      name: '🎨 Creative Room',
      parent: catVoice.id,
      position: 4,
    });
  }

  // Screen Share (1525073548144676894)
  const chanScreen = guild.channels.cache.get('1525073548144676894') as any;
  if (chanScreen) {
    await chanScreen.edit({
      name: '🖥 Screen Share Lounge',
      parent: catVoice.id,
      position: 5,
    });
  }

  // 4. DEPLOY BRANDED EMBED PANELS
  console.log('\n--- 4. DEPLOYING BRANDED EMBEDS ---');

  // Embed 1: Welcome & Verification
  if (chanWelcome) {
    const welcomeEmbed = new EmbedBuilder()
      .setTitle('✦ SRB STUDIO ✦ CREATIVE & DIGITAL AGENCY')
      .setDescription(
        'Welcome to the official **SRB Studio** server!\n\n' +
        'We craft high-performance **Web Applications**, bespoke **Discord Bots**, and intuitive **UI/UX Designs** tailored for creators, startups, and enterprises.\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
        '### 🚀 Quick Start Guide\n' +
        `• **Guidelines:** Read our policies in ${chanRules}\n` +
        `• **Services:** Explore our tech stack in ${chanServices}\n` +
        `• **Showcase:** See past deliveries in ${chanPortfolio}\n` +
        `• **Get a Quote:** Open a website quotation in ${chanQuote}\n` +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '🔒 **Verification Gate:**\n' +
        'Click the **Verify & Enter Studio** button below to complete verification and unlock community & client channels.'
      )
      .setColor('#5865F2')
      .setImage('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80')
      .setFooter({ text: 'SRB Studio • Automated Security Verification', iconURL: guild.iconURL() || undefined });

    const verifyRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('nexus_verify_member')
        .setLabel('✅ Verify & Enter Studio')
        .setStyle(ButtonStyle.Success)
    );

    await chanWelcome.send({
      embeds: [welcomeEmbed],
      components: [verifyRow],
    });
    console.log('✅ Deployed Verification Panel to #👋・welcome-and-verify');
  }

  // Embed 2: Rules & Guidelines
  if (chanRules) {
    const rulesEmbed = new EmbedBuilder()
      .setTitle('📜 SRB STUDIO ✦ COMMUNITY & CLIENT POLICIES')
      .setDescription(
        'To ensure a professional and collaborative environment, all members and clients are expected to uphold the following guidelines:\n\n' +
        '**1. Professional Conduct & Mutual Respect**\n' +
        'Treat every team member and client with respect. Toxic behavior, hate speech, or harassment is strictly prohibited.\n\n' +
        '**2. No Unauthorized Promotion or DM Spam**\n' +
        'Do not advertise external services, post affiliate links, or mass DM members without prior admin approval.\n\n' +
        '**3. Legitimate Inquiries & Quotes Only**\n' +
        'Our quotation and inquiry ticket systems are reserved for active clients and serious project discussions. Please do not create troll tickets.\n\n' +
        '**4. Confidentiality & Privacy**\n' +
        'Client deliverables, code repositories, and proprietary discussions are protected. Leaking project specifications will result in immediate bans.\n\n' +
        '**5. Discord Terms of Service**\n' +
        'Adhere to all Discord Terms of Service and Community Guidelines at all times.'
      )
      .setColor('#2B2D31')
      .setFooter({ text: 'SRB Studio • Enforced by Nexus Security' });

    await chanRules.send({ embeds: [rulesEmbed] });
    console.log('✅ Deployed Rules Panel to #📜・rules-guidelines');
  }

  // Embed 3: Services & Pricing
  if (chanServices) {
    const servicesEmbed = new EmbedBuilder()
      .setTitle('🚀 SRB STUDIO ✦ SERVICES & CAPABILITIES')
      .setDescription(
        'At **SRB Studio**, we engineer digital experiences that drive growth, engagement, and conversion.\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
      )
      .addFields(
        {
          name: '🌐 Full-Stack Web Development',
          value:
            '• High-performance Next.js 14 / React applications\n' +
            '• Tailored E-Commerce, SaaS & Web Portals\n' +
            '• Responsive, mobile-first design with TailwindCSS\n' +
            '• SEO-optimized, ultra-fast Lighthouse metrics',
        },
        {
          name: '🤖 Custom Discord Bots & Infrastructure',
          value:
            '• Enterprise Discord bots with TypeScript & Discord.js\n' +
            '• Advanced ticket systems, quotation modals & payment hooks\n' +
            '• Anti-raid security, moderation logging & auto-moderation\n' +
            '• PostgreSQL / Neon database architecture & Redis caching',
        },
        {
          name: '🎨 UI / UX & Brand Design',
          value:
            '• Modern Figma prototypes and interactive wireframes\n' +
            '• Complete brand identity, logos & digital asset systems\n' +
            '• User flow optimization and high-conversion UX',
        },
        {
          name: '⚡ DevOps & Cloud Hosting',
          value:
            '• Docker containerization, CI/CD automated deployment\n' +
            '• 24/7 uptime monitoring and automated daily backups\n' +
            '• SSL certification, cloud security & CDN acceleration',
        }
      )
      .setColor('#5865F2')
      .setFooter({ text: 'SRB Studio • Ready to launch? Request a quote below!' });

    await chanServices.send({ embeds: [servicesEmbed] });
    console.log('✅ Deployed Services Panel to #🚀・services-pricing');
  }

  // Embed 4: Portfolio Showcase Intro
  if (chanPortfolio) {
    const portfolioEmbed = new EmbedBuilder()
      .setTitle('💼 SRB STUDIO ✦ SHOWCASE & CASE STUDIES')
      .setDescription(
        'Welcome to our project gallery! Here we highlight recent projects delivered by the SRB Studio engineering team.\n\n' +
        'Browse through our work, inspect live website architectures, and see the standard of quality we bring to every client engagement.\n\n' +
        '💡 *Have a project in mind? Submit your requirements in `#💡・request-a-quote` for an interactive proposal!*'
      )
      .setColor('#00E5FF')
      .setFooter({ text: 'SRB Studio • Quality & Excellence' });

    await chanPortfolio.send({ embeds: [portfolioEmbed] });
    console.log('✅ Deployed Portfolio Panel to #💼・portfolio');
  }

  // Embed 5: Client Reviews
  if (chanReviews) {
    const reviewsEmbed = new EmbedBuilder()
      .setTitle('⭐ SRB STUDIO ✦ CLIENT REVIEWS & VOUCHES')
      .setDescription(
        'Welcome to our client vouch and testimonial board!\n\n' +
        'If you have worked with **SRB Studio** on a website, bot, or design project, please feel free to leave your honest feedback here:\n\n' +
        '• **Rating:** ⭐⭐⭐⭐⭐ (1-5 Stars)\n' +
        '• **Project Type:** Website / Bot / UI-UX\n' +
        '• **Experience:** Communication, turnaround time & quality\n\n' +
        'Thank you for partnering with SRB Studio!'
      )
      .setColor('#FEE75C')
      .setFooter({ text: 'SRB Studio • Client Trust & Satisfaction' });

    await chanReviews.send({ embeds: [reviewsEmbed] });
    console.log('✅ Deployed Reviews Panel to #⭐・client-reviews');
  }

  // Embed 6: Staff Quotation Leads Info
  if (chanLeads) {
    const leadsEmbed = new EmbedBuilder()
      .setTitle('💼 STAFF HQ ✦ CLIENT LEADS & TICKET STREAM')
      .setDescription(
        'This channel receives real-time alerts whenever a client:\n' +
        '1️⃣ Submits a **Website Quotation Request** via `#💡・request-a-quote`\n' +
        '2️⃣ Opens a **Project Inquiry** via `#📩・project-inquiry`\n\n' +
        'Staff members can click the ticket channel link to jump directly to the client discussion.'
      )
      .setColor('#9B59B6')
      .setFooter({ text: 'SRB Studio Internal • Confidential' });

    await chanLeads.send({ embeds: [leadsEmbed] });
    console.log('✅ Deployed Leads Info to #💼・quotation-leads');
  }

  // Auto-assign Verified role to owner if not already present
  try {
    const ownerMember = await guild.members.fetch('1525076160990543892').catch(async () => {
      const owner = await guild.fetchOwner();
      return owner;
    });
    if (ownerMember && !ownerMember.roles.cache.has(verifiedRole.id)) {
      await ownerMember.roles.add(verifiedRole);
      console.log(`Assigned Verified Member role to Owner (${ownerMember.user.tag})`);
    }
  } catch (e) {
    console.log('Owner role check skipped');
  }

  console.log('\n🎉 DISCORD SERVER REWORK COMPLETED SUCCESSFULLY!');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Error executing server rework:', err);
  process.exit(1);
});
