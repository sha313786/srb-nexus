const fs = require('fs');
const path = 'I:/srb-nexus/src/discord/events/interactionCreate.ts';

let content = fs.readFileSync(path, 'utf8');

const target = `      const closeRow = new ActionRowBuilder<ButtonBuilder>();
      if (guild.id === '1525065834572021851') {
        closeRow.addComponents(
          new ButtonBuilder()
            .setCustomId('nexus_approve_ticket')
            .setLabel('Approve Client')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🤝')
        );
      }
      closeRow.addComponents(
        new ButtonBuilder()
          .setCustomId('nexus_close_ticket')
          .setLabel('Close Ticket')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔒')
      );`;

const replacement = `      const closeRow = new ActionRowBuilder<ButtonBuilder>();
      if (category === 'website-quote') {
        closeRow.addComponents(
          new ButtonBuilder()
            .setCustomId('nexus_open_quote_modal')
            .setLabel('Fill Quotation Form')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📝')
        );
      }
      closeRow.addComponents(
        new ButtonBuilder()
          .setCustomId('nexus_claim_ticket')
          .setLabel('Claim Ticket')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🙋‍♂️')
      );
      if (guild.id === '1525065834572021851') {
        closeRow.addComponents(
          new ButtonBuilder()
            .setCustomId('nexus_approve_ticket')
            .setLabel('Approve Client')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🤝')
        );
      }
      closeRow.addComponents(
        new ButtonBuilder()
          .setCustomId('nexus_close_ticket')
          .setLabel('Close Ticket')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔒')
      );`;

const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedTarget = target.replace(/\r\n/g, '\n');

if (!normalizedContent.includes(normalizedTarget)) {
  console.error("Target not found in interactionCreate.ts!");
  process.exit(1);
}

const newContent = normalizedContent.replace(normalizedTarget, replacement);
fs.writeFileSync(path, newContent, 'utf8');
console.log("Successfully patched interactionCreate.ts");
