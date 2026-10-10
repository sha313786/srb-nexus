import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';

const NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];

export const pollCommand = {
  data: new SlashCommandBuilder()
    .setName('nexus-poll')
    .setDescription('Creates an interactive community vote poll')
    .addStringOption((opt) => opt.setName('question').setDescription('The poll question').setRequired(true))
    .addStringOption((opt) => opt.setName('option1').setDescription('First option').setRequired(true))
    .addStringOption((opt) => opt.setName('option2').setDescription('Second option').setRequired(true))
    .addStringOption((opt) => opt.setName('option3').setDescription('Third option (optional)').setRequired(false))
    .addStringOption((opt) => opt.setName('option4').setDescription('Fourth option (optional)').setRequired(false)),

  async execute(interaction: ChatInputCommandInteraction) {
    const question = interaction.options.getString('question', true);
    const op1 = interaction.options.getString('option1', true);
    const op2 = interaction.options.getString('option2', true);
    const op3 = interaction.options.getString('option3');
    const op4 = interaction.options.getString('option4');

    const options = [op1, op2, op3, op4].filter(Boolean) as string[];

    const description = options
      .map((op, idx) => `${NUMBER_EMOJIS[idx]} **${op}**`)
      .join('\n\n');

    const embed = new EmbedBuilder()
      .setTitle(`📊 Poll: ${question}`)
      .setDescription(description)
      .setColor('#5865F2')
      .setFooter({ text: `Poll created by ${interaction.user.tag}` })
      .setTimestamp();

    const response = await interaction.reply({ embeds: [embed], fetchReply: true });

    // React with option emojis
    for (let i = 0; i < options.length; i++) {
      await response.react(NUMBER_EMOJIS[i]);
    }
  },
};
