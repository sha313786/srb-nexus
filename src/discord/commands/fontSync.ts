import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ComponentType,
  GuildBasedChannel,
  ChannelType,
} from 'discord.js';
import {
  FONT_STYLE_OPTIONS,
  SEPARATOR_OPTIONS,
  FontStyleKey,
  generateSyncPreview,
  executeBatchSync,
  transformChannelSeparator,
  transformChannelFont,
} from '../../services/fontSyncService';

function buildMainMenuEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🎨 Font Sync')
    .setDescription(
      'Choose what you want to sync:\n\n' +
      '**1. ✨ Design Sync**\n' +
      '— separators/design only\n\n' +
      '**2. 🔤 Font Sync**\n' +
      '— font style only'
    )
    .setFooter({ text: 'SRB NEXUS • Server Aesthetics' })
    .setTimestamp();
}

function buildMainMenuButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_sync_design')
      .setLabel('1. Design Sync')
      .setEmoji('✨')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('btn_sync_font')
      .setLabel('2. Font Sync')
      .setEmoji('🔤')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('btn_sync_close')
      .setLabel('Close')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Danger)
  );
}

export const fontSyncCommand = {
  data: new SlashCommandBuilder()
    .setName('font_sync')
    .setDescription('Sync aesthetic channel separators, symbols, and unicode typography across your server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
      return;
    }

    // Permission Check
    if (
      !interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) &&
      !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
    ) {
      await interaction.reply({
        content: '❌ You require **Manage Channels** or **Administrator** permissions to use Font Sync.',
        ephemeral: true,
      });
      return;
    }

    const reply = await interaction.reply({
      embeds: [buildMainMenuEmbed()],
      components: [buildMainMenuButtons()],
      ephemeral: true,
      fetchReply: true,
    });

    const collector = reply.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      time: 300000, // 5 minutes
    });

    let currentMode: 'menu' | 'design' | 'font' = 'menu';
    let selectedType: 'design' | 'font' | null = null;
    let selectedValue: string | null = null;

    collector.on('collect', async (i) => {
      try {
        // 1. Close Button
        if (i.customId === 'btn_sync_close') {
          collector.stop('closed');
          await i.update({
            content: '🔒 Font Sync session dismissed.',
            embeds: [],
            components: [],
          });
          return;
        }

        // 2. Back to Main Menu
        if (i.customId === 'btn_sync_back') {
          currentMode = 'menu';
          selectedType = null;
          selectedValue = null;
          await i.update({
            embeds: [buildMainMenuEmbed()],
            components: [buildMainMenuButtons()],
          });
          return;
        }

        // 3. Clicked "1. Design Sync"
        if (i.customId === 'btn_sync_design') {
          currentMode = 'design';
          const designEmbed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('✨ Design Sync — Separator Selection')
            .setDescription(
              'Select a clean aesthetic separator symbol to apply between channel emojis and titles across your server:\n\n' +
              SEPARATOR_OPTIONS.map((s) => `• **${s.label}** ➔ \`${s.preview}\``).join('\n')
            )
            .setFooter({ text: 'Choose from the dropdown below' });

          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_design_sep')
            .setPlaceholder('Select a separator symbol...')
            .addOptions(
              SEPARATOR_OPTIONS.map((s) =>
                new StringSelectMenuOptionBuilder()
                  .setLabel(s.label)
                  .setValue(s.symbol)
                  .setDescription(s.preview)
              )
            );

          const rowSelect = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
          const rowNav = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId('btn_sync_back')
              .setLabel('Back')
              .setEmoji('◀')
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId('btn_sync_close')
              .setLabel('Close')
              .setEmoji('❌')
              .setStyle(ButtonStyle.Danger)
          );

          await i.update({
            embeds: [designEmbed],
            components: [rowSelect, rowNav],
          });
          return;
        }

        // 4. Clicked "2. Font Sync"
        if (i.customId === 'btn_sync_font') {
          currentMode = 'font';
          const fontEmbed = new EmbedBuilder()
            .setColor(0x10b981)
            .setTitle('🔤 Font Sync — Aesthetic Typography Selection')
            .setDescription(
              'Select an aesthetic Unicode font style to transform your channel names:\n\n' +
              FONT_STYLE_OPTIONS.map((f) => `• **${f.label}**: \`${f.preview}\``).join('\n')
            )
            .setFooter({ text: 'Choose from the dropdown below' });

          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_font_style')
            .setPlaceholder('Select a typography style...')
            .addOptions(
              FONT_STYLE_OPTIONS.map((f) =>
                new StringSelectMenuOptionBuilder()
                  .setLabel(f.label)
                  .setValue(f.key)
                  .setDescription(f.preview)
              )
            );

          const rowSelect = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
          const rowNav = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId('btn_sync_back')
              .setLabel('Back')
              .setEmoji('◀')
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId('btn_sync_close')
              .setLabel('Close')
              .setEmoji('❌')
              .setStyle(ButtonStyle.Danger)
          );

          await i.update({
            embeds: [fontEmbed],
            components: [rowSelect, rowNav],
          });
          return;
        }

        // 5. Selected a Separator or Font Style from Dropdown
        if (i.isStringSelectMenu()) {
          const guildChannels = Array.from((await interaction.guild!.channels.fetch()).values()).filter(
            Boolean
          ) as GuildBasedChannel[];

          if (i.customId === 'select_design_sep') {
            selectedType = 'design';
            selectedValue = i.values[0];
          } else if (i.customId === 'select_font_style') {
            selectedType = 'font';
            selectedValue = i.values[0];
          }

          if (!selectedType || !selectedValue) return;

          const previewItems = generateSyncPreview(guildChannels, selectedType, selectedValue, 5);
          const previewText =
            previewItems.length > 0
              ? previewItems.map((p) => `• \`# ${p.oldName}\` ➔ \`# ${p.newName}\``).join('\n')
              : '*(No changes detected — channels already match this style)*';

          const styleName =
            selectedType === 'design'
              ? `Separator Symbol: \`${selectedValue}\``
              : `Font Style: \`${FONT_STYLE_OPTIONS.find((f) => f.key === selectedValue)?.label || selectedValue}\``;

          const confirmEmbed = new EmbedBuilder()
            .setColor(0xf59e0b)
            .setTitle(`⚡ Preview: Apply ${selectedType === 'design' ? 'Design' : 'Font'} Sync`)
            .setDescription(
              `**Selected Option:** ${styleName}\n\n` +
              `**Channel Preview (First 5 channels):**\n${previewText}\n\n` +
              `Choose where to apply these changes below. ` +
              `To protect your server against Discord rate limits, updates are queued with a gentle pause between renames.`
            )
            .setFooter({ text: 'Select target scope to proceed' });

          const rowScope = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId('btn_apply_all')
              .setLabel('Apply to All (Channels & Categories)')
              .setEmoji('⚡')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId('btn_apply_text')
              .setLabel('Text Channels Only')
              .setEmoji('💬')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId('btn_apply_cat')
              .setLabel('Categories Only')
              .setEmoji('📁')
              .setStyle(ButtonStyle.Primary)
          );

          const rowNav = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId('btn_sync_back')
              .setLabel('Change Selection')
              .setEmoji('◀')
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId('btn_sync_close')
              .setLabel('Cancel')
              .setEmoji('❌')
              .setStyle(ButtonStyle.Danger)
          );

          await i.update({
            embeds: [confirmEmbed],
            components: [rowScope, rowNav],
          });
          return;
        }

        // 6. Clicked an Apply Button
        if (
          i.customId === 'btn_apply_all' ||
          i.customId === 'btn_apply_text' ||
          i.customId === 'btn_apply_cat'
        ) {
          if (!selectedType || !selectedValue) return;

          const allChannels = Array.from((await interaction.guild!.channels.fetch()).values()).filter(
            Boolean
          ) as GuildBasedChannel[];

          let targetChannels: GuildBasedChannel[] = [];
          let scopeName = 'All Channels & Categories';

          if (i.customId === 'btn_apply_text') {
            targetChannels = allChannels.filter((c) => c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement);
            scopeName = 'Text & Announcement Channels';
          } else if (i.customId === 'btn_apply_cat') {
            targetChannels = allChannels.filter((c) => c.type === ChannelType.GuildCategory);
            scopeName = 'Category Channels';
          } else {
            targetChannels = allChannels.filter(
              (c) =>
                c.type === ChannelType.GuildText ||
                c.type === ChannelType.GuildVoice ||
                c.type === ChannelType.GuildCategory ||
                c.type === ChannelType.GuildAnnouncement
            );
          }

          // Initial progress embed
          const progressEmbed = new EmbedBuilder()
            .setColor(0x3b82f6)
            .setTitle('⏳ Applying Font & Design Sync...')
            .setDescription(
              `Synchronizing **${targetChannels.length}** channels under **${scopeName}**.\n\n` +
              `*Applying updates safely with Discord rate-limit protection. Please keep this menu open...*`
            )
            .setFooter({ text: 'In Progress • SRB NEXUS' });

          await i.update({
            embeds: [progressEmbed],
            components: [], // Disable components during active execution
          });

          // Run batch sync
          const startTime = Date.now();
          const result = await executeBatchSync(
            targetChannels,
            selectedType,
            selectedValue,
            async (cur, total, name) => {
              const liveEmbed = new EmbedBuilder()
                .setColor(0x3b82f6)
                .setTitle('⏳ Applying Font & Design Sync...')
                .setDescription(
                  `Synchronizing **${scopeName}**:\n` +
                  `**Progress:** \`${cur} / ${total}\` (${Math.round((cur / total) * 100)}%)\n` +
                  `**Last Renamed:** \`${name}\`\n\n` +
                  `*Processing safely to prevent Discord API rate limits...*`
                )
                .setFooter({ text: 'Renaming in progress...' });

              await interaction.editReply({ embeds: [liveEmbed] }).catch(() => {});
            }
          );

          const durationSeconds = Math.round((Date.now() - startTime) / 1000);

          const doneEmbed = new EmbedBuilder()
            .setColor(result.failed > 0 ? 0xf59e0b : 0x10b981)
            .setTitle('🎉 Font & Design Sync Completed!')
            .setDescription(
              `Successfully finished synchronizing **${scopeName}**!\n\n` +
              `• **Channels Renamed:** \`${result.updated}\`\n` +
              `• **Already Matching / Skipped:** \`${result.skipped}\`\n` +
              `• **Rate Limit / Failed:** \`${result.failed}\`\n` +
              `• **Time Elapsed:** \`${durationSeconds}s\`\n\n` +
              `*All channel aesthetic styling is now live across your server!*`
            )
            .setFooter({ text: 'SRB NEXUS Aesthetics Engine' })
            .setTimestamp();

          await interaction.editReply({
            embeds: [doneEmbed],
            components: [],
          });

          collector.stop('finished');
          return;
        }
      } catch (err: any) {
        collector.stop('error');
        await interaction.editReply({
          content: `❌ An unexpected error occurred: ${err.message}`,
          embeds: [],
          components: [],
        }).catch(() => {});
      }
    });

    collector.on('end', async (_, reason) => {
      if (reason === 'time') {
        await interaction.editReply({
          content: '⏱️ Font Sync session timed out. Type `/font_sync` to start again.',
          embeds: [],
          components: [],
        }).catch(() => {});
      }
    });
  },
};

// Also export alias with hyphen
export const fontSyncHyphenCommand = {
  ...fontSyncCommand,
  data: new SlashCommandBuilder()
    .setName('font-sync')
    .setDescription('Sync aesthetic channel separators, symbols, and unicode typography across your server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false),
};
