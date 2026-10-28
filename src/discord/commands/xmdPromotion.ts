import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  TextChannel,
  GuildMember,
} from 'discord.js';

const TRAINING_CHANNEL_ID = '1564381545089736774';
const XMD_GUILD_ID = '1525390373281857546';

// Permitted Command / Leadership Role IDs in XLANTIS Medical Department
const COMMAND_ROLES = [
  '1525391222158659754', // Director
  '1525391646936662066', // Chief
  '1525391750103826524', // Assistant Chief
  '1525391856140161045', // Clinical Operations Head
  '1525392168573992991', // Medical Supervisor
  '1525522899002327062', // XMD Management Portal
  '1525393804780376105', // Developer
];

export const xmdPromotionCommand = {
  data: new SlashCommandBuilder()
    .setName('xmd-promotion')
    .setDescription('Announce an official rank promotion for an XMD staff member (XMD Command Only)')
    .addUserOption((opt) =>
      opt.setName('member').setDescription('The member receiving the promotion').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('new_rank').setDescription('The new rank achieved (e.g. Doctor, Senior Doctor, Surgeon)').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('previous_rank').setDescription('Previous rank (e.g. Trainee, Junior Doctor)').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('badge').setDescription('Staff badge number (e.g., #104)').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('commendation').setDescription('Reason, evaluation result, or commendation message').setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    // 1. Strict Server Verification (Exclusive to XLANTIS Medical Department)
    if (interaction.guildId !== XMD_GUILD_ID) {
      await interaction.editReply({
        content: '⚠️ This command is strictly exclusive to the **XLANTIS Medical Department** server.',
      });
      return;
    }

    // 2. Strict Command Team Role Verification
    const member = interaction.member as GuildMember;
    const hasCommandRole =
      member.permissions.has(PermissionFlagsBits.Administrator) ||
      COMMAND_ROLES.some((roleId) => member.roles.cache.has(roleId));

    if (!hasCommandRole) {
      await interaction.editReply({
        content: '⛔ **Access Denied:** Only **XMD Medical Command & Leadership** can execute this command.',
      });
      return;
    }

    const targetUser = interaction.options.getUser('member', true);
    const newRank = interaction.options.getString('new_rank', true);
    const prevRank = interaction.options.getString('previous_rank', true);
    const badge = interaction.options.getString('badge', true);
    const commendation =
      interaction.options.getString('commendation') ||
      'Recognized for exceptional medical service, active field presence, and commitment to XLANTIS Medical Department.';

    const targetChannel = interaction.guild?.channels.cache.get(TRAINING_CHANNEL_ID) as TextChannel | undefined;

    const embed = new EmbedBuilder()
      .setTitle('🎖️ OFFICIAL DEPARTMENT PROMOTION ANNOUNCEMENT')
      .setDescription(
        `By order of Medical Command & Leadership, an official promotion has been granted to **<@${targetUser.id}>**!`
      )
      .setColor(0xF4A261)
      .setThumbnail(targetUser.displayAvatarURL({ forceStatic: false }))
      .addFields(
        { name: '👨‍⚕️ Officer / Staff Member', value: `<@${targetUser.id}> (${targetUser.tag})`, inline: true },
        { name: '🆔 Badge ID', value: `\`${badge}\``, inline: true },
        { name: '📈 Promotion Status', value: `\`${prevRank}\` ➔ **${newRank}**`, inline: false },
        { name: '🏆 Commendation & Board Evaluation', value: `> *"${commendation}"*`, inline: false }
      )
      .setFooter({
        text: `Promoted by ${interaction.user.tag} • XLANTIS Medical Department Command`,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setTimestamp();

    if (targetChannel && targetChannel.isTextBased()) {
      await targetChannel.send({
        content: `🎉 **CONGRATULATIONS:** <@${targetUser.id}> has been promoted to **${newRank}**!`,
        embeds: [embed],
      });
      await interaction.editReply({
        content: `✅ Successfully posted promotion announcement in <#${TRAINING_CHANNEL_ID}>!`,
      });
    } else {
      await interaction.editReply({ embeds: [embed] });
    }
  },
};
