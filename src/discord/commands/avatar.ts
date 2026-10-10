import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';

export const avatarCommand = {
  data: new SlashCommandBuilder()
    .setName('nexus-avatar')
    .setDescription('Displays the high-resolution avatar of a user')
    .addUserOption((opt) => opt.setName('target').setDescription('Target user').setRequired(false)),

  async execute(interaction: ChatInputCommandInteraction) {
    const targetUser = interaction.options.getUser('target') || interaction.user;

    const avatarPng = targetUser.displayAvatarURL({ extension: 'png', size: 1024 });
    const avatarWebp = targetUser.displayAvatarURL({ extension: 'webp', size: 1024 });

    const embed = new EmbedBuilder()
      .setTitle(`🖼️ ${targetUser.tag}'s Avatar`)
      .setImage(avatarPng)
      .setColor('#5865F2')
      .setDescription(`[PNG Link](${avatarPng}) • [WebP Link](${avatarWebp})`)
      .setFooter({ text: 'SRB NEXUS Media' });

    await interaction.reply({ embeds: [embed] });
  },
};
