import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, TextChannel } from 'discord.js';
import { logModAction } from '../../moderation/logger';

function createPurgeBuilder(name: string) {
  return new SlashCommandBuilder()
    .setName(name)
    .setDescription('Bulk deletes messages in the current channel')
    .addIntegerOption((opt) =>
      opt.setName('amount').setDescription('Number of messages to delete (1-100)').setRequired(true).setMinValue(1).setMaxValue(100)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);
}

async function executePurge(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild || !(interaction.channel instanceof TextChannel)) {
    await interaction.reply({ content: 'Command can only be used in text channels.', ephemeral: true });
    return;
  }

  const amount = interaction.options.getInteger('amount', true);
  if (amount < 1 || amount > 100) {
    await interaction.reply({ content: 'Please provide an amount between 1 and 100.', ephemeral: true });
    return;
  }

  const deleted = await interaction.channel.bulkDelete(amount, true);

  await logModAction({
    guild: interaction.guild,
    targetId: 'BULK',
    targetTag: 'N/A',
    moderatorId: interaction.user.id,
    moderatorTag: interaction.user.tag,
    action: 'PURGE',
    reason: `Purged ${deleted.size} messages in #${interaction.channel.name}`,
  });

  await interaction.reply({ content: `🧹 Deleted **${deleted.size}** messages.`, ephemeral: true });
}

export const purgeCommand = {
  data: createPurgeBuilder('purge'),
  execute: executePurge,
};

export const nexusPurgeCommand = {
  data: createPurgeBuilder('nexus-purge'),
  execute: executePurge,
};
