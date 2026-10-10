import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  TextChannel,
} from 'discord.js';
import { db } from '../../core/database';

export const reactionRoleCommand = {
  data: new SlashCommandBuilder()
    .setName('nexus-reactionrole')
    .setDescription('Deploy an interactive button role selector in a channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('Channel to deploy the reaction role panel to')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addRoleOption((opt) =>
      opt.setName('role').setDescription('Role to grant or remove').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('label').setDescription('Button text label (e.g. Announcements, Gamer)').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('emoji').setDescription('Optional emoji for the button (e.g. 📢, 🎮)').setRequired(false)
    )
    .addStringOption((opt) =>
      opt.setName('description').setDescription('Optional description displayed in the panel').setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const targetChannel = interaction.options.getChannel('channel', true) as TextChannel;
    const role = interaction.options.getRole('role', true);
    const label = interaction.options.getString('label', true);
    const emoji = interaction.options.getString('emoji') || undefined;
    const description = interaction.options.getString('description') || `Click below to toggle the **@${role.name}** role!`;

    // Ensure bot has permission to manage this role
    const botMember = interaction.guild.members.me;
    if (!botMember || !botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return interaction.reply({
        content: '❌ I require the `Manage Roles` permission to create self-assignable roles.',
        ephemeral: true,
      });
    }

    if (role.position >= botMember.roles.highest.position) {
      return interaction.reply({
        content: `❌ The role **@${role.name}** is higher than or equal to my highest role. Please move my role above it in Server Settings.`,
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const embed = new EmbedBuilder()
      .setColor('#6366F1')
      .setTitle('🎭 Self-Assignable Role Panel')
      .setDescription(description)
      .addFields({ name: 'Role', value: `<@&${role.id}>`, inline: true })
      .setFooter({ text: 'SRB NEXUS Role Manager' })
      .setTimestamp();

    const button = new ButtonBuilder()
      .setCustomId(`nexus_role_${role.id}`)
      .setLabel(label)
      .setStyle(ButtonStyle.Primary);

    if (emoji) {
      try {
        button.setEmoji(emoji);
      } catch {
        // Ignore invalid emoji
      }
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

    try {
      const panelMessage = await targetChannel.send({
        embeds: [embed],
        components: [row],
      });

      await db.query(
        `INSERT INTO guild_reaction_roles (guild_id, channel_id, message_id, role_id, emoji, label, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [interaction.guild.id, targetChannel.id, panelMessage.id, role.id, emoji || null, label, description]
      );

      return interaction.editReply({
        content: `✅ Successfully created reaction role panel for <@&${role.id}> in <#${targetChannel.id}>!`,
      });
    } catch (err: any) {
      return interaction.editReply({
        content: `❌ Failed to deploy role panel: ${err.message}`,
      });
    }
  },
};
