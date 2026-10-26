import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
  EmbedBuilder,
} from 'discord.js';
import { playTrack, getSourceEmoji } from '../../services/musicService';

function createPlayBuilder(name: string) {
  return new SlashCommandBuilder()
    .setName(name)
    .setDescription('Play a song, playlist, or stream from YouTube, Spotify, SoundCloud, or direct audio link')
    .addStringOption((opt) =>
      opt
        .setName('query')
        .setDescription('Song title, artist name, or URL (YouTube, Spotify, SoundCloud, Apple Music)')
        .setRequired(true)
    );
}

export async function executePlay(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild || !interaction.member) {
    await interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
    return;
  }

  const member = interaction.member as GuildMember;
  const voiceChannel = member.voice.channel;

  if (!voiceChannel) {
    await interaction.reply({
      content: '❌ You must be connected to a voice channel to play music.',
      ephemeral: true,
    });
    return;
  }

  const query = interaction.options.getString('query', true).trim();
  if (!query) {
    await interaction.reply({ content: '❌ Please provide a valid song name or URL.', ephemeral: true });
    return;
  }

  await interaction.deferReply();

  const textChannel = interaction.channel;
  if (!textChannel) {
    await interaction.editReply({ content: '❌ Could not resolve the text channel for music player output.' });
    return;
  }

  const result = await playTrack(member, voiceChannel, textChannel as any, query);

  if (!result.success) {
    await interaction.editReply({ content: result.message });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setAuthor({
      name: result.playlistTitle ? '🎶 Playlist Added to Queue' : '🎵 Track Added to Queue',
      iconURL: interaction.client.user?.displayAvatarURL(),
    })
    .setTitle(
      result.playlistTitle
        ? result.playlistTitle
        : result.track?.title || 'Unknown Track'
    )
    .setURL(result.track?.url || 'https://discord.com')
    .setDescription(result.message)
    .addFields(
      {
        name: '⏱️ Duration',
        value: `\`${result.track?.duration || 'N/A'}\``,
        inline: true,
      },
      {
        name: '📑 Position in Queue',
        value: `\`#${result.position || 1}\``,
        inline: true,
      },
      {
        name: '🌐 Platform',
        value: getSourceEmoji(result.track?.raw?.source || result.track?.source || 'youtube'),
        inline: true,
      }
    )
    .setFooter({
      text: `Requested by ${member.user.tag} • Channel: ${voiceChannel.name}`,
      iconURL: member.user.displayAvatarURL(),
    })
    .setTimestamp();

  if (result.track?.thumbnail) {
    embed.setThumbnail(result.track.thumbnail);
  }

  await interaction.editReply({ embeds: [embed] });
}

export const playCommand = {
  data: createPlayBuilder('play'),
  execute: executePlay,
};

export const nexusPlayCommand = {
  data: createPlayBuilder('nexus-play'),
  execute: executePlay,
};
