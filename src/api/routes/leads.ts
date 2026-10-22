import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import axios from 'axios';
import { logger } from '../../core/logger';

// In-Memory IP rate limiter: 5 submissions per 10 minutes per IP
const ipRateLimit = new Map<string, { count: number; firstAt: number }>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const MAX_LEADS_PER_WINDOW = 5;

// Disposable domains check
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', '10minutemail.com',
  'trashmail.com', 'dispostable.com', 'getairmail.com', 'sharklasers.com',
  'throwawaymail.com', 'yopmail.com', 'burnermail.io', 'dropmail.me'
]);

export interface StudioLeadPayload {
  name?: string;
  email?: string;
  service?: string;
  notes?: string;
  honeypot?: string;
}

export async function leadsRoutes(fastify: FastifyInstance) {
  // CORS Preflight
  fastify.options('/api/leads', async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Accept');
    return reply.status(204).send();
  });

  fastify.post('/api/leads', async (request: FastifyRequest, reply: FastifyReply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Accept');

    const body = (request.body as StudioLeadPayload) || {};
    const clientIp = (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || request.ip || 'unknown';

    // 1. Rate Limiting
    const now = Date.now();
    const current = ipRateLimit.get(clientIp) || { count: 0, firstAt: now };
    if (now - current.firstAt > RATE_LIMIT_WINDOW_MS) {
      current.count = 1;
      current.firstAt = now;
    } else {
      current.count++;
    }
    ipRateLimit.set(clientIp, current);

    if (current.count > MAX_LEADS_PER_WINDOW) {
      logger.warn({ clientIp }, '[LEADS RELAY] Rate limit triggered');
      return reply.status(429).send({ success: false, error: 'Too many requests. Please try again later.' });
    }

    // 2. Honeypot check
    if (body.honeypot && body.honeypot.trim().length > 0) {
      logger.warn({ clientIp, honeypot: body.honeypot }, '[LEADS RELAY] Honeypot triggered');
      // Stealth drop: return success so bot doesn't retry
      return reply.send({ success: true, message: 'Received' });
    }

    const name = String(body.name || 'Anonymous Client').slice(0, 100).trim();
    const email = String(body.email || '').slice(0, 150).trim();
    const service = String(body.service || 'General Inquiry').slice(0, 100).trim();
    const notes = String(body.notes || 'None provided').slice(0, 2000).trim();

    // 3. Email domain check
    const emailDomain = email.split('@')[1]?.toLowerCase();
    if (emailDomain && DISPOSABLE_DOMAINS.has(emailDomain)) {
      logger.warn({ emailDomain }, '[LEADS RELAY] Disposable email dropped');
      return reply.status(400).send({ success: false, error: 'Please use a valid company or personal email.' });
    }

    // 4. Dispatch to Discord Webhook from Server
    const webhookUrl = process.env.DISCORD_LEAD_WEBHOOK_URL || process.env.STUDIO_LEAD_WEBHOOK_URL;
    if (webhookUrl) {
      const waMessage = `*SRB STUDIO — Project Inquiry*\n\n` +
        `Hi SRB Studio, I just submitted an inquiry on your website:\n` +
        `• *Name*: ${name}\n` +
        `• *Email*: ${email}\n` +
        `• *Service*: ${service}\n` +
        `• *Project Details*: ${notes}\n\n` +
        `Let's connect and discuss next steps!`;
      const waUrl = `https://wa.me/917559084152?text=${encodeURIComponent(waMessage)}`;

      try {
        await axios.post(webhookUrl, {
          username: 'SRB Studios Inquiries',
          avatar_url: 'https://raw.githubusercontent.com/sha313786/srb-studios/main/assets/images/logo.png',
          embeds: [
            {
              title: '🚀 New Project Proposal Submitted!',
              color: 0xf59e0b,
              description: 'A new client inquiry was safely relayed from your website via the SRB NEXUS Sovereign Backend.',
              fields: [
                { name: '👤 Client / Company', value: `**${name}**`, inline: true },
                { name: '📧 Email', value: `[${email}](mailto:${email})`, inline: true },
                { name: '🛠️ Service Category', value: `\`${service}\``, inline: false },
                { name: '📝 Vision & Requirements', value: notes, inline: false },
                { name: '💬 Immediate WhatsApp Action', value: `[Open WhatsApp Chat with ${name}](${waUrl})`, inline: false },
              ],
              footer: { text: 'SRB Studio • Secure Server-Side Relay (Zero Client Exposure)' },
              timestamp: new Date().toISOString(),
            },
          ],
        });
        logger.info({ name, email }, '[LEADS RELAY] Securely dispatched lead to Discord');
      } catch (err: any) {
        logger.error({ err: err.message }, '[LEADS RELAY] Failed to dispatch Discord webhook');
      }
    } else {
      logger.warn('[LEADS RELAY] DISCORD_LEAD_WEBHOOK_URL not set in environment variables');
    }

    return reply.send({
      success: true,
      message: 'Inquiry received and processed securely',
    });
  });
}
