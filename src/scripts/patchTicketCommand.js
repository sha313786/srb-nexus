const fs = require('fs');
const path = 'I:/srb-nexus/src/discord/commands/ticket.ts';

let content = fs.readFileSync(path, 'utf8');

const target = `    if (interaction.guildId !== '1525065834572021851') {
      await interaction.reply({
        content: '❌ The \`/nexus-ticket\` project workflow commands are exclusively configured for **SRB Studio**.',
        ephemeral: true,
      });
      return;
    }`;

const replacement = `    const studioOnlySubcommands = ['deploy-panels', 'deploy-inquiry', 'deploy-quote', 'quote-form', 'inquiry-form'];
    if (studioOnlySubcommands.includes(subcommand) && interaction.guildId !== '1525065834572021851') {
      await interaction.reply({
        content: '❌ Project inquiry and quotation commands are exclusively configured for **SRB Studio**.',
        ephemeral: true,
      });
      return;
    }

    // Safety & permission check for ticket channel management subcommands
    if (['close', 'add', 'remove', 'rename'].includes(subcommand)) {
      const isTicketChannel =
        channel.name.startsWith('ticket-') ||
        channel.name.startsWith('quote-') ||
        channel.name.startsWith('inquiry-') ||
        channel.name.startsWith('client-') ||
        channel.name.startsWith('🔒');

      const ticketDb = await db.query(
        \`SELECT user_id FROM guild_tickets WHERE channel_id = $1\`,
        [channel.id]
      ).catch(() => null);

      if (!isTicketChannel && (!ticketDb || ticketDb.rows.length === 0)) {
        await interaction.reply({
          content: '❌ This command can only be used inside an active ticket channel.',
          ephemeral: true,
        });
        return;
      }

      const member = interaction.member as any;
      const settingsRes = await db.query(
        \`SELECT support_role_id FROM guild_settings WHERE guild_id = $1\`,
        [guild.id]
      ).catch(() => null);
      const supportRoleId = settingsRes?.rows?.[0]?.support_role_id;

      const isStaff =
        member?.permissions?.has(PermissionFlagsBits.Administrator) ||
        member?.permissions?.has(PermissionFlagsBits.ManageChannels) ||
        (supportRoleId && member?.roles?.cache?.has(supportRoleId)) ||
        (guild.id === '1525065834572021851' && member?.roles?.cache?.has('1525111410651041973'));

      const isTicketOwner = ticketDb?.rows?.[0]?.user_id === interaction.user.id;

      if (!isStaff && !isTicketOwner) {
        await interaction.reply({
          content: '❌ Only support staff or the ticket creator can manage this ticket.',
          ephemeral: true,
        });
        return;
      }
    }`;

// Normalize line endings for replacement
const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedTarget = target.replace(/\r\n/g, '\n');

if (!normalizedContent.includes(normalizedTarget)) {
  console.error("Target not found!");
  process.exit(1);
}

const newContent = normalizedContent.replace(normalizedTarget, replacement);
fs.writeFileSync(path, newContent, 'utf8');
console.log("Successfully patched ticket.ts");
