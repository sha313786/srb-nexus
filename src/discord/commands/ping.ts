import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';

export const pingCommand = {
  data: new SlashCommandBuilder()
    .setName('nexus-ping')
    .setDescription('Replies with NEXUS latency diagnostic'),

  async execute(interaction: ChatInputCommandInteraction) {
    const sent = await interaction.reply({ content: 'Pinging NEXUS...', fetchReply: true });
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    
    await interaction.editReply(
      `🟢 **NEXUS Online** | Roundtrip: \`${latency}ms\` | Gateway: \`${interaction.client.ws.ping}ms\``
    );
  },
};