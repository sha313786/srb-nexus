import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { syncAllSupportStaffNicknames, COMMON_STAFF_NAME } from '../../services/staffNicknameService';

export const syncStaffNamesCommand = {
  data: new SlashCommandBuilder()
    .setName('sync-staff-names')
    .setDescription(`Sync all support staff nicknames to the uniform '${COMMON_STAFF_NAME}' identity`)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    if (interaction.guildId !== '1525065834572021851') {
      await interaction.reply({
        content: '❌ Staff anonymization sync is exclusively configured for **SRB Studio**.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const { updated, skipped } = await syncAllSupportStaffNicknames(interaction.guild);

      const embed = new EmbedBuilder()
        .setColor(0x00E5FF)
        .setTitle('🛡️ Support Staff Nicknames Synchronized')
        .setDescription(
          `Successfully scanned support staff and applied the uniform **${COMMON_STAFF_NAME}** identity.\n\n` +
          `• **Members Renamed:** \`${updated}\`\n` +
          `• **Skipped / Unchanged:** \`${skipped}\`\n\n` +
          `*All support team members will automatically receive this nickname when assigned the support role, shielding their personal identity from client DMs.*`
        )
        .setFooter({ text: 'SRB Studio Staff Anonymization Engine' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err: any) {
      await interaction.editReply({ content: `❌ Error syncing staff names: ${err.message}` });
    }
  },
};
