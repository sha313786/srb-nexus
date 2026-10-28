import {
  Client,
  GatewayIntentBits,
  ChannelType,
  ForumLayoutType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  TextChannel,
  ForumChannel,
} from 'discord.js';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config();

const GUILD_ID = '1525065834572021851';
const OLD_PORTFOLIO_CHANNEL_ID = '1525066567103287396';
const WELCOME_CHANNEL_ID = '1525066482160238724';
const WELCOME_MESSAGE_ID = '1559123386087768085';
const CATEGORY_ID = '1525066374206984192'; // 📌 INFORMATION & ONBOARDING

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

const IMAGES_DIR = 'I:\\SRB STUDIOS\\assets\\images';

async function main() {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  });

  await client.login(process.env.DISCORD_TOKEN);
  console.log(`🚀 Logged in as ${client.user?.tag}`);

  const guild = await client.guilds.fetch(GUILD_ID);
  if (!guild) throw new Error(`Guild ${GUILD_ID} not found.`);
  await guild.roles.fetch();

  // 1. Build Permission Overwrites for Forum Channel
  const permissionOverwrites = [
    {
      id: ROLES.EVERYONE,
      type: 0,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: ROLES.VERIFIED_MEMBER,
      type: 0,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.SendMessagesInThreads,
        PermissionFlagsBits.AddReactions,
      ],
      deny: [
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.CreatePublicThreads,
        PermissionFlagsBits.CreatePrivateThreads,
      ],
    },
    {
      id: ROLES.CLIENT,
      type: 0,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.SendMessagesInThreads,
        PermissionFlagsBits.AddReactions,
      ],
      deny: [
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.CreatePublicThreads,
        PermissionFlagsBits.CreatePrivateThreads,
      ],
    },
    {
      id: ROLES.VIP_CLIENT,
      type: 0,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.SendMessagesInThreads,
        PermissionFlagsBits.AddReactions,
      ],
      deny: [
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.CreatePublicThreads,
        PermissionFlagsBits.CreatePrivateThreads,
      ],
    },
    ...staffRoleIds.map((id) => ({
      id,
      type: 0,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.SendMessagesInThreads,
        PermissionFlagsBits.CreatePublicThreads,
        PermissionFlagsBits.CreatePrivateThreads,
        PermissionFlagsBits.ManageThreads,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.AddReactions,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    })),
  ];

  // 2. Create the Forum Channel in Gallery View Mode
  console.log('📦 Creating new Gallery-View Forum Channel: 💼・portfolio...');
  const forum = (await guild.channels.create({
    name: '💼・portfolio',
    type: ChannelType.GuildForum,
    parent: CATEGORY_ID,
    position: 4,
    defaultForumLayout: ForumLayoutType.GalleryView,
    topic: 'Official SRB Studio Project Showcase & Case Studies Gallery. Explore live builds and request custom solutions.',
    permissionOverwrites,
    availableTags: [
      { name: 'Corporate & MEP', emoji: { id: null, name: '🏢' } },
      { name: 'Cloud ERP & POS', emoji: { id: null, name: '⚡' } },
      { name: 'Discord Platform', emoji: { id: null, name: '🤖' } },
      { name: 'Full-Stack Web', emoji: { id: null, name: '🌐' } },
    ],
  })) as ForumChannel;

  console.log(`✅ Created Forum Channel: ${forum.id} (Gallery View Layout)`);

  const tagMap = new Map(forum.availableTags.map((t) => [t.name, t.id]));

  // --- CARD 1: Al Hashimi LLC ---
  console.log('📌 Creating Post: Al Hashimi LLC...');
  const alhashimiFile = new AttachmentBuilder(path.join(IMAGES_DIR, 'alhashimi-poster.png'), {
    name: 'alhashimi-poster.png',
  });
  const alhashimiLogo = new AttachmentBuilder(path.join(IMAGES_DIR, 'alhashimi-logo.png'), {
    name: 'alhashimi-logo.png',
  });

  const alhashimiEmbed = new EmbedBuilder()
    .setAuthor({
      name: 'SRB STUDIO ✦ FEATURED CASE STUDY',
      iconURL: 'attachment://alhashimi-logo.png',
    })
    .setTitle('⚡ Al Hashimi LLC — Corporate Engineering & DEWA Contractor Portal')
    .setColor('#F59E0B')
    .setDescription(
      '**📝 Project Overview:**\n' +
      'An enterprise institutional digital presence engineered for **Al Hashimi Electrical Installation Works LLC** — Dubai\'s premier **DEWA Golden Category 1st Place MEP Contractor** (established 1988). Built with custom zero-bloat architecture, lightning sub-0.4s load times, and interactive engineering tools.\n\n' +
      '**⭐ Core Engineering Deliverables:**\n' +
      '• ⚡ **Interactive DEWA Connected Load Estimator:** Instant calculation of connected electrical loads, diversified maximum demand (MD), and 11kV substation requirements complying with DEWA Circular 16/2017.\n' +
      '• 🏢 **80+ Approved Authority Directory:** Fully searchable and filterable directory cataloging Dubai\'s top engineering consultants, master developers, and government authorities.\n' +
      '• 📜 **Instant Credentials & License Verification:** Direct digital verification of DEWA 1st Place awards, commercial trade licenses, and safety compliance accreditations.\n' +
      '• 📑 **Automated RFQ & Quotation Intake:** Frictionless commercial tender pipeline converting enterprise project inquiries directly into actionable engineering scopes.\n' +
      '• 🚀 **Sub-0.4s Global Edge Performance:** 100/100 Core Web Vitals, ultra-responsive across all desktop and mobile devices.\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '💡 *Need a custom corporate web platform, specialized engineering tool, or enterprise portal? Click **Request Similar Platform** below!*'
    )
    .setImage('attachment://alhashimi-poster.png')
    .setFooter({
      text: 'SRB Studio • Engineered for Enterprise Performance',
      iconURL: guild.iconURL() || client.user?.displayAvatarURL(),
    })
    .setTimestamp();

  const alhashimiRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel('Visit Live Platform')
      .setEmoji('🔗')
      .setStyle(ButtonStyle.Link)
      .setURL('https://alhashimillc.com/'),
    new ButtonBuilder()
      .setLabel('Try DEWA Estimator')
      .setEmoji('⚡')
      .setStyle(ButtonStyle.Link)
      .setURL('https://alhashimillc.com/#calculator'),
    new ButtonBuilder()
      .setCustomId('nexus_quote_ticket_create')
      .setLabel('Request Similar Platform')
      .setEmoji('💡')
      .setStyle(ButtonStyle.Success)
  );

  const alhashimiTagId = tagMap.get('Corporate & MEP');
  await forum.threads.create({
    name: 'Al Hashimi LLC — DEWA 1st Place MEP & Engineering Portal',
    appliedTags: alhashimiTagId ? [alhashimiTagId] : [],
    message: {
      content: '🏢 **Al Hashimi Electrical Installation Works LLC** — Official Dubai Corporate Portal',
      files: [alhashimiFile, alhashimiLogo],
      embeds: [alhashimiEmbed],
      components: [alhashimiRow],
    },
  });

  // --- CARD 2: DenBooks 360 ---
  console.log('📌 Creating Post: DenBooks 360...');
  const denbooksFile = new AttachmentBuilder(path.join(IMAGES_DIR, 'denbooks-poster.png'), {
    name: 'denbooks-poster.png',
  });
  const denbooksLogo = new AttachmentBuilder(path.join(IMAGES_DIR, 'denbooks-logo.png'), {
    name: 'denbooks-logo.png',
  });

  const denbooksEmbed = new EmbedBuilder()
    .setAuthor({
      name: 'SRB STUDIO ✦ FEATURED CASE STUDY',
      iconURL: 'attachment://denbooks-logo.png',
    })
    .setTitle('🌐 DenBooks 360 — Operating Suite for Citizen Service Centers')
    .setColor('#00E5FF')
    .setDescription(
      '**📝 Project Overview:**\n' +
      'A production-grade, specialized cloud ERP and POS operating suite purpose-built for **Akshaya E-Centres, CSC Digital Seva, Jan Seva Kendras, and Cyber Cafes** across India. Solves the complex accounting challenge of isolating government portal wallet pass-through charges from true shop revenue.\n\n' +
      '**⭐ Core Engineering Deliverables:**\n' +
      '• 💼 **Pass-Through Fee Isolation:** Automatically separates government wallet liabilities (Passport Seva, e-District, Sarathi, BBPS) from real front-desk profits.\n' +
      '• 🖨️ **58mm & 80mm Thermal POS Engine:** Sub-second thermal receipt printing with multilingual support (Malayalam, Hindi, Tamil, English) & dynamic UPI QR codes.\n' +
      '• 👥 **Multi-Staff & Shift Drawer Tally:** Isolated counter operator logins with PIN security and end-of-shift cash drawer balance reconciliation.\n' +
      '• 📱 **Automated WhatsApp Khata:** 1-Click credit reminder engine with direct UPI QR settlement links.\n' +
      '• ⚡ **FCFS Token Queue System:** Rush-hour sequential token numbers with instant 1-tap invoice conversion.\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '💡 *Need a custom SaaS, web application, or management portal for your business? Click **Request Similar Platform** below!*'
    )
    .setImage('attachment://denbooks-poster.png')
    .setFooter({
      text: 'SRB Studio • Engineered for High-Volume Production',
      iconURL: guild.iconURL() || client.user?.displayAvatarURL(),
    })
    .setTimestamp();

  const denbooksRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel('Visit DenBooks Live')
      .setEmoji('🔗')
      .setStyle(ButtonStyle.Link)
      .setURL('https://denbooks.in'),
    new ButtonBuilder()
      .setLabel('Explore Live Sandbox')
      .setEmoji('🎮')
      .setStyle(ButtonStyle.Link)
      .setURL('https://denbooks.in/demo'),
    new ButtonBuilder()
      .setCustomId('nexus_quote_ticket_create')
      .setLabel('Request Similar Platform')
      .setEmoji('💡')
      .setStyle(ButtonStyle.Success)
  );

  const denbooksTagId = tagMap.get('Cloud ERP & POS');
  await forum.threads.create({
    name: 'DenBooks 360 — Financial ERP & Citizen POS Suite',
    appliedTags: denbooksTagId ? [denbooksTagId] : [],
    message: {
      content: '⚡ **DenBooks 360** — Specialized Cloud Operating Suite for CSC & Akshaya Centers',
      files: [denbooksFile, denbooksLogo],
      embeds: [denbooksEmbed],
      components: [denbooksRow],
    },
  });

  // --- CARD 3: SRB NEXUS ---
  console.log('📌 Creating Post: SRB NEXUS...');
  const nexusFile = new AttachmentBuilder(path.join(IMAGES_DIR, 'nexus-poster.png'), {
    name: 'nexus-poster.png',
  });
  const nexusLogo = new AttachmentBuilder(path.join(IMAGES_DIR, 'nexus-logo.png'), {
    name: 'nexus-logo.png',
  });

  const nexusEmbed = new EmbedBuilder()
    .setAuthor({
      name: 'SRB STUDIO ✦ FEATURED CASE STUDY',
      iconURL: 'attachment://nexus-logo.png',
    })
    .setTitle('🚀 SRB NEXUS — Multi-Tenant Discord Automation & Cloud Platform')
    .setColor('#5865F2')
    .setDescription(
      '**📝 Project Overview:**\n' +
      'All-in-one Discord infrastructure and community management suite engineered with Discord.js v14, Fastify REST APIs, and indexed PostgreSQL. Delivers automated raid defense, real-time analytics, and private client workspace provisioning.\n\n' +
      '**⭐ Core Engineering Deliverables:**\n' +
      '• 🛡️ **Automated Raid Defense & Anti-Nuke:** Intelligent multi-layer spam catcher shielding servers from unauthorized bulk pings and rogue actions.\n' +
      '• 📊 **Real-Time Invite Analytics:** Precision tracking with automated role progression and invite attribution.\n' +
      '• 🎫 **Interactive Support & Ticket Desks:** Automated ticket creation with cloud HTML transcripts and staff assignment.\n' +
      '• 🎵 **High-Fidelity Audio Engine:** Real-time 1-second cadence progress ticker with rate limit backoff and continuous playback.\n' +
      '• 🌐 **Private Client Space Generator:** 1-Click creation of private client categories, text desks, and voice lounges.\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '💡 *Need a custom Discord bot, community automation platform, or API backend? Click **Request Similar Platform** below!*'
    )
    .setImage('attachment://nexus-poster.png')
    .setFooter({
      text: 'SRB Studio • Engineered for Scalable Communities',
      iconURL: guild.iconURL() || client.user?.displayAvatarURL(),
    })
    .setTimestamp();

  const nexusRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel('Live Web Dashboard')
      .setEmoji('🔗')
      .setStyle(ButtonStyle.Link)
      .setURL('https://srb-nexus-eyaj.onrender.com/'),
    new ButtonBuilder()
      .setCustomId('nexus_quote_ticket_create')
      .setLabel('Request Custom Discord Bot')
      .setEmoji('💡')
      .setStyle(ButtonStyle.Success)
  );

  const nexusTagId = tagMap.get('Discord Platform');
  await forum.threads.create({
    name: 'SRB NEXUS — Next-Gen Web Dashboard & Discord Suite',
    appliedTags: nexusTagId ? [nexusTagId] : [],
    message: {
      content: '🤖 **SRB NEXUS** — Flagship Discord Automation & Web Dashboard Platform',
      files: [nexusFile, nexusLogo],
      embeds: [nexusEmbed],
      components: [nexusRow],
    },
  });

  // --- CARD 4: Digital Den 360 ---
  console.log('📌 Creating Post: Digital Den 360...');
  const ddFile = new AttachmentBuilder(path.join(IMAGES_DIR, 'digital-den-poster.png'), {
    name: 'digital-den-poster.png',
  });
  const ddLogo = new AttachmentBuilder(path.join(IMAGES_DIR, 'digital-den-logo.jpg'), {
    name: 'digital-den-logo.jpg',
  });

  const ddEmbed = new EmbedBuilder()
    .setAuthor({
      name: 'SRB STUDIO ✦ FEATURED CASE STUDY',
      iconURL: 'attachment://digital-den-logo.jpg',
    })
    .setTitle('🚀 DIGITAL DEN 360 — Full-Stack Solutions Hub')
    .setColor('#00E5FF')
    .setDescription(
      '**📝 Project Overview:**\n' +
      'A digital services platform designed to streamline citizen online application workflows, automated utility payment handling, and fast document processing with zero friction.\n\n' +
      '**⭐ Core Engineering Deliverables:**\n' +
      '• 🌐 **Essential Online Services:** Online application submissions, document prep & citizen portal workflows.\n' +
      '• 🖨️ **Document Handling & Printing:** High-speed document processing, scanning, and receipt printing.\n' +
      '• 💳 **Utility & Bill Payments:** Secure digital payment assistance for everyday customer transactions.\n' +
      '• 🤖 **Ask Rizu AI Assistance:** Integrated smart assistant helping customers navigate digital services.\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '💡 *Interested in a similar build? Click **Request Similar Project** below to get an instant quotation!*'
    )
    .setImage('attachment://digital-den-poster.png')
    .setFooter({
      text: 'SRB Studio • Quality & High-Performance Engineering',
      iconURL: guild.iconURL() || client.user?.displayAvatarURL(),
    })
    .setTimestamp();

  const ddRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel('Visit Live Demo')
      .setEmoji('🔗')
      .setStyle(ButtonStyle.Link)
      .setURL('https://digital-den-gamma.vercel.app/'),
    new ButtonBuilder()
      .setCustomId('nexus_quote_ticket_create')
      .setLabel('Request Similar Project')
      .setEmoji('💡')
      .setStyle(ButtonStyle.Success)
  );

  const ddTagId = tagMap.get('Full-Stack Web');
  await forum.threads.create({
    name: 'Digital Den 360 — Citizen Digital Solutions Hub',
    appliedTags: ddTagId ? [ddTagId] : [],
    message: {
      content: '🌐 **DIGITAL DEN 360** — Online Citizen Services & Utility Portal',
      files: [ddFile, ddLogo],
      embeds: [ddEmbed],
      components: [ddRow],
    },
  });

  // 3. Update the Welcome Message in #welcome-and-verify with the new Forum Channel mention
  try {
    const welcomeChan = (await guild.channels.fetch(WELCOME_CHANNEL_ID)) as TextChannel;
    if (welcomeChan) {
      const welcomeMsg = await welcomeChan.messages.fetch(WELCOME_MESSAGE_ID);
      if (welcomeMsg && welcomeMsg.embeds.length > 0) {
        const oldEmbed = welcomeMsg.embeds[0];
        const updatedDesc = oldEmbed.description?.replace(
          `<#${OLD_PORTFOLIO_CHANNEL_ID}>`,
          `<#${forum.id}>`
        );
        if (updatedDesc) {
          const updatedEmbed = EmbedBuilder.from(oldEmbed).setDescription(updatedDesc);
          await welcomeMsg.edit({ embeds: [updatedEmbed] });
          console.log(`✅ Updated Welcome message in #${welcomeChan.name} to point to new Forum Channel!`);
        }
      }
    }
  } catch (err: any) {
    console.warn(`⚠️ Could not update welcome message: ${err.message}`);
  }

  // 4. Clean up / delete the old text channel
  try {
    const oldChan = await guild.channels.fetch(OLD_PORTFOLIO_CHANNEL_ID);
    if (oldChan) {
      await oldChan.delete('Replaced with new visual Forum Gallery Portfolio');
      console.log(`🗑️ Successfully removed old text channel ${OLD_PORTFOLIO_CHANNEL_ID}`);
    }
  } catch (err: any) {
    console.warn(`⚠️ Could not delete old channel: ${err.message}`);
  }

  console.log(`\n🎉 All done! New Forum Gallery Portfolio is now LIVE at <#${forum.id}>!`);
  client.destroy();
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error deploying forum portfolio:', err);
  process.exit(1);
});
