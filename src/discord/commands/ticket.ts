// Path: src/discord/commands/ticket.ts
import { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} from 'discord.js';

export const ticketCommand = {
  data: new SlashCommandBuilder()
    .setName('nexus-ticket-setup')
    .setDescription('Spawns the ticket creation panel in the current channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
      .setTitle('📩 Support & Help Tickets')
      .setDescription('Click the button below to open a private ticket with staff.')
      .setColor('#9333ea')
      .setFooter({ text: 'SRB NEXUS Ticket System' });

    const button = new ButtonBuilder()
      .setCustomId('nexus_create_ticket')
      .setLabel('Create Ticket')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🎫');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

    await interaction.reply({
      embeds: [embed],
      components: [row]
    });
  }
};