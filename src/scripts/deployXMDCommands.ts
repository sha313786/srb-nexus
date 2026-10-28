import { REST, Routes } from 'discord.js';
import * as dotenv from 'dotenv';
import { xmdTraineeCommand } from '../discord/commands/xmdTrainee';
import { xmdPromotionCommand } from '../discord/commands/xmdPromotion';

dotenv.config();

const CLIENT_ID = '1526885301736177705';
const XMD_GUILD_ID = '1525390373281857546';

async function main() {
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    throw new Error('DISCORD_TOKEN not set');
  }

  const rest = new REST({ version: '10' }).setToken(token);

  const xmdCommands = [
    xmdTraineeCommand.data.toJSON(),
    xmdPromotionCommand.data.toJSON(),
  ];

  console.log(`Registering ${xmdCommands.length} guild slash commands for XLANTIS Medical Department...`);
  const result = await rest.put(Routes.applicationGuildCommands(CLIENT_ID, XMD_GUILD_ID), {
    body: xmdCommands,
  });

  console.log('Result:', result);
  console.log('✅ Successfully registered /xmd-trainee and /xmd-promotion in XLANTIS Medical Department!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Registration failed:', err);
  process.exit(1);
});
