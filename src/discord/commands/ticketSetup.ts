// Path: src/discord/commands/ticketSetup.ts
import { 
  ChatInputCommandInteraction, 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  StringSelectMenuBuilder, 
  StringSelectMenuOptionBuilder,
  PermissionFlagsBits 
} from 'discord.js';

export const ticketSetupCommand = {
  data: new SlashCommandBuilder()
    .setName('nexus-ticket-setup')
    .setDescription('Post the ticket panel with dropdown menu')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const embed = new EmbedBuilder()
      .setTitle('support tickets')
      .setDescription('need help or want to report an issue? select a category from the dropdown menu below to open a private support ticket.')
      .setColor('#e74c3c')
      .setFooter({ 
        text: `© ${interaction.guild?.name || 'SRB NEXUS'}`, 
        iconURL: interaction.guild?.iconURL() || undefined 
      })
      .setTimestamp();

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('nexus_ticket_select')
      .setPlaceholder('Select a ticket category...')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('General Support')
          .setDescription('Get general help')
          .setValue('general')
          .setEmoji('❓'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Player Report')
          .setDescription('Report a player')
          .setValue('report')
          .setEmoji('🚫'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Billing & Purchases')
          .setDescription('Store questions')
          .setValue('billing')
          .setEmoji('💳'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Bug Report')
          .setDescription('Report technical issue')
          .setValue('bug')
          .setEmoji('🐛')
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    if (interaction.channel && 'send' in interaction.channel) {
      await interaction.channel.send({
        embeds: [embed],
        components: [row]
      });

      await interaction.editReply({ content: 'Ticket panel posted successfully!' });
    } else {
      await interaction.editReply({ content: 'Unable to post ticket panel in this channel.' });
    }
  }
};