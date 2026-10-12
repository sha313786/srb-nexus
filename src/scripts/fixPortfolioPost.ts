import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
} from 'discord.js';
import * as dotenv from 'dotenv';
dotenv.config();

const GUILD_ID = '1525065834572021851';
const CHANNEL_ID = '1525066567103287396';
const MESSAGE_ID = '1559148840647524393';

async function main() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(process.env.DISCORD_TOKEN);

  const guild = await client.guilds.fetch(GUILD_ID);
  const chan = (await guild.channels.fetch(CHANNEL_ID)) as TextChannel;
  const msg = await chan.messages.fetch(MESSAGE_ID);

  const embed = new EmbedBuilder()
    .setAuthor({
      name: 'SRB STUDIO ✦ FEATURED CASE STUDY',
      iconURL: 'https://denbooks.in/logo.png',
    })
    .setTitle('🌐 DenBooks — Operating Suite for Citizen Service Centers')
    .setColor('#00E5FF')
    .setDescription(
      '**📝 Project Overview:**\n' +
      'A production-grade, specialized cloud ERP and POS operating suite purpose-built for **Akshaya E-Centres, CSC Digital Seva, Jan Seva Kendras, and Cyber Cafes** across India. Solves the complex accounting challenge of isolating government portal wallet pass-through charges from true shop revenue.\n\n' +
      '**🛠️ Tech Stack & Architecture:**\n' +
      '`Next.js 14 (App Router)` • `React 19` • `TypeScript` • `TailwindCSS` • `PostgreSQL` • `ESC/POS Engine`\n\n' +
      '**⭐ Core Engineering Deliverables:**\n' +
      '• 💼 **Pass-Through Fee Isolation:** Automatically separates government wallet liabilities (Passport Seva, e-District, Sarathi, BBPS) from real front-desk profits.\n' +
      '• 🖨️ **58mm & 80mm Thermal POS Engine:** Sub-second thermal receipt printing with multilingual support (Malayalam, Hindi, Tamil, English) & dynamic UPI QR codes.\n' +
      '• 👥 **Multi-Staff & Shift Drawer Tally:** Isolated counter operator logins with PIN security and end-of-shift cash drawer balance reconciliation.\n' +
      '• 📱 **Automated WhatsApp Khata:** 1-Click credit reminder engine with direct UPI QR settlement links.\n' +
      '• ⚡ **FCFS Token Queue System:** Rush-hour sequential token numbers with instant 1-tap invoice conversion.\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '💡 *Need a custom SaaS, web application, or management portal for your business? Click **Request Similar Platform** below!*'
    )
    .setImage('https://denbooks.in/brand-poster.png')
    .setFooter({
      text: 'SRB Studio • Engineered for High-Volume Production',
      iconURL: guild.iconURL() || client.user?.displayAvatarURL(),
    })
    .setTimestamp();

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
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

  await msg.edit({ embeds: [embed], components: [actionRow] });
  console.log('✅ Successfully edited message 1559148840647524393 with clean formatting and code badges!');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
