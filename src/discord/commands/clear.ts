import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  TextChannel,
  NewsChannel,
  ThreadChannel,
  VoiceChannel,
  EmbedBuilder,
} from 'discord.js';
import { logModAction } from '../../moderation/logger';

function createClearBuilder(name: string) {
  return new SlashCommandBuilder()
    .setName(name)
    .setDescription('Bulk deletes messages in the current channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((opt) =>
      opt
        .setName('amount')
        .setDescription('Number of messages to delete (1-100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .addUserOption((opt) =>
      opt
        .setName('user')
        .setDescription('Filter messages to delete only from this user')
        .setRequired(false)
    )
    .addBooleanOption((opt) =>
      opt
        .setName('bots_only')
        .setDescription('Only delete messages sent by bots')
        .setRequired(false)
    );
}

async function executeClear(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild || !interaction.channel) {
    await interaction.reply({ content: '❌ This command can only be used in a server channel.', ephemeral: true });
    return;
  }

  const channel = interaction.channel;
  if (
    !(channel instanceof TextChannel) &&
    !(channel instanceof NewsChannel) &&
    !(channel instanceof ThreadChannel) &&
    !(channel instanceof VoiceChannel)
  ) {
    await interaction.reply({ content: '❌ Messages can only be cleared in text-capable channels.', ephemeral: true });
    return;
  }

  // Defer reply ephemerally to prevent interaction timeout
  await interaction.deferReply({ ephemeral: true });

  const amount = interaction.options.getInteger('amount', true);
  const targetUser = interaction.options.getUser('user');
  const botsOnly = interaction.options.getBoolean('bots_only') ?? false;

  try {
    let deletedCount = 0;

    if (targetUser || botsOnly) {
      // Fetch up to 100 recent messages to filter
      const fetched = await channel.messages.fetch({ limit: Math.min(amount * 2, 100) });
      let filtered = fetched.filter((msg) => {
        if (targetUser && msg.author.id !== targetUser.id) return false;
        if (botsOnly && !msg.author.bot) return false;
        return true;
      });

      // Limit to requested amount
      const toDelete = Array.from(filtered.values()).slice(0, amount);
      if (toDelete.length === 0) {
        await interaction.editReply({
          content: '⚠️ No matching messages found to delete within the last 100 messages.',
        });
        return;
      }

      const deleted = await channel.bulkDelete(toDelete, true);
      deletedCount = deleted.size;
    } else {
      const deleted = await channel.bulkDelete(amount, true);
      deletedCount = deleted.size;
    }

    // Log moderation action
    await logModAction({
      guild: interaction.guild,
      targetId: targetUser ? targetUser.id : 'BULK',
      targetTag: targetUser ? targetUser.tag : 'N/A',
      moderatorId: interaction.user.id,
      moderatorTag: interaction.user.tag,
      action: 'PURGE',
      reason: `Cleared ${deletedCount} messages in #${channel.name}${targetUser ? ` from ${targetUser.tag}` : ''}${botsOnly ? ' (bots only)' : ''}`,
    }).catch(() => {});

    const embed = new EmbedBuilder()
      .setColor('#22C55E')
      .setTitle('🧹 Chat Cleared')
      .setDescription(`Successfully deleted **${deletedCount}** message${deletedCount === 1 ? '' : 's'} in ${channel}.`)
      .setFooter({ text: `Requested by ${interaction.user.tag}` })
      .setTimestamp();

    if (targetUser) {
      embed.addFields({ name: '👤 Filtered User', value: `${targetUser.tag} (${targetUser.id})`, inline: true });
    }
    if (botsOnly) {
      embed.addFields({ name: '🤖 Filter', value: 'Bots Only', inline: true });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (err: any) {
    await interaction.editReply({
      content: `❌ Failed to delete messages: ${err.message || 'Messages older than 14 days cannot be bulk deleted.'}`,
    });
  }
}

export const clearCommand = {
  data: createClearBuilder('clear'),
  execute: executeClear,
};

export const nexusClearCommand = {
  data: createClearBuilder('nexus-clear'),
  execute: executeClear,
};
