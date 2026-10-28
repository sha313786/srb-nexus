const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} = require('discord.js');
const { Pool } = require('pg');
require('dotenv').config({ path: 'I:/srb-nexus/.env' });

async function postProjectDetails() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = new Client({ 
    intents: [
      GatewayIntentBits.Guilds, 
      GatewayIntentBits.GuildMessages
    ] 
  });

  await client.login(process.env.DISCORD_TOKEN);
  const guild = await client.guilds.fetch('1525065834572021851');
  const channel = await guild.channels.fetch('1564341217477664920');

  if (!channel || !channel.isTextBased()) {
    console.error('Channel not found or not text-based');
    process.exit(1);
  }

  console.log(`Target channel: #${channel.name} (${channel.id})`);

  // 1. Embed: Client Workspace Welcome & Official Credentials
  const welcomeEmbed = new EmbedBuilder()
    .setTitle('🤝 CLIENT WORKSPACE ・ KACHORAS CONTRACTING LLC')
    .setDescription(
      `Welcome to your dedicated private workspace with **SRB Studio**!\n\n` +
      `This channel serves as the central hub for all technical deliverables, revisions, milestone tracking, and direct developer communication for **Kachoras Electromechanical Contracting LLC**.\n\n` +
      `─────────────────────────────────────────────`
    )
    .addFields(
      {
        name: '📌 Client / Organization',
        value: '**Kachoras Electromechanical Contracting LLC**\n*(كاشوراس للمقاولات الكهروميكانيكية ش.ذ.م.م)*',
        inline: true,
      },
      {
        name: '🛡️ Handled By',
        value: '**SRB Studio Team**',
        inline: true,
      },
      {
        name: '🎙️ Client Meeting Room',
        value: '<#1564341220522860594>',
        inline: true,
      },
      {
        name: '🏛️ Verified Enterprise Credentials',
        value:
          '• **Licensing:** Dubai Municipality G+1 Approved Building Contractor\n' +
          '• **DET Commercial License:** `578964` | **Register:** `2148781`\n' +
          '• **DCCI Registry:** `169651` | **D-U-N-S:** `561419908`\n' +
          '• **Location:** Warehouse B-25, Bin Sougat Complex, Al Qusais 1, Dubai, UAE\n' +
          '• **Established:** 2006 (Dubai, United Arab Emirates)',
        inline: false,
      },
      {
        name: '🔒 Workspace Communication & No-DM Policy',
        value:
          '• **All communications must stay within this dedicated channel.**\n' +
          '• **No Personal DMs:** Staff members do **not** take feature requests or bug fixes in private messages.\n' +
          '• **Visibility & Turnaround:** Centralizing updates here ensures engineering, management, and design leads have complete clarity.',
        inline: false,
      }
    )
    .setColor('#00E5FF')
    .setTimestamp();

  // 2. Embed: Project Dossier & Architecture Specifications
  const projectEmbed = new EmbedBuilder()
    .setTitle('🏛️ PROJECT SPECIFICATION & TECHNICAL DELIVERABLES')
    .setDescription(
      `**Digital Web Architecture & Estimating Portal** built from scratch by **SRB Studio** for **Kachoras Contracting LLC**.\n\n` +
      `The platform delivers an ultra-premium Dubai luxury contractor aesthetic with instantaneous load speeds, dual-mode architectural photo & CAD blueprint visuals, and an interactive RFQ intake engine.`
    )
    .addFields(
      {
        name: '🌐 Live Deployment URL',
        value: '[srbstudiosofficial.github.io/Kachoras](https://srbstudiosofficial.github.io/Kachoras/)',
        inline: true,
      },
      {
        name: '📂 Source Code Repository',
        value: '[github.com/srbstudiosofficial/Kachoras](https://github.com/srbstudiosofficial/Kachoras)',
        inline: true,
      },
      {
        name: '⚡ Current Status',
        value: '`🟢 Production Staging Live`',
        inline: true,
      },
      {
        name: '🎨 Design Identity & Palette',
        value:
          '• **Imperial Bronze:** `#7A2E16` *(Signature luxury shade)*\n' +
          '• **Champagne Gold:** `#C59B27` *(Accent trims & highlights)*\n' +
          '• **Warm Ivory:** `#FBF9F5` *(Clean architectural background)*\n' +
          '• **Slate Gray:** `#1E293B` *(High-legibility typography)*',
        inline: false,
      },
      {
        name: '🏗️ Portfolio Modules & Key Deliverables',
        value:
          '• **G+1 Luxury Villas & Majlis Blocks:** Detailed showcase with genuine Dubai plot numbers and approved consultants (*Croquis, Al Manhal, Al Majal*).\n' +
          '• **MEP & Specialized Infrastructure:** HVAC, sub-station transformers, water filtration, and pump station engineering.\n' +
          '• **Dubai Municipality Maintenance:** Civic infrastructure maintenance and glass-reinforced concrete (GRC) fit-outs.\n' +
          '• **Estimating & RFQ Intake Module:** Digital lead capture for project proposals, soil reports, and CAD drawings.\n' +
          '• **Leadership Directory:** Verified 11-member engineering leadership roster with direct phone and WhatsApp routing.',
        inline: false,
      },
      {
        name: '🛠️ Technology Stack',
        value: '`React 18` • `Vite` • `Tailwind CSS` • `Lucide Icons` • `Node.js / Express RFQ Engine` • `Zero CDN Dependencies`',
        inline: false,
      }
    )
    .setColor('#7A2E16')
    .setImage('https://srbstudiosofficial.github.io/Kachoras/assets/villa.jpg')
    .setFooter({
      text: 'SRB Studio • Bespoke Web Architecture & Enterprise Engineering',
      iconURL: guild.iconURL() || undefined,
    })
    .setTimestamp();

  // 3. Action Row with interactive buttons
  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Visit Live Website')
      .setEmoji('🌐')
      .setStyle(ButtonStyle.Link)
      .setURL('https://srbstudiosofficial.github.io/Kachoras/'),
    new ButtonBuilder()
      .setLabel('Source Repository')
      .setEmoji('📂')
      .setStyle(ButtonStyle.Link)
      .setURL('https://github.com/srbstudiosofficial/Kachoras'),
    new ButtonBuilder()
      .setCustomId('nexus_close_ticket')
      .setLabel('Archive Workspace')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Secondary)
  );

  // Send messages to channel
  const sentMessage = await channel.send({
    embeds: [welcomeEmbed, projectEmbed],
    components: [actionRow],
  });

  // Pin for quick access by client and staff
  await sentMessage.pin().catch(() => {});
  console.log(`Successfully posted and pinned project details to #${channel.name}`);

  // Track in database
  await pool.query(
    `INSERT INTO guild_tickets (guild_id, channel_id, user_id, status, ticket_type, project_type, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (channel_id) DO UPDATE SET
       project_type = EXCLUDED.project_type,
       details = EXCLUDED.details,
       status = EXCLUDED.status`,
    [
      guild.id,
      channel.id,
      '552477528309235723',
      'ACTIVE_CLIENT',
      'CLIENT_WORKSPACE',
      'Corporate Web Portal & Civil MEP Architecture',
      'Kachoras Electromechanical Contracting LLC — Dubai Municipality G+1 Approved Contractor (License #578964). Live at https://srbstudiosofficial.github.io/Kachoras/'
    ]
  ).catch(err => console.error('DB tracking error:', err));

  console.log('Database tracking record updated.');

  await client.destroy();
  await pool.end();
}

postProjectDetails().catch(console.error);
