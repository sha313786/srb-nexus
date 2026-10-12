import { GuildMember, TextChannel, EmbedBuilder } from 'discord.js';
import { db } from '../../core/database';

export async function execute(member: GuildMember) {
  try {
    const res = await db.query(
      'SELECT * FROM module_welcome WHERE guild_id = $1 AND enabled = TRUE',
      [member.guild.id]
    ).catch(() => null);

    const config = res?.rows?.[0];

    // Assign Auto-role if configured
    if (config?.autorole_id) {
      const role = member.guild.roles.cache.get(config.autorole_id);
      if (role) {
        await member.roles.add(role).catch((err) =>
          console.error(`Failed to assign autorole ${config.autorole_id}:`, err)
        );
      }
    }

    // Auto-resolve staff audit channel or configured welcome channel
    let targetChannelId = config?.welcome_channel_id;
    if (!targetChannelId) {
      const auditChan = member.guild.channels.cache.find(
        (c) => c.isTextBased() && (c.name.includes('mod-and-audit') || c.name.includes('mod-logs'))
      );
      if (auditChan) targetChannelId = auditChan.id;
    }

    // Send Welcome / Staff Audit Message
    if (targetChannelId) {
      const channel = (member.guild.channels.cache.get(targetChannelId) ||
        await member.guild.channels.fetch(targetChannelId).catch(() => null)) as TextChannel;

      if (channel && channel.isTextBased()) {
        const isAuditChannel = channel.name.includes('audit') || channel.name.includes('mod-log') || channel.name.includes('staff');

        if (isAuditChannel) {
          const accountAgeDays = Math.floor((Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24));
          const verifyChan = member.guild.channels.cache.find((c) => c.name.includes('welcome-and-verify'));
          const auditEmbed = new EmbedBuilder()
            .setColor('#57F287')
            .setAuthor({
              name: `Member Joined: ${member.user.tag}`,
              iconURL: member.user.displayAvatarURL(),
            })
            .setThumbnail(member.user.displayAvatarURL())
            .setDescription(
              `📥 <@${member.id}> (\`${member.user.tag}\`) has joined **${member.guild.name}**.\n\n` +
              `• **User ID:** \`${member.id}\`\n` +
              `• **Account Created:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R> (${accountAgeDays} days ago)\n` +
              `• **Server Member Count:** \`${member.guild.memberCount}\`\n` +
              `• **Gate Status:** ⏳ Pending verification in ${verifyChan || 'welcome'}`
            )
            .setFooter({ text: 'SRB Studio • Staff Audit Logs' })
            .setTimestamp();

          await channel.send({ embeds: [auditEmbed] });
        } else {
          let message = config?.welcome_message || 'Welcome {user} to {server}!';
          message = message
            .replace(/{user}/g, `<@${member.id}>`)
            .replace(/{username}/g, member.user.username)
            .replace(/{server}/g, member.guild.name)
            .replace(/{count}/g, member.guild.memberCount.toString());

          await channel.send({ content: message });
        }
      }
    }
  } catch (err) {
    console.error('Error in guildMemberAdd event:', err);
  }
}