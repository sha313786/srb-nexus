import { GuildMember, TextChannel } from 'discord.js';
import { db } from '../../core/database';

export async function execute(member: GuildMember) {
  try {
    const res = await db.query(
      'SELECT * FROM module_welcome WHERE guild_id = $1 AND enabled = TRUE',
      [member.guild.id]
    );

    if (res.rows.length === 0) return;
    const config = res.rows[0];

    // Assign Auto-role if configured
    if (config.autorole_id) {
      const role = member.guild.roles.cache.get(config.autorole_id);
      if (role) {
        await member.roles.add(role).catch((err) =>
          console.error(`Failed to assign autorole ${config.autorole_id}:`, err)
        );
      }
    }

    // Send Welcome Message
    if (config.welcome_channel_id) {
      const channel = member.guild.channels.cache.get(config.welcome_channel_id) as TextChannel;
      if (channel && channel.isTextBased()) {
        let message = config.welcome_message || 'Welcome {user} to {server}!';
        message = message
          .replace(/{user}/g, `<@${member.id}>`)
          .replace(/{username}/g, member.user.username)
          .replace(/{server}/g, member.guild.name)
          .replace(/{count}/g, member.guild.memberCount.toString());

        await channel.send({ content: message });
      }
    }
  } catch (err) {
    console.error('Error in guildMemberAdd event:', err);
  }
}