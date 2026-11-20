import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
import {
  setUserBirthday,
  getUserBirthday,
  deleteUserBirthday,
  getGuildUpcomingBirthdays,
  getGuildBirthdayConfig,
  setGuildBirthdayConfig,
  getMonthName,
  getDaysUntilBirthday,
} from '../../services/birthdayService';

function createBirthdaySlashCommand(name: string) {
  return new SlashCommandBuilder()
    .setName(name)
    .setDescription('🎂 Birthday Module: Register, view, or manage server birthdays')
    // Subcommand: set
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('Save your birthday so the server can celebrate and wish you!')
        .addIntegerOption((opt) =>
          opt
            .setName('day')
            .setDescription('Day of the month (1 - 31)')
            .setMinValue(1)
            .setMaxValue(31)
            .setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('month')
            .setDescription('Month of your birthday')
            .setRequired(true)
            .addChoices(
              { name: 'January (1)', value: 1 },
              { name: 'February (2)', value: 2 },
              { name: 'March (3)', value: 3 },
              { name: 'April (4)', value: 4 },
              { name: 'May (5)', value: 5 },
              { name: 'June (6)', value: 6 },
              { name: 'July (7)', value: 7 },
              { name: 'August (8)', value: 8 },
              { name: 'September (9)', value: 9 },
              { name: 'October (10)', value: 10 },
              { name: 'November (11)', value: 11 },
              { name: 'December (12)', value: 12 }
            )
        )
        .addIntegerOption((opt) =>
          opt
            .setName('year')
            .setDescription('Birth year (optional, e.g. 2002)')
            .setMinValue(1940)
            .setMaxValue(new Date().getFullYear())
            .setRequired(false)
        )
    )
    // Subcommand: view
    .addSubcommand((sub) =>
      sub
        .setName('view')
        .setDescription('Check your birthday or another server member\'s birthday')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('The member to check (leave empty for yourself)').setRequired(false)
        )
    )
    // Subcommand: upcoming
    .addSubcommand((sub) =>
      sub.setName('upcoming').setDescription('View upcoming birthdays in the server')
    )
    // Subcommand: remove
    .addSubcommand((sub) =>
      sub.setName('remove').setDescription('Remove your saved birthday from the server')
    )
    // Subcommand: setup (Admin)
    .addSubcommand((sub) =>
      sub
        .setName('setup')
        .setDescription('⚙️ Configure the Birthday announcement channel and role (Admin only)')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Channel where birthday wishes should be announced')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addRoleOption((opt) =>
          opt
            .setName('role')
            .setDescription('Optional Birthday role to grant to the member for 24 hours')
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName('message')
            .setDescription('Custom wish message ({user}, {username}, {server}, {age})')
            .setRequired(false)
        )
        .addBooleanOption((opt) =>
          opt.setName('enabled').setDescription('Enable or disable birthday announcements').setRequired(false)
        )
    )
    // Subcommand: test (Admin)
    .addSubcommand((sub) =>
      sub.setName('test').setDescription('🧪 Test and preview the birthday announcement embed (Admin only)')
    );
}

async function handleBirthdayExecution(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    return interaction.reply({ content: '❌ This command can only be used in a Discord server.', ephemeral: true });
  }

  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  // 1. SUBCOMMAND: SET
  if (subcommand === 'set') {
    const day = interaction.options.getInteger('day', true);
    const month = interaction.options.getInteger('month', true);
    const year = interaction.options.getInteger('year', false);

    // Validate days in month
    const maxDays = new Date(year || 2024, month, 0).getDate();
    if (day > maxDays) {
      return interaction.reply({
        content: `❌ Invalid date! **${getMonthName(month)}** only has **${maxDays}** days.`,
        ephemeral: true,
      });
    }

    await setUserBirthday(guildId, interaction.user.id, day, month, year);

    const daysLeft = getDaysUntilBirthday(day, month);
    const countdownText =
      daysLeft === 0
        ? '🎉 **Today is your birthday! Happy Birthday!** 🎂'
        : `⏳ **${daysLeft} day${daysLeft > 1 ? 's' : ''}** left until your next birthday!`;

    const setEmbed = new EmbedBuilder()
      .setColor('#10B981')
      .setTitle('🎂 Birthday Saved Successfully!')
      .setDescription(
        `Hey <@${interaction.user.id}>, your birthday has been registered!\n\n` +
        `• **Date:** \`${day} ${getMonthName(month)}${year ? `, ${year}` : ''}\`\n` +
        `• **Countdown:** ${countdownText}\n\n` +
        `When your special day arrives, SRB NEXUS will celebrate with you! 🎈✨`
      )
      .setThumbnail(interaction.user.displayAvatarURL({ size: 128 }))
      .setFooter({ text: 'SRB NEXUS Birthday Module' })
      .setTimestamp();

    return interaction.reply({ embeds: [setEmbed], ephemeral: true });
  }

  // 2. SUBCOMMAND: VIEW
  if (subcommand === 'view') {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const bday = await getUserBirthday(guildId, targetUser.id);

    if (!bday) {
      const isSelf = targetUser.id === interaction.user.id;
      return interaction.reply({
        content: isSelf
          ? '❌ You haven\'t registered your birthday yet! Use `/birthday set` to register.'
          : `❌ <@${targetUser.id}> has not registered their birthday on this server.`,
        ephemeral: true,
      });
    }

    const daysLeft = getDaysUntilBirthday(bday.birth_day, bday.birth_month);
    const isToday = daysLeft === 0;

    const viewEmbed = new EmbedBuilder()
      .setColor(isToday ? '#F43F5E' : '#3B82F6')
      .setTitle(`🎂 Birthday Info: ${targetUser.username}`)
      .setDescription(
        `• **Member:** <@${targetUser.id}>\n` +
        `• **Birthday:** \`${bday.birth_day} ${getMonthName(bday.birth_month)}${bday.birth_year ? `, ${bday.birth_year}` : ''}\`\n` +
        `• **Status:** ${isToday ? '🎉 **TODAY IS THEIR BIRTHDAY!** 🥳' : `⏳ **${daysLeft} days remaining**`}`
      )
      .setThumbnail(targetUser.displayAvatarURL({ size: 128 }))
      .setFooter({ text: 'SRB NEXUS Birthday Module' })
      .setTimestamp();

    return interaction.reply({ embeds: [viewEmbed] });
  }

  // 3. SUBCOMMAND: UPCOMING
  if (subcommand === 'upcoming') {
    const upcoming = await getGuildUpcomingBirthdays(guildId);

    if (upcoming.length === 0) {
      return interaction.reply({
        content: '📅 No birthdays registered yet in this server! Use `/birthday set` to be the first.',
        ephemeral: true,
      });
    }

    const top10 = upcoming.slice(0, 10);
    const listText = top10
      .map((b, i) => {
        const daysText = b.daysLeft === 0 ? '🎉 **TODAY!**' : `in **${b.daysLeft}d**`;
        return `\`${i + 1}.\` <@${b.user_id}> — **${b.birth_day} ${getMonthName(b.birth_month)}** (${daysText})`;
      })
      .join('\n');

    const upcomingEmbed = new EmbedBuilder()
      .setColor('#8B5CF6')
      .setTitle('📅 Upcoming Server Birthdays')
      .setDescription(`Here are the next upcoming celebrations in **${interaction.guild.name}**:\n\n${listText}`)
      .setFooter({ text: `Total Registered Birthdays: ${upcoming.length}` })
      .setTimestamp();

    return interaction.reply({ embeds: [upcomingEmbed] });
  }

  // 4. SUBCOMMAND: REMOVE
  if (subcommand === 'remove') {
    const removed = await deleteUserBirthday(guildId, interaction.user.id);
    return interaction.reply({
      content: removed
        ? '🗑️ Your birthday has been removed from SRB NEXUS.'
        : 'ℹ️ You did not have any registered birthday.',
      ephemeral: true,
    });
  }

  // 5. SUBCOMMAND: SETUP (Admin only)
  if (subcommand === 'setup') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: '❌ You need `Manage Server` permission to configure birthdays.', ephemeral: true });
    }

    const channel = interaction.options.getChannel('channel', true);
    const role = interaction.options.getRole('role', false);
    const message = interaction.options.getString('message', false);
    const enabled = interaction.options.getBoolean('enabled', false);

    const current = await getGuildBirthdayConfig(guildId);
    const updatedConfig = {
      guild_id: guildId,
      channel_id: channel.id,
      role_id: role ? role.id : current.role_id,
      wish_message: message || current.wish_message,
      wish_time: current.wish_time || '00:00',
      enabled: enabled !== null ? enabled : true,
    };

    await setGuildBirthdayConfig(updatedConfig);

    const setupEmbed = new EmbedBuilder()
      .setColor('#10B981')
      .setTitle('⚙️ Birthday Module Configured!')
      .setDescription(
        `Birthday celebrations have been configured for **${interaction.guild.name}**:\n\n` +
        `• **Announcement Channel:** <#${channel.id}>\n` +
        `• **Birthday Role:** ${updatedConfig.role_id ? `<@&${updatedConfig.role_id}>` : '*None*'}\n` +
        `• **Status:** ${updatedConfig.enabled ? '✅ Active' : '⏸️ Disabled'}\n` +
        `• **Wish Message:**\n> ${updatedConfig.wish_message}`
      )
      .setFooter({ text: 'Wishes trigger automatically at 12:00 AM IST on the member\'s birthday' })
      .setTimestamp();

    return interaction.reply({ embeds: [setupEmbed] });
  }

  // 6. SUBCOMMAND: TEST (Admin only)
  if (subcommand === 'test') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: '❌ You need `Manage Server` permission to test birthdays.', ephemeral: true });
    }

    const config = await getGuildBirthdayConfig(guildId);
    const channel = config.channel_id
      ? interaction.guild.channels.cache.get(config.channel_id)
      : interaction.channel;

    if (!channel || !channel.isTextBased()) {
      return interaction.reply({ content: '❌ Please configure an announcement channel first using `/birthday setup`.', ephemeral: true });
    }

    const user = interaction.user;
    const testEmbed = new EmbedBuilder()
      .setColor('#F43F5E')
      .setTitle(`🎂 [TEST PREVIEW] HAPPY BIRTHDAY! 🎈`)
      .setDescription(
        `Today is a very special day! Everyone join us in wishing <@${user.id}>!\n\n` +
        `> ${config.wish_message?.replace(/{user}/g, `<@${user.id}>`).replace(/{username}/g, user.username).replace(/{server}/g, interaction.guild.name) || 'Happy Birthday!'}\n\n` +
        `🎁 Drop your hearty wishes and love below for <@${user.id}>! 🥳🥂`
      )
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: '📅 Date', value: `\`Test Preview\``, inline: true },
        { name: '👑 Birthday VIP', value: `<@${user.id}>`, inline: true }
      )
      .setImage('https://media.giphy.com/media/g5R9dok94mrIvplmZd/giphy.gif')
      .setFooter({ text: `${interaction.guild.name} • Birthday Test Preview 🎉` })
      .setTimestamp();

    await (channel as any).send({
      content: `🎉 **HAPPY BIRTHDAY** <@${user.id}>! 🎂🎈 *(Test Preview)*`,
      embeds: [testEmbed],
    });

    return interaction.reply({ content: `✅ Sent test birthday preview in <#${channel.id}>!`, ephemeral: true });
  }
}

export const birthdayCommand = {
  data: createBirthdaySlashCommand('birthday'),
  execute: handleBirthdayExecution,
};

export const nexusBirthdayCommand = {
  data: createBirthdaySlashCommand('nexus-birthday'),
  execute: handleBirthdayExecution,
};
