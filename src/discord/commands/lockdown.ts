import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, TextChannel } from 'discord.js';

export const lockdownCommand = {
  data: new SlashCommandBuilder()
    .setName('nexus-lockdown')
    .setDescription('Toggles emergency server lockdown state')
    .addStringOption((opt) =>
      opt
        .setName('mode')
        .setDescription('Lockdown state mode')
        .setRequired(true)
        .addChoices(
          { name: 'Enable Lockdown', value: 'LOCK' },
          { name: 'Lift Lockdown', value: 'UNLOCK' }
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const mode = interaction.options.getString('mode', true);
    const channel = interaction.channel;

    if (!(channel instanceof TextChannel)) {
      await interaction.reply({ content: 'Lockdown command must be executed in a standard text channel.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    const everyoneRole = interaction.guild.roles.everyone;

    if (mode === 'LOCK') {
      await channel.permissionOverwrites.edit(everyoneRole, { SendMessages: false });
      await interaction.editReply(`🚨 **EMERGENCY LOCKDOWN ACTIVATED in <#${channel.id}>**. Send permissions disabled for \`@everyone\`.`);
    } else {
      await channel.permissionOverwrites.edit(everyoneRole, { SendMessages: null });
      await interaction.editReply(`🟢 **LOCKDOWN LIFTED in <#${channel.id}>**. Standard permissions restored.`);
    }
  },
};