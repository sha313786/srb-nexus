import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, GuildMember } from 'discord.js';

export const userinfoCommand = {
  data: new SlashCommandBuilder()
    .setName('nexus-userinfo')
    .setDescription('Displays profile details and permissions for a user')
    .addUserOption((opt) => opt.setName('target').setDescription('User to inspect').setRequired(false)),

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild;
    if (!guild) return;

    const targetUser = interaction.options.getUser('target') || interaction.user;
    const member = (await guild.members.fetch(targetUser.id).catch(() => null)) as GuildMember | null;

    const createdTimestamp = Math.floor(targetUser.createdTimestamp / 1000);
    const joinedTimestamp = member ? Math.floor(member.joinedTimestamp! / 1000) : null;

    const roles = member
      ? member.roles.cache
          .filter((r) => r.id !== guild.id)
          .sort((a, b) => b.position - a.position)
          .map((r) => `<@&${r.id}>`)
      : [];

    const displayedRoles = roles.length > 8 ? `${roles.slice(0, 8).join(' ')} (+${roles.length - 8} more)` : (roles.join(' ') || 'None');

    const embed = new EmbedBuilder()
      .setTitle(`👤 ${targetUser.tag}`)
      .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
      .setColor('#5865F2')
      .addFields(
        { name: 'User ID', value: `\`${targetUser.id}\``, inline: true },
        { name: 'Bot Account', value: targetUser.bot ? 'Yes' : 'No', inline: true },
        { name: 'Account Created', value: `<t:${createdTimestamp}:R>`, inline: true },
        { name: 'Joined Server', value: joinedTimestamp ? `<t:${joinedTimestamp}:R>` : 'Unknown', inline: true },
        { name: 'Highest Role', value: member?.roles.highest ? `<@&${member.roles.highest.id}>` : 'None', inline: true },
        { name: `Roles (${roles.length})`, value: displayedRoles, inline: false }
      )
      .setFooter({ text: 'SRB NEXUS Intelligence' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
