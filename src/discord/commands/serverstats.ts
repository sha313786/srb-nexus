import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { setupDefaultStatCounters, updateGuildVoiceStats } from '../../services/voiceStats';

export const serverstatsCommand = {
  data: new SlashCommandBuilder()
    .setName('serverstats')
    .setDescription('Configure and update dynamic live voice stat counters in the server sidebar')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('setup')
        .setDescription('Automatically create locked category and voice channels for Members, Online & Bots')
    )
    .addSubcommand((sub) =>
      sub
        .setName('update')
        .setDescription('Force an immediate sync of server stat numbers')
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
      const res = await setupDefaultStatCounters(interaction.guild);
      if (!res.success) {
        await interaction.editReply(`❌ Failed setting up stat counters: ${res.error}`);
        return;
      }

      await interaction.editReply(
        `✅ **Live Voice Stat Counters Created!**\n\nChannels created:\n• 👥 **Members**: <#${res.membersChannelId}>\n• 🟢 **Online**: <#${res.onlineChannelId}>\n• 🤖 **Bots**: <#${res.botsChannelId}>\n\nThese channels are locked and will dynamically update as community numbers change!`
      );
    } else if (sub === 'update') {
      await updateGuildVoiceStats(interaction.guild, true);
      await interaction.editReply('✅ **Server stat counters updated successfully.**');
    }
  },
};
