import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Message,
} from 'discord.js';
import {
  getNowPlayingData,
  getMusicPlayer,
  startPlayerProgressTicker,
} from '../../services/musicService';

function createNowPlayingBuilder(name: string) {
  return new SlashCommandBuilder()
    .setName(name)
    .setDescription('Display the currently playing song with interactive playback buttons');
}

export async function executeNowPlaying(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
    return;
  }

  const data = getNowPlayingData(interaction.guild.id);

  if (!data) {
    await interaction.reply({
      content: '❌ Nothing is currently playing in this server. Use `/play` to start music!',
      ephemeral: true,
    });
    return;
  }

  const response = await interaction.reply({
    embeds: [data.embed],
    components: [data.row],
    fetchReply: true,
  });

  try {
    const player = getMusicPlayer();
    const queue = player.nodes.get(interaction.guild.id);
    if (queue && queue.currentTrack && response && typeof (response as any).edit === 'function') {
      if (queue.metadata?.lastPlayerMessage && queue.metadata.lastPlayerMessage.id !== response.id) {
        try {
          const oldMsg = queue.metadata.lastPlayerMessage as Message;
          oldMsg.edit({ components: [] }).catch(() => {});
        } catch {}
      }
      startPlayerProgressTicker(queue, queue.currentTrack, response);
    }
  } catch {}
}

export const nowplayingCommand = {
  data: createNowPlayingBuilder('nowplaying'),
  execute: executeNowPlaying,
};

export const npCommand = {
  data: createNowPlayingBuilder('np'),
  execute: executeNowPlaying,
};

export const nexusNowPlayingCommand = {
  data: createNowPlayingBuilder('nexus-nowplaying'),
  execute: executeNowPlaying,
};
