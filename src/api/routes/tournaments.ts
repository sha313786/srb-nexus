import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { bot } from '../../index';
import { provisionTeamDiscordSpace, deprovisionOrDisqualifyTeam } from '../../services/teamRegistrationService';
import { logger } from '../../core/logger';
import { db } from '../../core/database';

export async function tournamentRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/tournaments/approve
   * Direct trigger from valorant.ndlesports.in/admin or any admin portal
   */
  fastify.post('/api/tournaments/approve', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = (request.body || {}) as any;
      const { teamName, teamTag, tag, captainDiscord, captainIGN, game, roster, approvedBy } = body;

      if (!teamName || !teamName.trim()) {
        return reply.status(400).send({ success: false, error: 'teamName is required' });
      }

      logger.info({ body }, '[API] Received tournament team approval request');

      const result = await provisionTeamDiscordSpace(bot, {
        teamName: teamName.trim(),
        teamTag: teamTag?.trim() || tag?.trim(),
        captainDiscord: captainDiscord?.trim(),
        captainIGN: captainIGN?.trim(),
        game: game?.trim() || 'Valorant',
        roster: typeof roster === 'string' ? roster : JSON.stringify(roster || ''),
        approvedBy: approvedBy || 'Admin Portal (valorant.ndlesports.in)',
      });

      if (!result.success) {
        return reply.status(500).send(result);
      }

      return reply.send(result);
    } catch (err: any) {
      logger.error({ err }, '[API] Error in /api/tournaments/approve');
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  /**
   * POST /api/tournaments/disqualify
   * Triggered when a team is disqualified
   */
  fastify.post('/api/tournaments/disqualify', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = (request.body || {}) as any;
      const { teamName, regId, roleId, reason, executedBy } = body;

      if (!teamName && !regId && !roleId) {
        return reply.status(400).send({ success: false, error: 'teamName, regId, or roleId is required' });
      }

      logger.info({ body }, '[API] Received tournament team disqualification request');

      const result = await deprovisionOrDisqualifyTeam(bot, {
        teamName,
        regId,
        roleId,
        action: 'DISQUALIFIED',
        reason,
        executedBy: executedBy || 'Admin Portal',
      });

      return reply.send(result);
    } catch (err: any) {
      logger.error({ err }, '[API] Error in /api/tournaments/disqualify');
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  /**
   * POST /api/tournaments/delete
   * Triggered when a team is deleted
   */
  fastify.post('/api/tournaments/delete', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = (request.body || {}) as any;
      const { teamName, regId, roleId, reason, executedBy } = body;

      if (!teamName && !regId && !roleId) {
        return reply.status(400).send({ success: false, error: 'teamName, regId, or roleId is required' });
      }

      logger.info({ body }, '[API] Received tournament team deletion request');

      const result = await deprovisionOrDisqualifyTeam(bot, {
        teamName,
        regId,
        roleId,
        action: 'DELETED',
        reason,
        executedBy: executedBy || 'Admin Portal',
      });

      return reply.send(result);
    } catch (err: any) {
      logger.error({ err }, '[API] Error in /api/tournaments/delete');
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  /**
   * POST /api/tournaments/webhook
   * Supabase Database Webhook handler (triggers on team updates/deletions)
   */
  fastify.post('/api/tournaments/webhook', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = (request.body || {}) as any;
      const record = body.record || body;

      logger.info({ body }, '[API] Received tournament webhook event');

      // Check if status is approved
      if (record && (record.status === 'approved' || record.status === 'APPROVED')) {
        const teamName = record.name || record.team_name || record.team;
        if (!teamName) {
          return reply.send({ received: true, ignored: 'Missing team name' });
        }

        const result = await provisionTeamDiscordSpace(bot, {
          teamName,
          teamTag: record.tag || record.team_tag,
          captainDiscord: record.discord_id || record.captain_discord || record.discord,
          captainIGN: record.captain_name || record.captain_ign || record.captain,
          game: record.game || 'Valorant',
          roster: record.roster ? (typeof record.roster === 'string' ? record.roster : JSON.stringify(record.roster)) : '',
          approvedBy: 'Supabase Database Webhook',
        });

        return reply.send(result);
      }

      // Check if status is disqualified
      if (record && (record.status === 'disqualified' || record.status === 'DISQUALIFIED')) {
        const teamName = record.name || record.team_name || record.team;
        const result = await deprovisionOrDisqualifyTeam(bot, {
          teamName,
          regId: record.id,
          action: 'DISQUALIFIED',
          reason: record.disqualify_reason || record.reason || 'Webhook trigger',
          executedBy: 'Supabase Database Webhook',
        });
        return reply.send(result);
      }

      // Check if status is deleted
      if (record && (record.status === 'deleted' || record.status === 'DELETED')) {
        const teamName = record.name || record.team_name || record.team;
        const result = await deprovisionOrDisqualifyTeam(bot, {
          teamName,
          regId: record.id,
          action: 'DELETED',
          reason: 'Webhook record deleted',
          executedBy: 'Supabase Database Webhook',
        });
        return reply.send(result);
      }

      return reply.send({ received: true, status: record?.status || 'no-op' });
    } catch (err: any) {
      logger.error({ err }, '[API] Error in /api/tournaments/webhook');
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  /**
   * GET /api/tournaments/status
   */
  fastify.get('/api/tournaments/status', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      status: 'active',
      guild: '1558245529417293884',
      features: ['auto_role', 'auto_text_channel', 'auto_voice_channel', 'welcome_embed', 'auto_nickname_tag', 'auto_disqualify_cleanup'],
      endpoints: {
        approve: '/api/tournaments/approve',
        disqualify: '/api/tournaments/disqualify',
        delete: '/api/tournaments/delete',
        webhook: '/api/tournaments/webhook',
      },
    });
  });
}

export default tournamentRoutes;
