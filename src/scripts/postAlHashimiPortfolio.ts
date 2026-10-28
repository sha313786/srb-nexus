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
const CHANNEL_ID = '1525066567103287396'; // 💼・portfolio

async function main() {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  });

  await client.login(process.env.DISCORD_TOKEN);
  console.log(`Logged in as ${client.user?.tag}`);

  const guild = await client.guilds.fetch(GUILD_ID);
  const chan = (await guild.channels.fetch(CHANNEL_ID)) as TextChannel;
  if (!chan) {
    throw new Error(`Channel ${CHANNEL_ID} not found.`);
  }

  // Fetch recent messages to see if Al Hashimi is already posted
  const messages = await chan.messages.fetch({ limit: 20 });
  const existingMsg = messages.find(
    (m) =>
      m.author.id === client.user?.id &&
      m.embeds.some((e) => e.title?.includes('Al Hashimi') || e.description?.includes('Al Hashimi'))
  );

  const embed = new EmbedBuilder()
    .setAuthor({
      name: 'SRB STUDIO ✦ FEATURED CASE STUDY',
      iconURL: 'https://alhashimillc.com/alhashimi-logo.png',
    })
    .setTitle('⚡ Al Hashimi LLC — Corporate Engineering & DEWA Contractor Portal')
    .setColor('#F59E0B') // Luxury Amber Gold matching DEWA Golden Category & Al Hashimi brand
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
    .setImage('https://alhashimillc.com/dewa-award-holder.jpg')
    .setFooter({
      text: 'SRB Studio • Engineered for Enterprise Performance',
      iconURL: guild.iconURL() || client.user?.displayAvatarURL(),
    })
    .setTimestamp();

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
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

  if (existingMsg) {
    console.log(`Updating existing Al Hashimi message: ${existingMsg.id}`);
    await existingMsg.edit({ embeds: [embed], components: [actionRow] });
    console.log(`✅ Successfully updated Al Hashimi portfolio post in #${chan.name}!`);
  } else {
    console.log(`Posting new Al Hashimi showcase to #${chan.name}...`);
    const sent = await chan.send({ embeds: [embed], components: [actionRow] });
    console.log(`✅ Successfully published Al Hashimi portfolio post (ID: ${sent.id}) to #${chan.name}!`);
  }

  client.destroy();
  process.exit(0);
}

main().catch((err) => {
  console.error('Error posting Al Hashimi portfolio post:', err);
  process.exit(1);
});
