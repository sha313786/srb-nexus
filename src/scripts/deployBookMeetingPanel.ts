import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import * as dotenv from 'dotenv';
dotenv.config();

const GUILD_ID = '1525065834572021851';
const MEETING_CHANNEL_ID = '1525071962437582908'; // #📅・book-a-meeting

async function main() {
  console.log('🚀 Deploying Book-A-Meeting Panel to SRB Studio...');

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  });

  await client.login(process.env.DISCORD_TOKEN);
  console.log(`🤖 Logged in as ${client.user?.tag}`);

  const guild = await client.guilds.fetch(GUILD_ID);
  if (!guild) {
    throw new Error(`Guild ${GUILD_ID} not found.`);
  }

  const chan = await guild.channels.fetch(MEETING_CHANNEL_ID) as any;
  if (!chan || !chan.isTextBased()) {
    throw new Error(`Channel ${MEETING_CHANNEL_ID} not found or not text-based.`);
  }

  // Fetch existing messages to avoid duplicates
  const existingMsgs = await chan.messages.fetch({ limit: 10 });
  for (const msg of existingMsgs.values()) {
    if (msg.author.id === client.user?.id) {
      console.log(`Deleting previous bot message ${msg.id}...`);
      await msg.delete().catch(() => {});
    }
  }

  const meetingEmbed = new EmbedBuilder()
    .setTitle('📅 SRB STUDIO ✦ SCHEDULE A STRATEGY & DISCOVERY CALL')
    .setDescription(
      'Ready to bring your digital vision to life? Book a dedicated **1-on-1 Strategy & Discovery Call** with the **SRB Studio** engineering & design team.\n\n' +
      'Whether you need to architect a custom web application, explore enterprise Discord bot automation, plan a complete UI/UX overhaul, or review technical specifications, our team is ready to connect with you.\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '### 🎙️ Where Do Meetings Take Place?\n' +
      '• **Discord Voice Hub:** Inside our dedicated **💼 Client Meeting 1** or **💼 Client Meeting 2** voice channels.\n' +
      '• **Interactive Screen Share:** In our **🖥 Screen Share Lounge** for interactive Figma wireframes and live product demos.\n' +
      '• **External Video Call:** Google Meet or Zoom link provided upon request if preferred.\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '### 📋 What We Cover In Calls:\n' +
      '• **Technical Discovery & Feasibility:** Tech stack evaluation, database schemas, and system architecture.\n' +
      '• **Project Milestones & Roadmaps:** Sprint planning, delivery timeline, and launch requirements.\n' +
      '• **Live Product & Wireframe Demos:** Real-time design reviews and prototype walkthroughs.\n' +
      '• **Itemized Quotations:** Transparent project investment estimates tailored to your goals.\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '💡 *Click **Request a Meeting** below to choose your preferred date, time, and topic!*'
    )
    .setColor('#5865F2')
    .setImage('https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80')
    .setFooter({
      text: 'SRB Studio Client Operations • Seamless Strategy Scheduling',
      iconURL: guild.iconURL() || undefined,
    });

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('nexus_book_meeting_btn')
      .setLabel('Request a Meeting')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('📅'),
    new ButtonBuilder()
      .setCustomId('nexus_open_quote_modal')
      .setLabel('Request a Quote')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('💡'),
    new ButtonBuilder()
      .setCustomId('nexus_open_inquiry_modal')
      .setLabel('Project Inquiry')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📩')
  );

  const sent = await chan.send({
    embeds: [meetingEmbed],
    components: [actionRow],
  });

  console.log(`✅ Successfully deployed Meeting Panel (Message ID: ${sent.id}) to #${chan.name}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to deploy meeting panel:', err);
  process.exit(1);
});
