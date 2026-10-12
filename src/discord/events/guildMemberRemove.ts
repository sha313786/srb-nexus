import { GuildMember, PartialGuildMember, TextChannel, EmbedBuilder } from 'discord.js';
import { db } from '../../core/database';

export async function execute(member: GuildMember | PartialGuildMember) {
  try {
    const res = await db.query(
      'SELECT leave_channel_id, leave_message, enabled FROM module_welcome WHERE guild_id = $1 AND enabled = TRUE',
      [member.guild.id]
    ).catch(() => null);

    const config = res?.rows?.[0];

    // Auto-resolve staff audit channel or configured leave channel
    let targetChannelId = config?.leave_channel_id;
    if (!targetChannelId) {
      const auditChan = member.guild.channels.cache.find(
        (c) => c.isTextBased() && (c.name.includes('mod-and-audit') || c.name.includes('mod-logs'))
      );
      if (auditChan) targetChannelId = auditChan.id;
    }

    if (targetChannelId) {
      const channel = (member.guild.channels.cache.get(targetChannelId) ||
        await member.guild.channels.fetch(targetChannelId).catch(() => null)) as TextChannel;

      if (channel && channel.isTextBased()) {
        const isAuditChannel = channel.name.includes('audit') || channel.name.includes('mod-log') || channel.name.includes('staff');

        if (isAuditChannel) {
          const userTag = member.user?.tag || 'Unknown Member';
          const avatarUrl = member.user?.displayAvatarURL() || undefined;
          const auditEmbed = new EmbedBuilder()
            .setColor('#ED4245')
            .setAuthor({
              name: `Member Left: ${userTag}`,
              iconURL: avatarUrl,
            })
            .setThumbnail(avatarUrl || null)
            .setDescription(
              `📤 **${userTag}** (<@${member.id}>) has left or was removed from **${member.guild.name}**.\n\n` +
              `• **User ID:** \`${member.id}\`\n` +
              `• **Server Member Count:** \`${member.guild.memberCount}\``
            )
            .setFooter({ text: 'SRB Studio • Staff Audit Logs' })
            .setTimestamp();

          await channel.send({ embeds: [auditEmbed] });
        } else {
          let message = config?.leave_message || '{username} has left the server.';
          message = message
            .replace(/{username}/g, member.user?.username || 'Someone')
            .replace(/{server}/g, member.guild.name);

          await channel.send({ content: message });
        }
      }
    }
  } catch (err) {
    console.error('Error in guildMemberRemove event:', err);
  }
}