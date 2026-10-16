import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import {
  getGuildTag,
  listGuildTags,
  upsertGuildTag,
  deleteGuildTag,
  formatTagMessage,
} from '../../services/tagEngine';

export const tagCommand = {
  data: new SlashCommandBuilder()
    .setName('tag')
    .setDescription('Custom server auto-responders, FAQs, and tags')
    .addSubcommand((sub) =>
      sub
        .setName('get')
        .setDescription('Retrieve and display a tag')
        .addStringOption((opt) =>
          opt
            .setName('name')
            .setDescription('Name of the tag (e.g. pricing, rules, faq)')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('List all tags registered on this server')
    )
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Create or update a tag (Requires Manage Messages)')
        .addStringOption((opt) =>
          opt
            .setName('name')
            .setDescription('Trigger name (alphanumeric, no spaces)')
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('content')
            .setDescription('Text or embed message content')
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('title')
            .setDescription('Optional embed title')
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName('color')
            .setDescription('Optional hex color code (e.g. #5865F2)')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('delete')
        .setDescription('Delete a tag (Requires Manage Messages)')
        .addStringOption((opt) =>
          opt
            .setName('name')
            .setDescription('Name of the tag to delete')
            .setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const sub = interaction.options.getSubcommand();

    if (sub === 'get') {
      const tagName = interaction.options.getString('name', true);
      const tag = await getGuildTag(interaction.guild.id, tagName);

      if (!tag) {
        await interaction.reply({
          content: `❌ Tag \`${tagName}\` was not found. Use \`/tag list\` to view available tags.`,
          ephemeral: true,
        });
        return;
      }

      const formatted = formatTagMessage(tag);
      await interaction.reply(formatted);
    } else if (sub === 'list') {
      const tags = await listGuildTags(interaction.guild.id);
      if (tags.length === 0) {
        await interaction.reply({
          content: 'ℹ️ No tags have been created on this server yet. Staff can use `/tag create` or configure them from the dashboard.',
          ephemeral: true,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`🏷️ Tags for ${interaction.guild.name}`)
        .setDescription(
          tags.map((t) => `• **${t.name}** — ${t.embed_title ? `*${t.embed_title}*` : t.content.slice(0, 40) + '...'}`).join('\n')
        )
        .setFooter({ text: `${tags.length} total tags • Use /tag get [name]` });

      await interaction.reply({ embeds: [embed] });
    } else if (sub === 'create') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
        await interaction.reply({ content: '❌ You require "Manage Messages" permission to create tags.', ephemeral: true });
        return;
      }

      const name = interaction.options.getString('name', true);
      const content = interaction.options.getString('content', true);
      const title = interaction.options.getString('title') || undefined;
      const color = interaction.options.getString('color') || '#5865F2';

      const res = await upsertGuildTag(interaction.guild.id, name, content, title, color, interaction.user.id);
      if (!res.success) {
        await interaction.reply({ content: `❌ Error saving tag: ${res.error}`, ephemeral: true });
        return;
      }

      await interaction.reply({
        content: `✅ Tag **${name}** saved successfully! You can invoke it anytime with \`/tag get name:${name}\` or by typing \`!${name}\` in chat.`,
      });
    } else if (sub === 'delete') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
        await interaction.reply({ content: '❌ You require "Manage Messages" permission to delete tags.', ephemeral: true });
        return;
      }

      const name = interaction.options.getString('name', true);
      const deleted = await deleteGuildTag(interaction.guild.id, name);

      if (!deleted) {
        await interaction.reply({ content: `❌ Tag \`${name}\` does not exist.`, ephemeral: true });
        return;
      }

      await interaction.reply({ content: `🗑️ Tag **${name}** has been deleted.` });
    }
  },
};
