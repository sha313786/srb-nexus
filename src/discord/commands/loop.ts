import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
  EmbedBuilder,
} from 'discord.js';
import { QueueRepeatMode } from 'discord-player';
import { toggleLoopMode } from '../../services/musicService';

function createLoopBuilder(name: string) {
  return new SlashCommandBuilder()
    .setName(name)
    .setDescription('Toggle or set music repeat mode (Off, Track, Queue, Autoplay)')
    .addStringOption((opt) =>
      opt
        .setName('mode')
        .setDescription('Select repeat mode')
        .setRequired(false)
        .addChoices(
          { name: 'Off — No repeat', value: 'off' },
          { name: 'Track — Repeat current song', value: 'track' },
          { name: 'Queue — Repeat entire queue', value: 'queue' },
          { name: 'Autoplay — Stream similar recommendations', value: 'autoplay' }
        )
    );
}

export async function executeLoop(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild || !interaction.member) {
    await interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
    return;
  }

  const member = interaction.member as GuildMember;
  if (!member.voice.channel) {
    await interaction.reply({
      content: '❌ You must be connected to a voice channel to configure repeat modes.',
      ephemeral: true,
    });
    return;
  }

  const modeStr = interaction.options.getString('mode');
  let explicitMode: QueueRepeatMode | undefined = undefined;

  if (modeStr === 'track') explicitMode = QueueRepeatMode.TRACK;
  else if (modeStr === 'queue') explicitMode = QueueRepeatMode.QUEUE;
  else if (modeStr === 'autoplay') explicitMode = QueueRepeatMode.AUTOPLAY;
  else if (modeStr === 'off') explicitMode = QueueRepeatMode.OFF;

  const result = await toggleLoopMode(member, explicitMode);

  if (!result.success) {
    await interaction.reply({ content: result.message, ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(result.mode !== QueueRepeatMode.OFF ? 0x10b981 : 0x5865f2)
    .setTitle('🔁 Repeat Mode Configured')
    .setDescription(result.message)
    .setFooter({
      text: `Updated by ${member.user.tag}`,
      iconURL: member.user.displayAvatarURL(),
    })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

export const loopCommand = {
  data: createLoopBuilder('loop'),
  execute: executeLoop,
};

export const nexusLoopCommand = {
  data: createLoopBuilder('nexus-loop'),
  execute: executeLoop,
};
