import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ChannelType } from 'discord.js';

export const serverinfoCommand = {
  data: new SlashCommandBuilder()
    .setName('nexus-serverinfo')
    .setDescription('Displays comprehensive server metrics and configuration'),

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild;
    if (!guild) return;

    await guild.members.fetch(); // Ensure member cache is populated

    const totalMembers = guild.memberCount;
    const botCount = guild.members.cache.filter((m) => m.user.bot).size;
    const humanCount = totalMembers - botCount;

    const textChannels = guild.channels.cache.filter((c) => c.type === ChannelType.GuildText).size;
    const voiceChannels = guild.channels.cache.filter((c) => c.type === ChannelType.GuildVoice).size;
    const categoryChannels = guild.channels.cache.filter((c) => c.type === ChannelType.GuildCategory).size;

    const rolesCount = guild.roles.cache.size - 1; // Exclude @everyone
    const owner = await guild.fetchOwner();
    const createdTimestamp = Math.floor(guild.createdTimestamp / 1000);

    const embed = new EmbedBuilder()
      .setTitle(`🏛️ ${guild.name}`)
      .setThumbnail(guild.iconURL({ size: 256 }))
      .setColor('#5865F2')
      .addFields(
        { name: 'Owner', value: `<@${owner.id}> (${owner.user.tag})`, inline: true },
        { name: 'Server ID', value: `\`${guild.id}\``, inline: true },
        { name: 'Created', value: `<t:${createdTimestamp}:R>`, inline: true },
        {
          name: '👥 Members',
          value: `**Total:** ${totalMembers}\n**Humans:** ${humanCount}\n**Bots:** ${botCount}`,
          inline: true,
        },
        {
          name: '💬 Channels',
          value: `**Text:** ${textChannels}\n**Voice:** ${voiceChannels}\n**Categories:** ${categoryChannels}`,
          inline: true,
        },
        {
          name: '⚡ Nitro & Roles',
          value: `**Boost Tier:** Level ${guild.premiumTier}\n**Boosters:** ${guild.premiumSubscriptionCount || 0}\n**Roles:** ${rolesCount}`,
          inline: true,
        }
      )
      .setFooter({ text: 'SRB NEXUS Intelligence' })
      .setTimestamp();

    if (guild.bannerURL()) {
      embed.setImage(guild.bannerURL({ size: 1024 })!);
    }

    await interaction.reply({ embeds: [embed] });
  },
};
