import { GuildMember, PartialGuildMember, TextChannel } from 'discord.js';
import { db } from '../../core/database';

export async function execute(member: GuildMember | PartialGuildMember) {
  try {
    const res = await db.query(
      'SELECT leave_channel_id, leave_message, enabled FROM module_welcome WHERE guild_id = $1 AND enabled = TRUE',
      [member.guild.id]
    );

    if (res.rows.length === 0) return;
    const config = res.rows[0];

    if (config.leave_channel_id) {
      const channel = member.guild.channels.cache.get(config.leave_channel_id) as TextChannel;
      if (channel && channel.isTextBased()) {
        let message = config.leave_message || '{username} has left the server.';
        message = message
          .replace(/{username}/g, member.user?.username || 'Someone')
          .replace(/{server}/g, member.guild.name);

        await channel.send({ content: message });
      }
    }
  } catch (err) {
    console.error('Error in guildMemberRemove event:', err);
  }
}