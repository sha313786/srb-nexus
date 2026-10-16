import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
import { db } from '../../core/database';

export const tempvoiceCommand = {
  data: new SlashCommandBuilder()
    .setName('tempvoice')
    .setDescription('Configure "Join to Create" temporary private voice channels')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('setup')
        .setDescription('Set the master channel members join to dynamically generate a voice room')
        .addChannelOption((opt) =>
          opt
            .setName('master_channel')
            .setDescription('Voice channel users enter to trigger room creation (e.g. ➕ Create Voice)')
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(true)
        )
        .addChannelOption((opt) =>
          opt
            .setName('category')
            .setDescription('Category where new rooms will be generated')
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName('template')
            .setDescription('Name pattern for created channels (use {username})')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('disable')
        .setDescription('Disable Join-to-Create voice rooms on this server')
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
      const masterChannel = interaction.options.getChannel('master_channel', true);
      const category = interaction.options.getChannel('category');
      const template = interaction.options.getString('template') || "🔊 {username}'s Room";

      await db.query(
        `UPDATE guild_settings SET 
          temp_voice_enabled = TRUE,
          temp_voice_master_id = $1,
          temp_voice_category_id = $2,
          temp_voice_name_template = $3,
          updated_at = CURRENT_TIMESTAMP
         WHERE guild_id = $4`,
        [masterChannel.id, category?.id || null, template, interaction.guild.id]
      );

      await interaction.editReply(
        `✅ **Temp Voice "Join to Create" Configured!**\n\n• **Master Channel**: <#${masterChannel.id}>\n• **Parent Category**: ${category ? `<#${category.id}>` : '*None*'}\n• **Name Template**: \`${template}\`\n\nWhen members join <#${masterChannel.id}>, NEXUS will automatically generate a private channel for them and clean it up when empty!`
      );
    } else if (sub === 'disable') {
      await db.query(
        `UPDATE guild_settings SET temp_voice_enabled = FALSE, updated_at = CURRENT_TIMESTAMP WHERE guild_id = $1`,
        [interaction.guild.id]
      );
      await interaction.editReply('✅ **Temporary voice room system has been disabled.**');
    }
  },
};
