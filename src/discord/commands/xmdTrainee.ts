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

export const xmdTraineeCommand = {
  data: new SlashCommandBuilder()
    .setName('xmd-trainee')
    .setDescription('Announce a new trainee and their assigned trainer (XMD Command Only)')
    .addUserOption((opt) =>
      opt.setName('trainee').setDescription('The new trainee recruit').setRequired(true)
    )
    .addUserOption((opt) =>
      opt.setName('trainer').setDescription('The assigned Field Trainer / FTO').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('badge').setDescription('Trainee badge number (e.g., #402)').setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('division')
        .setDescription('Department division')
        .setRequired(false)
        .addChoices(
          { name: 'Emergency Medical Services (EMS)', value: 'Emergency Medical Services (EMS)' },
          { name: 'Hospital ER & Trauma', value: 'Hospital ER & Trauma' },
          { name: 'General Medicine & Triage', value: 'General Medicine & Triage' },
          { name: 'Surgical Department', value: 'Surgical Department' }
        )
    )
    .addStringOption((opt) =>
      opt.setName('phase').setDescription('Training Phase (e.g. Phase 1 - FTO Ride Along)').setRequired(false)
    )
    .addStringOption((opt) =>
      opt.setName('notes').setDescription('Additional instructions or shift details').setRequired(false)
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

    const trainee = interaction.options.getUser('trainee', true);
    const trainer = interaction.options.getUser('trainer', true);
    const badge = interaction.options.getString('badge', true);
    const division = interaction.options.getString('division') || 'Emergency Medical Services (EMS)';
    const phase = interaction.options.getString('phase') || 'Phase 1 — Field Training & Orientation';
    const notes = interaction.options.getString('notes') || 'Report to your assigned trainer for duty schedule and radio clearance.';

    const targetChannel = interaction.guild?.channels.cache.get(TRAINING_CHANNEL_ID) as TextChannel | undefined;

    const embed = new EmbedBuilder()
      .setTitle('📋 OFFICIAL TRAINEE & TRAINER ASSIGNMENT')
      .setDescription(
        `A new recruit has officially been assigned a supervisor/trainer in the **XLANTIS Medical Department**.`
      )
      .setColor(0x00B4D8)
      .setThumbnail(trainee.displayAvatarURL({ forceStatic: false }))
      .addFields(
        { name: '👤 Trainee Recruit', value: `<@${trainee.id}> (${trainee.tag})`, inline: true },
        { name: '🎖️ Assigned Trainer / FTO', value: `<@${trainer.id}> (${trainer.tag})`, inline: true },
        { name: '🆔 Badge Number', value: `\`${badge}\``, inline: true },
        { name: '🏥 Department Division', value: division, inline: true },
        { name: '📚 Training Phase', value: phase, inline: true },
        { name: '📝 Instructions & Notes', value: `> ${notes}`, inline: false }
      )
      .setFooter({
        text: `Authorized by ${interaction.user.tag} • XLANTIS Medical Department Command`,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setTimestamp();

    if (targetChannel && targetChannel.isTextBased()) {
      await targetChannel.send({
        content: `📢 **TRAINING ASSIGNMENT:** <@${trainee.id}> has been paired with <@${trainer.id}>!`,
        embeds: [embed],
      });
      await interaction.editReply({
        content: `✅ Successfully announced trainee assignment in <#${TRAINING_CHANNEL_ID}>!`,
      });
    } else {
      await interaction.editReply({ embeds: [embed] });
    }
  },
};
