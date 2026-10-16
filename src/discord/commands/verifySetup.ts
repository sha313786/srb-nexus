import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
import { db } from '../../core/database';
import { deployVerificationPanel } from '../../services/verification';

export const verifySetupCommand = {
  data: new SlashCommandBuilder()
    .setName('verify-setup')
    .setDescription('Deploy and configure the server Verification Gate & Captcha system')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Channel where the verification button/captcha panel will be posted')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addRoleOption((option) =>
      option
        .setName('verified_role')
        .setDescription('Role awarded to members when they pass verification (e.g. @Member)')
        .setRequired(true)
    )
    .addRoleOption((option) =>
      option
        .setName('unverified_role')
        .setDescription('Temporary quarantine role assigned to new unverified joins')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('type')
        .setDescription('Verification method')
        .addChoices(
          { name: '🔘 One-Click Button Gate', value: 'button' },
          { name: '🧮 Math Captcha Challenge', value: 'captcha' }
        )
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    await interaction.deferReply({ ephemeral: true });

    const channel = interaction.options.getChannel('channel', true);
    const verifiedRole = interaction.options.getRole('verified_role', true);
    const unverifiedRole = interaction.options.getRole('unverified_role');
    const type = (interaction.options.getString('type') as 'button' | 'captcha') || 'button';

    try {
      // 1. Save to DB
      await db.query(
        `UPDATE guild_settings SET 
          verification_enabled = TRUE,
          verification_channel_id = $1,
          verification_role_id = $2,
          unverified_role_id = $3,
          verification_type = $4,
          updated_at = CURRENT_TIMESTAMP
         WHERE guild_id = $5`,
        [channel.id, verifiedRole.id, unverifiedRole?.id || null, type, interaction.guild.id]
      );

      // 2. Deploy Panel
      const deployRes = await deployVerificationPanel(
        interaction.client,
        interaction.guild.id,
        channel.id,
        type
      );

      if (!deployRes.success) {
        await interaction.editReply(`❌ Failed deploying verification panel: ${deployRes.error}`);
        return;
      }

      await interaction.editReply({
        content: `✅ **Verification Gate Configured!**\n\n• **Channel**: <#${channel.id}>\n• **Verified Role**: <@&${verifiedRole.id}>\n• **Unverified Role**: ${unverifiedRole ? `<@&${unverifiedRole.id}>` : '*None*'}\n• **Mode**: \`${type.toUpperCase()}\`\n\nThe panel has been deployed to <#${channel.id}>.`,
      });
    } catch (err: any) {
      await interaction.editReply(`❌ Error setting up verification: ${err.message}`);
    }
  },
};
