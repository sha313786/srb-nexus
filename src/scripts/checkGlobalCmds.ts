import { REST, Routes } from 'discord.js';
import * as dotenv from 'dotenv';
dotenv.config();

const CLIENT_ID = '1526885301736177705';

async function main() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);
  const globalCmds: any = await rest.get(Routes.applicationCommands(CLIENT_ID));
  console.log(`Global commands total: ${globalCmds.length}`);
  const xmdInGlobal = globalCmds.filter((c: any) => c.name.startsWith('xmd'));
  console.log('XMD commands in global:', xmdInGlobal.map((c: any) => c.name));
  process.exit(0);
}

main().catch(console.error);
