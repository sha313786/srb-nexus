import { Client, GatewayIntentBits } from 'discord.js';

// Import specific function handlers directly
import { handleGuildCreate } from './events/guildCreate';
import { handleInteractionCreate } from './events/interactionCreate';
import { handleMessageCreate } from './events/messageCreate';
import { handleReady } from './events/ready';
import { execute as handleGuildMemberAdd } from './events/guildMemberAdd';
import { execute as handleGuildMemberRemove } from './events/guildMemberRemove';

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Event Bindings
client.on('ready', () => handleReady(client));
client.on('guildCreate', (guild) => handleGuildCreate(guild));
client.on('interactionCreate', (interaction) => handleInteractionCreate(interaction));
client.on('messageCreate', (message) => handleMessageCreate(message));
client.on('guildMemberAdd', (member) => handleGuildMemberAdd(member));
client.on('guildMemberRemove', (member) => handleGuildMemberRemove(member));