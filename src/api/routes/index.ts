import { FastifyInstance } from 'fastify';
import { guildRoutes } from './guilds';
import { welcomeRoutes } from './welcome';
import { moderationRoutes } from './moderation';
import { levelsRoutes } from './levels';
import { musicRoutes } from './music';
import { economyRoutes } from './economy';
import { ticketRoutes } from './tickets';

/**
 * Global Route Register
 * Bundles core guild endpoints alongside individual dashboard module endpoints.
 */
export async function registerRoutes(fastify: FastifyInstance) {
  // Core Guild Management (List guilds, fetch channels/roles, global settings)
  await fastify.register(guildRoutes);

  // Feature Modules
  await fastify.register(welcomeRoutes);      // Join/Leave messages, autoroles, greetings
  await fastify.register(moderationRoutes);   // Auto-mod, anti-links, anti-spam, audit logs
  await fastify.register(levelsRoutes);       // Rank cards, XP rates, level-up channels
  await fastify.register(musicRoutes);        // DJ roles, default volumes, maximum queue lengths
  await fastify.register(economyRoutes);      // Daily rewards, shop setup, currency configuration
  await fastify.register(ticketRoutes);       // Support categories, transcript logs, support roles
}

export default registerRoutes;