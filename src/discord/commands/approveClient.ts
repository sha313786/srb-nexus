import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  TextChannel,
} from 'discord.js';
import { approveTicketAndCreateWorkspace, staffRoleIds } from '../../services/clientWorkspaceService';

export const approveClientCommand = {
  data: new SlashCommandBuilder()
    .setName('approve-client')
    .setDescription('Approve this client ticket, create private workspace, and archive ticket with transcript')
    .addStringOption((opt) =>
      opt
        .setName('name')
        .setDescription('Client or Project Name (e.g. Jesse Bridals)')
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName('notes')
        .setDescription('Agreed scope, deliverables, or summary notes discussed in this ticket')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.channel || !interaction.channel.isTextBased()) {
      await interaction.reply({ content: 'This command can only be used in a server text channel.', ephemeral: true });
      return;
    }

    const member = interaction.member as any;
    const isStaff =
      member?.permissions?.has(PermissionFlagsBits.Administrator) ||
      member?.permissions?.has(PermissionFlagsBits.ManageChannels) ||
      staffRoleIds.some((r) => member?.roles?.cache?.has(r));

    if (!isStaff) {
      await interaction.reply({
        content: '❌ Only designated staff members can approve clients.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();
    const clientName = interaction.options.getString('name') || undefined;
    const projectNotes = interaction.options.getString('notes') || undefined;

    try {
      const { clientChannel } = await approveTicketAndCreateWorkspace({
        guild: interaction.guild,
        ticketChannel: interaction.channel as TextChannel,
        approvedBy: interaction.user,
        clientName,
        projectNotes,
        withVoice: true,
      });

      await interaction.editReply({
        content: `🎉 **Client Approved!** Dedicated private workspace created: <#${clientChannel.id}>.\n*(This ticket channel will automatically close and delete in 5 seconds...)*`,
      });

      setTimeout(async () => {
        await (interaction.channel as TextChannel)?.delete().catch(() => {});
      }, 5000);
    } catch (err) {
      await interaction.editReply({
        content: '❌ Failed to approve ticket and create client workspace. Check bot permissions.',
      });
    }
  },
};
