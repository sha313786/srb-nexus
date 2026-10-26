import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';

export const helpCommand = {
  data: new SlashCommandBuilder()
    .setName('nexus-help')
    .setDescription('Displays the SRB NEXUS command directory and capabilities'),

  async execute(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
      .setTitle('⚡ SRB NEXUS — Command Directory & Capabilities')
      .setDescription(
        'Welcome to **SRB NEXUS**, your all-in-one central infrastructure and defense system for Discord.\n\n' +
        'Below is a categorized directory of available slash commands:'
      )
      .setColor('#5865F2')
      .addFields(
        {
          name: '🛡️ Moderation & Security',
          value:
            '`/nexus-ban` • Ban a disruptive member\n' +
            '`/nexus-kick` • Kick a member\n' +
            '`/nexus-timeout` • Timeout/mute member\n' +
            '`/nexus-purge` • Bulk delete messages\n' +
            '`/nexus-warn` • Issue formal warning\n' +
            '`/nexus-warnings` • View user warnings\n' +
            '`/nexus-clearwarn` • Remove warning records\n' +
            '`/nexus-lockdown` • Restrict channel writes\n' +
            '`/nexus-slowmode` • Adjust channel rate limit\n' +
            '`/nexus-modlogs` • Fetch moderation history\n' +
            '`/spamcatcher` • Deploy defensive bot honeypots',
          inline: false,
        },
        {
          name: '🔊 Voice & Room Management',
          value:
            '`/muteall` (`/nexus-muteall`) • Server-mute all members in voice channel\n' +
            '`/unmuteall` (`/nexus-unmuteall`) • Server-unmute all members in voice channel\n' +
            '`/moveall` (`/nexus-moveall`) • Mass-move voice members between channels\n' +
            '`/tempvoice` • Join-to-Create dynamic private voice rooms',
          inline: false,
        },
        {
          name: '🎵 Music & High-Fidelity Audio',
          value:
            '`/play` (`/nexus-play`) • Stream YouTube, Spotify, SoundCloud, or direct audio\n' +
            '`/skip` (`/nexus-skip`) • Skip to next song in queue\n' +
            '`/pause` / `/resume` • Pause or unpause audio stream\n' +
            '`/stop` (`/nexus-stop`) • Stop playback and clear queue\n' +
            '`/queue` (`/nexus-queue`) • View current songs and queue pages\n' +
            '`/nowplaying` (`/np`) • Rich interactive player card with clickable controls\n' +
            '`/volume` (`/nexus-volume`) • Set volume level (1-100%)\n' +
            '`/loop` (`/nexus-loop`) • Toggle repeat mode (Track, Queue, Autoplay, Off)\n' +
            '`/shuffle` (`/nexus-shuffle`) • Randomize songs in queue',
          inline: false,
        },
        {
          name: '🌟 Leveling & Progression',
          value:
            '`/nexus-rank` • View level progress & rank card\n' +
            '`/nexus-leaderboard` • Top 10 server XP leaderboard',
          inline: false,
        },
        {
          name: '🪙 Economy & Casino',
          value:
            '`/nexus-balance` • Check wallet & bank balance\n' +
            '`/nexus-daily` • Claim daily credit grant\n' +
            '`/nexus-work` • Complete a shift to earn coins\n' +
            '`/nexus-coinflip` • Double-or-nothing coinflip\n' +
            '`/nexus-slots` • High-stakes slot machine (up to 10x!)\n' +
            '`/nexus-rob` • High-stakes user robbery heist\n' +
            '`/nexus-pay` • Transfer currency to another member',
          inline: false,
        },
        {
          name: '⚙️ Utilities & Community Engagement',
          value:
            '`/nexus-reactionrole` • Deploy self-assignable button roles\n' +
            '`/nexus-giveaway` • Launch automated countdown giveaways\n' +
            '`/nexus-giveaway-reroll` • Re-roll winners for concluded giveaways\n' +
            '`/nexus-remind` • Schedule timed automated reminders\n' +
            '`/nexus-afk` • Set AFK status with reason & return notice\n' +
            '`/nexus-embed` • Broadcast customized rich announcements\n' +
            '`/nexus-serverinfo` • Detailed server analytics\n' +
            '`/nexus-userinfo` • User profile & role breakdown\n' +
            '`/nexus-avatar` • High-resolution avatar viewer\n' +
            '`/nexus-poll` • Create interactive voting polls\n' +
            '`/nexus-ticketsetup` • Deploy support ticket panels\n' +
            '`/nexus-ticket` • Open a private support channel\n' +
            '`/stream` • YouTube/Twitch live tracking\n' +
            '`/nexus-ping` • API & Gateway latency diagnostic',
          inline: false,
        }
      )
      .setFooter({ text: 'Web Dashboard available at https://srb-nexus-eyaj.onrender.com' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
