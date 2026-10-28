const fs = require('fs');
const path = 'I:/srb-nexus/src/discord/commands/index.ts';

let content = fs.readFileSync(path, 'utf8');

const target = `const srbStudioOnlyNames = new Set([
  'nexus-ticket',
  'nexus-ticket-setup',
  'nexus-quotation',
  'nexus-portfolio',
  'create-client',
  'approve-client',
  'sync-staff-names',
]);`;

const replacement = `const srbStudioOnlyNames = new Set([
  'nexus-quotation',
  'nexus-portfolio',
  'create-client',
  'approve-client',
  'sync-staff-names',
]);`;

const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedTarget = target.replace(/\r\n/g, '\n');

if (!normalizedContent.includes(normalizedTarget)) {
  console.error("Target not found in index.ts!");
  process.exit(1);
}

const newContent = normalizedContent.replace(normalizedTarget, replacement);
fs.writeFileSync(path, newContent, 'utf8');
console.log("Successfully patched index.ts");
