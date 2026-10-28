const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../discord/events/interactionCreate.ts');
let content = fs.readFileSync(filePath, 'utf8');
const isCrlf = content.includes('\r\n');
content = content.replace(/\r\n/g, '\n');

// 1. Add import
if (!content.includes('approveTicketAndCreateWorkspace')) {
  content = content.replace(
    "import { archiveAndSendTicketTranscript } from '../../services/transcriptService';",
    "import { archiveAndSendTicketTranscript } from '../../services/transcriptService';\nimport { approveTicketAndCreateWorkspace } from '../../services/clientWorkspaceService';"
  );
}

// 2. Add getTicketCategoryId
if (!content.includes('function getTicketCategoryId(')) {
  const helper = `function getTicketCategoryId(guild: any, configuredCatId?: string): string | undefined {
  if (configuredCatId && guild.channels.cache.has(configuredCatId)) {
    const cat = guild.channels.cache.get(configuredCatId);
    if (cat && !/upi/i.test(cat.name)) {
      return configuredCatId;
    }
  }

  const supportCenter = guild.channels.cache.find(
    (c: any) =>
      c.type === ChannelType.GuildCategory &&
      !/upi/i.test(c.name) &&
      (/support center/i.test(c.name) || c.id === '1525114945568768131' || /ticket/i.test(c.name))
  );
  if (supportCenter) return supportCenter.id;

  const fallbackCat = guild.channels.cache.find(
    (c: any) =>
      c.type === ChannelType.GuildCategory &&
      !/upi/i.test(c.name) &&
      /support/i.test(c.name)
  );
  return fallbackCat ? fallbackCat.id : undefined;
}

async function createUniversalTicket(`;

  content = content.replace('async function createUniversalTicket(', helper);
}

// 3. Fix category resolution in createUniversalTicket, inquiry, quote, meeting
content = content.replace(
  /let targetCategoryId: string \| undefined = undefined;\s*if \(configuredCatId && guild\.channels\.cache\.has\(configuredCatId\)\) \{[\s\S]*?db\.query\(`UPDATE guild_settings SET category_id = \$1 WHERE guild_id = \$2`, \[found\.id, guild\.id\]\)\.catch\(\(\) => \{\}\);\s*\}\s*\}/g,
  'const targetCategoryId = getTicketCategoryId(guild, configuredCatId);'
);

// Fix category in dropdown select
content = content.replace(
  "const categoryId = settingsRes?.rows?.[0]?.ticket_category_id;",
  "const categoryId = getTicketCategoryId(guild, settingsRes?.rows?.[0]?.category_id);"
);
content = content.replace(
  "parent: categoryId && guild.channels.cache.has(categoryId) ? categoryId : undefined,",
  "parent: categoryId,"
);

// 4. Add Approve button to action rows
// In createUniversalTicket:
content = content.replace(
  "new ButtonBuilder()\n        .setCustomId('nexus_claim_ticket')\n        .setLabel('Claim Ticket')\n        .setStyle(ButtonStyle.Primary)\n        .setEmoji('🙋‍♂️'),",
  "new ButtonBuilder()\n        .setCustomId('nexus_claim_ticket')\n        .setLabel('Claim Ticket')\n        .setStyle(ButtonStyle.Primary)\n        .setEmoji('🙋‍♂️'),\n      new ButtonBuilder()\n        .setCustomId('nexus_approve_ticket')\n        .setLabel('Approve Client')\n        .setStyle(ButtonStyle.Success)\n        .setEmoji('🤝'),"
);

// In dropdown select closeRow:
content = content.replace(
  "const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(\n        new ButtonBuilder()\n          .setCustomId('nexus_close_ticket')",
  "const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(\n        new ButtonBuilder()\n          .setCustomId('nexus_approve_ticket')\n          .setLabel('Approve Client')\n          .setStyle(ButtonStyle.Success)\n          .setEmoji('🤝'),\n        new ButtonBuilder()\n          .setCustomId('nexus_close_ticket')"
);

// In inquiry & quote actionRow:
content = content.replace(
  "new ButtonBuilder()\n          .setCustomId(`nexus_staff_create_quote_${interaction.user.id}`)\n          .setLabel('Create Quotation')\n          .setStyle(ButtonStyle.Success)\n          .setEmoji('💼'),",
  "new ButtonBuilder()\n          .setCustomId(`nexus_staff_create_quote_${interaction.user.id}`)\n          .setLabel('Create Quotation')\n          .setStyle(ButtonStyle.Success)\n          .setEmoji('💼'),\n        new ButtonBuilder()\n          .setCustomId('nexus_approve_ticket')\n          .setLabel('Approve Client')\n          .setStyle(ButtonStyle.Success)\n          .setEmoji('🤝'),"
);

content = content.replace(
  "new ButtonBuilder()\n          .setCustomId(`nexus_staff_create_quote_${interaction.user.id}`)\n          .setLabel('Create Formal Quotation')\n          .setStyle(ButtonStyle.Success)\n          .setEmoji('💼'),",
  "new ButtonBuilder()\n          .setCustomId(`nexus_staff_create_quote_${interaction.user.id}`)\n          .setLabel('Create Formal Quotation')\n          .setStyle(ButtonStyle.Success)\n          .setEmoji('💼'),\n        new ButtonBuilder()\n          .setCustomId('nexus_approve_ticket')\n          .setLabel('Approve Client')\n          .setStyle(ButtonStyle.Success)\n          .setEmoji('🤝'),"
);

// In quotation accepted:
content = content.replace(
  `    await interaction.reply({
      content: \`@here 🎉 Quotation **\${quoteId}** has been accepted by the client!\`,
      embeds: [acceptEmbed],
    });`,
  `    const acceptRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('nexus_approve_ticket')
        .setLabel('Approve Client & Launch Workspace')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🤝'),
      new ButtonBuilder()
        .setCustomId('nexus_close_ticket')
        .setLabel('Close Ticket')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔒')
    );

    await interaction.reply({
      content: \`@here 🎉 Quotation **\${quoteId}** has been accepted by the client! Staff can click below to approve and launch the client workspace.\`,
      embeds: [acceptEmbed],
      components: [acceptRow],
    });`
);

// 5. Add button and modal handlers
const handlers = `  // 3h. HANDLE APPROVE TICKET BUTTON
  if (interaction.isButton() && interaction.customId === 'nexus_approve_ticket') {
    if (!interaction.guild || !interaction.channel || !interaction.channel.isTextBased()) return;

    const member = interaction.member as any;
    const isStaff =
      member?.permissions?.has(PermissionFlagsBits.Administrator) ||
      member?.permissions?.has(PermissionFlagsBits.ManageChannels) ||
      [
        '1525076160990543892', // Founder
        '1525076232247705711', // Administrator
        '1525111469056987268', // Project Manager
        '1525111410651041973', // Support Team
        '1525095643972894730', // Developer
        '1525076321854685305', // Designer
      ].some((r) => member?.roles?.cache?.has(r));

    if (!isStaff) {
      await interaction.reply({
        content: '❌ Only designated staff members can approve clients and create workspaces.',
        ephemeral: true,
      });
      return;
    }

    const channelName = (interaction.channel as any).name || '';
    const defaultName = channelName.replace(/^(ticket|quote|report|inquiry)-/i, '').replace(/-[0-9]+$/, '') || 'Client';

    const modal = new ModalBuilder()
      .setCustomId('nexus_approve_client_modal')
      .setTitle('Approve Client & Launch Workspace');

    const nameInput = new TextInputBuilder()
      .setCustomId('client_project_name')
      .setLabel('Client or Project Name')
      .setPlaceholder('e.g. Jesse Bridals')
      .setValue(defaultName)
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const notesInput = new TextInputBuilder()
      .setCustomId('project_scope_notes')
      .setLabel('Agreed Scope & Details Discussed')
      .setPlaceholder('Enter summary of deliverables, agreed scope, deadlines, or pricing discussed...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(notesInput)
    );

    await interaction.showModal(modal);
    return;
  }

  // 3i. HANDLE APPROVE CLIENT MODAL SUBMIT
  if (interaction.isModalSubmit() && interaction.customId === 'nexus_approve_client_modal') {
    if (!interaction.guild || !interaction.channel || !interaction.channel.isTextBased()) return;

    try {
      await interaction.deferReply();

      const clientName = interaction.fields.getTextInputValue('client_project_name').trim();
      const projectNotes = interaction.fields.getTextInputValue('project_scope_notes')?.trim() || '';

      const { clientChannel } = await approveTicketAndCreateWorkspace({
        guild: interaction.guild,
        ticketChannel: interaction.channel as any,
        approvedBy: interaction.user,
        clientName,
        projectNotes,
        withVoice: true,
      });

      await interaction.editReply({
        content: \`🎉 **Client Approved!** Dedicated private workspace created at <#\${clientChannel.id}>.\\n*(This ticket channel will automatically close and delete in 5 seconds...)*\`,
      });

      setTimeout(async () => {
        await interaction.channel?.delete().catch(() => {});
      }, 5000);
    } catch (err) {
      logger.error({ err }, 'Error executing nexus_approve_client_modal');
      if (interaction.deferred) {
        await interaction.editReply({
          content: '❌ An error occurred while creating client workspace. Please check bot permissions.',
        });
      }
    }
    return;
  }

  // 4. HANDLE CLOSE TICKET BUTTON`;

if (!content.includes('nexus_approve_client_modal')) {
  content = content.replace('  // 4. HANDLE CLOSE TICKET BUTTON', handlers);
}

if (isCrlf) {
  content = content.replace(/\n/g, '\r\n');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('PATCHED_SUCCESSFULLY');
