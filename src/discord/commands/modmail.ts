import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
import { db } from '../../core/database';
import { sendStaffModmailReply } from '../../services/modmail';

export const modmailCommand = {
  data: new SlashCommandBuilder()
    .setName('modmail')
    .setDescription('Modmail staff inbox configuration and member reply system')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand((sub) =>
      sub
        .setName('setup')
        .setDescription('Configure the staff modmail intake channel')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Channel where incoming member DMs will be dispatched')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addRoleOption((opt) =>
          opt
            .setName('role')
            .setDescription('Role to ping on new incoming modmails (e.g. @Moderator)')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('reply')
        .setDescription('Send a direct response to a member who contacted staff via modmail')
        .addUserOption((opt) =>
          opt
            .setName('user')
            .setDescription('The member to send the response to')
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('message')
            .setDescription('Your reply message')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('disable')
        .setDescription('Disable incoming modmail on this server')
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: '❌ Setting up modmail requires Administrator permission.', ephemeral: true });
        return;
      }

      const channel = interaction.options.getChannel('channel', true);
      const role = interaction.options.getRole('role');

      await db.query(
        `UPDATE guild_settings SET 
          modmail_enabled = TRUE,
          modmail_channel_id = $1,
          modmail_role_id = $2,
          updated_at = CURRENT_TIMESTAMP
         WHERE guild_id = $3`,
        [channel.id, role?.id || null, interaction.guild.id]
      );

      await interaction.reply({
        content: `✅ **Modmail Inbox Configured!**\n\n• **Intake Channel**: <#${channel.id}>\n• **Staff Ping Role**: ${role ? `<@&${role.id}>` : '*None*'}\n\nWhen server members send a private DM to **SRB NEXUS**, their inquiries will be forwarded to <#${channel.id}>. Staff can reply anytime using \`/modmail reply\`.`,
        ephemeral: true,
      });
    } else if (sub === 'reply') {
      const targetUser = interaction.options.getUser('user', true);
      const replyMessage = interaction.options.getString('message', true);

      await interaction.deferReply({ ephemeral: true });

      const res = await sendStaffModmailReply(
        interaction.client,
        targetUser.id,
        interaction.user,
        interaction.guild.name,
        replyMessage
      );

      if (!res.success) {
        await interaction.editReply(`❌ Could not deliver reply: ${res.error}`);
        return;
      }

      await interaction.editReply({
        content: `📬 **Reply Delivered!** Successfully sent to **${targetUser.tag}** via private DM.`,
      });
    } else if (sub === 'disable') {
      await db.query(
        `UPDATE guild_settings SET modmail_enabled = FALSE, updated_at = CURRENT_TIMESTAMP WHERE guild_id = $1`,
        [interaction.guild.id]
      );
      await interaction.reply({ content: '✅ **Modmail inbox has been disabled for this server.**', ephemeral: true });
    }
  },
};
