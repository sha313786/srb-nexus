import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyJwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import {
  Client,
  GatewayIntentBits,
  Guild,
  Events,
  GuildMember,
  Message,
  EmbedBuilder,
  AttachmentBuilder,
  ActivityType,
  Partials,
  VoiceState,
} from 'discord.js';

// Register cross-platform fonts for Canvas rendering on Linux/Docker/Render
try {
  const fontDir = fs.existsSync(path.join(__dirname, '../assets/fonts'))
    ? path.join(__dirname, '../assets/fonts')
    : fs.existsSync(path.join(__dirname, 'assets/fonts'))
    ? path.join(__dirname, 'assets/fonts')
    : path.join(process.cwd(), 'assets/fonts');

  if (fs.existsSync(path.join(fontDir, 'Outfit.ttf'))) {
    GlobalFonts.registerFromPath(path.join(fontDir, 'Outfit.ttf'), 'Outfit');
  }
  if (fs.existsSync(path.join(fontDir, 'JetBrainsMono.ttf'))) {
    GlobalFonts.registerFromPath(path.join(fontDir, 'JetBrainsMono.ttf'), 'JetBrainsMono');
  }
  console.log('[CANVAS] Successfully registered custom fonts (Outfit, JetBrainsMono)');
} catch (fontErr) {
  console.error('[CANVAS] Failed to register custom fonts', fontErr);
}

import { db } from './core/database';
import { authRoutes } from './api/routes/auth';
import { guildRoutes } from './api/routes/guilds';

// Import Slash Command Register & Interaction Handler
import { registerSlashCommands } from './discord/commands';
import { handleInteractionCreate } from './discord/events/interactionCreate';
import { handleMessageCreate as processSecurityAndSpam } from './discord/events/messageCreate';
import { processAntiRaid } from './security/antiRaid';
import { startBackgroundSchedulers } from './services/cronTasks';
import { startFreeGamesWatcher } from './services/liveNotifications';
import { startStreamWatcher } from './services/streamNotifications';
import {
  initInviteTracker,
  detectUsedInvite,
  handleInviteRoleAssignment,
} from './services/inviteTracker';
import { handleTempVoiceStateUpdate } from './services/tempVoice';
import { updateGuildVoiceStats } from './services/voiceStats';

dotenv.config();

const app = Fastify({ 
  logger: true,
  trustProxy: true,
});

export const bot = new Client({
  rest: {
    api: process.env.DISCORD_API_BASE_URL
      ? `${process.env.DISCORD_API_BASE_URL.replace(/\/$/, '')}/api`
      : 'https://discord.com/api',
    headers: process.env.DISCORD_PROXY_SECRET
      ? { 'x-proxy-auth': process.env.DISCORD_PROXY_SECRET }
      : undefined,
  },
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message],
});

let lastBotError: { message: string; code?: string | number; attempt: number; timestamp: string } | null = null;
let lastBotRateLimit: any = null;
let lastDebugEvents: string[] = [];

bot.on('debug', (info: string) => {
  const line = `${new Date().toISOString().slice(11, 19)}: ${info}`;
  lastDebugEvents.push(line);
  if (lastDebugEvents.length > 10) lastDebugEvents.shift();
  app.log.debug(`[DISCORD DEBUG] ${info}`);
});

bot.rest.on('rateLimited', (info: any) => {
  lastBotRateLimit = {
    ...info,
    timestamp: new Date().toISOString(),
  };
  app.log.warn({ info }, `[BOT] Discord.js REST rate limited on ${info.route}. Retry after: ${info.timeToReset}ms`);
});

// Helper function to insert/sync guild
async function registerGuild(guildId: string, guildName?: string) {
  await db.query(
    `INSERT INTO guild_settings (guild_id) VALUES ($1) ON CONFLICT (guild_id) DO NOTHING`,
    [guildId]
  );
  if (guildName) {
    app.log.info(`[BOT] Registered server in database: ${guildName} (${guildId})`);
  }
}

// Helper function to dynamically generate welcome card using Canvas
export async function createWelcomeCard(
  member: GuildMember,
  customBgUrl?: string | null
): Promise<AttachmentBuilder> {
  const canvas = createCanvas(1024, 450);
  const ctx = canvas.getContext('2d');

  let bgLoaded = false;

  // 1. Base Wallpaper
  if (customBgUrl && customBgUrl.startsWith('http')) {
    try {
      const bgImage = await loadImage(customBgUrl);
      ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(5, 7, 12, 0.60)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      bgLoaded = true;
    } catch (err) {
      console.error('[BOT] Failed to load custom background image, using procedural theme', err);
    }
  }

  if (!bgLoaded) {
    const t = (customBgUrl || 'cyber').toLowerCase();
    if (t === 'space') {
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, '#03050e');
      grad.addColorStop(0.5, '#0c0822');
      grad.addColorStop(1, '#05020d');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const n1 = ctx.createRadialGradient(250, 150, 20, 250, 150, 320);
      n1.addColorStop(0, 'rgba(139, 92, 246, 0.32)');
      n1.addColorStop(1, 'rgba(139, 92, 246, 0)');
      ctx.fillStyle = n1;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const n2 = ctx.createRadialGradient(820, 280, 20, 820, 280, 360);
      n2.addColorStop(0, 'rgba(59, 130, 246, 0.28)');
      n2.addColorStop(1, 'rgba(59, 130, 246, 0)');
      ctx.fillStyle = n2;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#ffffff';
      const stars = [
        [80, 50, 1.5, 0.8], [140, 120, 1.2, 0.6], [220, 40, 2, 0.9], [310, 95, 1, 0.5],
        [420, 60, 1.8, 0.7], [530, 130, 1.2, 0.6], [640, 45, 2.2, 0.9], [750, 110, 1, 0.4],
        [880, 55, 1.7, 0.8], [950, 90, 1.2, 0.5], [60, 320, 1.5, 0.7], [180, 380, 1, 0.4],
        [270, 350, 2, 0.8], [390, 400, 1.4, 0.6], [510, 360, 1, 0.5], [680, 390, 1.8, 0.7],
        [790, 340, 1.2, 0.6], [890, 410, 2.1, 0.9], [970, 330, 1, 0.5]
      ];
      for (const [x, y, r, a] of stars) {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    } else if (t === 'aurora') {
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, '#020912');
      grad.addColorStop(0.6, '#041822');
      grad.addColorStop(1, '#020d14');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const a1 = ctx.createLinearGradient(0, 30, canvas.width, 240);
      a1.addColorStop(0, 'rgba(16, 185, 129, 0)');
      a1.addColorStop(0.35, 'rgba(16, 185, 129, 0.35)');
      a1.addColorStop(0.7, 'rgba(6, 182, 212, 0.28)');
      a1.addColorStop(1, 'rgba(16, 185, 129, 0)');
      ctx.fillStyle = a1;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (t === 'obsidian' || t === 'gold') {
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, '#060608');
      grad.addColorStop(0.5, '#141007');
      grad.addColorStop(1, '#080603');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const g1 = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 40, canvas.width / 2, canvas.height / 2, 460);
      g1.addColorStop(0, 'rgba(245, 158, 11, 0.20)');
      g1.addColorStop(1, 'rgba(245, 158, 11, 0)');
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (t === 'synthwave') {
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, '#1d072a');
      grad.addColorStop(0.55, '#3b0730');
      grad.addColorStop(1, '#0a0210');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const sunGrad = ctx.createRadialGradient(canvas.width / 2, 210, 10, canvas.width / 2, 210, 115);
      sunGrad.addColorStop(0, '#ff007f');
      sunGrad.addColorStop(0.6, '#f43f5e');
      sunGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(canvas.width / 2, 210, 115, 0, Math.PI * 2);
      ctx.fill();
    } else if (t === 'matrix') {
      ctx.fillStyle = '#020904';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = 'rgba(0, 255, 100, 0.08)';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
    } else if (t === 'minimal') {
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, '#090b10');
      grad.addColorStop(0.5, '#10141d');
      grad.addColorStop(1, '#080a0e');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      // Cyber Neon (Default)
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, '#050711');
      grad.addColorStop(0.5, '#091026');
      grad.addColorStop(1, '#0f081c');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = 'rgba(0, 240, 255, 0.06)';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      const hLine = ctx.createLinearGradient(0, canvas.height / 2, canvas.width, canvas.height / 2);
      hLine.addColorStop(0, 'rgba(0, 240, 255, 0)');
      hLine.addColorStop(0.5, 'rgba(0, 240, 255, 0.18)');
      hLine.addColorStop(1, 'rgba(0, 240, 255, 0)');
      ctx.fillStyle = hLine;
      ctx.fillRect(0, canvas.height / 2 - 2, canvas.width, 4);
    }
  }

  // 2. Central Frosted Glass Panel
  const panelX = 35, panelY = 35, panelW = 954, panelH = 380, panelR = 24;
  ctx.save();
  ctx.fillStyle = 'rgba(9, 14, 26, 0.80)';
  ctx.beginPath();
  ctx.roundRect(panelX, panelY, panelW, panelH, panelR);
  ctx.fill();

  ctx.strokeStyle = 'rgba(0, 240, 255, 0.28)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // 3. Cyber Corner Accent Brackets
  const cornerLen = 28;
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';

  // Top-Left
  ctx.beginPath();
  ctx.moveTo(panelX + cornerLen, panelY);
  ctx.lineTo(panelX + 4, panelY);
  ctx.lineTo(panelX + 4, panelY + cornerLen);
  ctx.stroke();

  // Top-Right
  ctx.beginPath();
  ctx.moveTo(panelX + panelW - cornerLen, panelY);
  ctx.lineTo(panelX + panelW - 4, panelY);
  ctx.lineTo(panelX + panelW - 4, panelY + cornerLen);
  ctx.stroke();

  // Bottom-Left
  ctx.beginPath();
  ctx.moveTo(panelX + cornerLen, panelY + panelH);
  ctx.lineTo(panelX + 4, panelY + panelH);
  ctx.lineTo(panelX + 4, panelY + panelH - cornerLen);
  ctx.stroke();

  // Bottom-Right
  ctx.beginPath();
  ctx.moveTo(panelX + panelW - cornerLen, panelY + panelH);
  ctx.lineTo(panelX + panelW - 4, panelY + panelH);
  ctx.lineTo(panelX + panelW - 4, panelY + panelH - cornerLen);
  ctx.stroke();

  // 4. Top-Right Protocol Tag
  ctx.save();
  ctx.fillStyle = 'rgba(0, 240, 255, 0.08)';
  ctx.beginPath();
  ctx.roundRect(750, 56, 210, 32, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Glowing status dot
  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ctx.arc(766, 72, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 11px JetBrainsMono, Outfit, sans-serif';
  ctx.fillText('SRB NEXUS GATEWAY', 780, 76);
  ctx.restore();

  // 5. User Avatar Area
  const avatarCenterX = 195;
  const avatarCenterY = 225;
  const avatarRadius = 88;

  try {
    const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
    const avatar = await loadImage(avatarUrl);

    // Glowing Cyan Outer Halo
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarCenterX, avatarCenterY, avatarRadius + 6, 0, Math.PI * 2);
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(avatarCenterX, avatarCenterY, avatarRadius + 1, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Clipped circular avatar
    ctx.beginPath();
    ctx.arc(avatarCenterX, avatarCenterY, avatarRadius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, avatarCenterX - avatarRadius, avatarCenterY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
    ctx.restore();

    // Online Status Badge on Avatar
    ctx.beginPath();
    ctx.arc(avatarCenterX + 60, avatarCenterY + 60, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#10b981';
    ctx.fill();
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 4;
    ctx.stroke();
  } catch (err) {
    console.error('[BOT] Failed to draw avatar on canvas', err);
  }

  // 6. Typography & Text Hierarchy
  // Subtitle
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 13px JetBrainsMono, monospace, sans-serif';
  ctx.fillText('// NEW OPERATIVE JOINED', 335, 145);

  // Server Name
  const serverName = member.guild.name.toUpperCase();
  const truncatedServer = serverName.length > 24 ? serverName.slice(0, 22) + '...' : serverName;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px Outfit, sans-serif';
  ctx.fillText(`WELCOME TO ${truncatedServer}`, 335, 192);

  // Username
  ctx.fillStyle = '#00f0ff';
  ctx.font = 'bold 38px Outfit, sans-serif';
  ctx.fillText(member.user.username, 335, 242);

  // 7. Member Count Badge Pill
  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
  ctx.beginPath();
  ctx.roundRect(335, 276, 270, 48, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.28)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Green Indicator Dot
  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ctx.arc(358, 300, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f1f5f9';
  ctx.font = 'bold 18px Outfit, sans-serif';
  ctx.fillText(`Member #${member.guild.memberCount}`, 375, 307);
  ctx.restore();

  // 8. Bottom Telemetry
  ctx.fillStyle = '#64748b';
  ctx.font = '11px JetBrainsMono, monospace, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`STATUS: VERIFIED  |  GUILD ID: ${member.guild.id}`, 955, 395);
  ctx.textAlign = 'left';

  const buffer = await canvas.encode('png');
  return new AttachmentBuilder(buffer, { name: 'welcome-card.png' });
}

// 1. Ready listener
bot.once(Events.ClientReady, async () => {
  app.log.info(`[BOT] Discord bot online and logged in as ${bot.user?.tag}`);

  // Set Discord presence (load saved custom presence or use clean public default)
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS bot_config (
        key VARCHAR(64) PRIMARY KEY,
        value JSONB,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `).catch(() => {});

    const presRow = await db.query('SELECT value FROM bot_config WHERE key = $1', ['bot_presence']).catch(() => ({ rows: [] }));
    if (presRow.rows[0]?.value) {
      const p = presRow.rows[0].value;
      bot.user?.setPresence({
        status: p.status || 'online',
        activities: [
          {
            name: p.activityText && p.activityText !== 'srb-nexus-eyaj.onrender.com' ? p.activityText : 'SRB NEXUS | /help',
            type: Number(p.activityType ?? ActivityType.Watching),
          },
        ],
      });
    } else {
      bot.user?.setPresence({
        status: 'online',
        activities: [
          {
            name: 'SRB NEXUS | /help',
            type: ActivityType.Watching,
          },
        ],
      });
    }
  } catch {
    bot.user?.setPresence({
      status: 'online',
      activities: [
        {
          name: 'SRB NEXUS | /help',
          type: ActivityType.Watching,
        },
      ],
    });
  }

  // REGISTER SLASH COMMANDS WITH DISCORD API (Only on demand or manual trigger to avoid Discord IP rate limits)
  if (bot.user && process.env.SYNC_SLASH_COMMANDS === 'true') {
    try {
      await registerSlashCommands(bot.user.id);
      app.log.info('[BOT] Slash commands successfully registered with Discord API.');
    } catch (err) {
      app.log.error({ err }, '[BOT] Failed to register slash commands on startup');
    }
  }

  try {
    const activeGuilds = bot.guilds.cache.map((g) => g.id);
    for (const guildId of activeGuilds) {
      await registerGuild(guildId);
    }
    app.log.info(`[BOT] Synced ${activeGuilds.length} joined guilds into database.`);
  } catch (err) {
    app.log.error({ err }, '[BOT] Failed to sync joined guilds to database');
  }

  // Start Background Giveaways and Reminders Cron Schedulers
  try {
    startBackgroundSchedulers(bot);
    startFreeGamesWatcher(bot);
    startStreamWatcher(bot);
  } catch (err) {
    app.log.error({ err }, '[BOT] Failed to start background schedulers');
  }

  // Initialize Invite Tracking Engine
  try {
    await initInviteTracker(bot);
    app.log.info('[BOT] Invite tracker initialized and invites cached.');
  } catch (err) {
    app.log.error({ err }, '[BOT] Failed to initialize invite tracker');
  }
});

// 2. Slash Commands & Button Interactions Listener
bot.on(Events.InteractionCreate, async (interaction) => {
  await handleInteractionCreate(interaction);
});

// 3. Guild join listener
bot.on(Events.GuildCreate, async (guild: Guild) => {
  try {
    await registerGuild(guild.id, guild.name);
  } catch (err) {
    app.log.error({ err }, `[BOT] Failed to register guild ${guild.id} on join`);
  }
});

// 4. Welcome Message & Autorole Event (Canvas Card)
bot.on(Events.GuildMemberAdd, async (member: GuildMember) => {
  console.log(`\n========================================`);
  app.log.info(`[BOT] NEW MEMBER JOIN DETECTED: ${member.user.tag} (${member.id}) in guild ${member.guild.name} (${member.guild.id})`);

  try {
    // 0. Anti-Raid Defense Pipeline
    const isRaid = await processAntiRaid(member);
    if (isRaid) {
      app.log.warn(`[BOT] Anti-Raid triggered for member join: ${member.user.tag}`);
    }

    // 1. Invite Tracking & Custom Invite Role Assignment
    try {
      const usedInviteCode = await detectUsedInvite(member);
      if (usedInviteCode) {
        app.log.info(`[INVITE] Member ${member.user.tag} joined using invite code: ${usedInviteCode}`);
        const result = await handleInviteRoleAssignment(member, usedInviteCode);
        if (result.assigned) {
          app.log.info(`[INVITE] Assigned role '${result.roleName}' (${result.roleId}) to ${member.user.tag} for invite ${usedInviteCode}`);
        } else if (result.error) {
          app.log.warn(`[INVITE] Could not assign role for invite ${usedInviteCode}: ${result.error}`);
        }
      } else {
        app.log.info(`[INVITE] No specific invite match detected for ${member.user.tag}`);
      }
    } catch (inviteErr: any) {
      app.log.error({ err: inviteErr }, `[INVITE] Failed during invite tracking for member ${member.user.tag}`);
    }

    // 0.2. Verification Gate Check & Live Voice Stats
    const verifRes = await db.query(
      'SELECT verification_enabled, unverified_role_id FROM guild_settings WHERE guild_id = $1',
      [member.guild.id]
    ).catch(() => ({ rows: [] }));

    const isVerificationEnabled = verifRes.rows[0]?.verification_enabled;
    const unverifiedRoleId = verifRes.rows[0]?.unverified_role_id;

    if (isVerificationEnabled && unverifiedRoleId) {
      const cleanUnverifiedId = String(unverifiedRoleId).replace(/[<#@!&>]/g, '').trim();
      const unverifiedRole = member.guild.roles.cache.get(cleanUnverifiedId);
      if (unverifiedRole) {
        await member.roles.add(unverifiedRole).catch(() => {});
        app.log.info(`[VERIFY] Assigned quarantine role @${unverifiedRole.name} to new join ${member.user.tag}`);
      }
    }

    // Update Live Voice Stats on join
    updateGuildVoiceStats(member.guild).catch(() => {});

    const res = await db.query(
      'SELECT welcome_channel_id, welcome_message, autorole_id, welcome_bg_url FROM guild_settings WHERE guild_id = $1',
      [member.guild.id]
    );

    if (res.rows.length === 0) {
      app.log.warn(`[BOT] ABORTED: No row found in database for guild_id ${member.guild.id}`);
      return;
    }

    const { welcome_channel_id, welcome_message, autorole_id, welcome_bg_url } = res.rows[0];

    // Auto-Role Assignment (Skip if verification gate is active to prevent bypassing verification)
    if (autorole_id && !isVerificationEnabled) {
      const cleanRoleId = String(autorole_id).replace(/[<#@!&>]/g, '').trim();
      const role = member.guild.roles.cache.get(cleanRoleId);
      if (role) {
        await member.roles.add(role).catch((err) => app.log.error({ err }, `[BOT] ERROR: Failed to assign role`));
      }
    }

    // Send Welcome Canvas Embed
    if (welcome_channel_id) {
      const cleanChannelId = String(welcome_channel_id).replace(/[<#@!&>]/g, '').trim();

      let channel = member.guild.channels.cache.get(cleanChannelId);
      if (!channel) {
        channel = (await member.guild.channels.fetch(cleanChannelId).catch(() => null)) as any;
      }

      if (channel && channel.isTextBased()) {
        const rawCustomMsg = welcome_message || 'Welcome to {server}, {user}!';
        const formattedMsg = rawCustomMsg
          .replace('{user}', `<@${member.id}>`)
          .replace('{server}', member.guild.name);

        const createdTimestamp = Math.floor(member.user.createdTimestamp / 1000);

        // Generate dynamic canvas image using custom dashboard background if supplied
        const welcomeCardAttachment = await createWelcomeCard(member, welcome_bg_url);

        const welcomeEmbed = new EmbedBuilder()
          .setColor('#E74C3C')
          .setAuthor({
            name: member.guild.name,
            iconURL: member.guild.iconURL() || undefined,
          })
          .setTitle(`Welcome to ${member.guild.name}`)
          .setDescription(`${formattedMsg}\n\nWe're glad to have you here.\nPlease read the rules and enjoy your stay.`)
          .addFields(
            { name: 'Member', value: member.user.username, inline: true },
            { name: 'Count', value: `${member.guild.memberCount}`, inline: true },
            { name: 'Created', value: `<t:${createdTimestamp}:R>`, inline: true }
          )
          .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
          .setImage('attachment://welcome-card.png')
          .setFooter({
            text: `© ${member.guild.name}`,
            iconURL: member.guild.iconURL() || undefined,
          })
          .setTimestamp();

        await channel
          .send({
            content: `<@${member.id}>`,
            embeds: [welcomeEmbed],
            files: [welcomeCardAttachment],
          })
          .then(() => app.log.info(`[BOT] SUCCESS: Sent canvas card to ${cleanChannelId}`))
          .catch((err) => app.log.error({ err }, `[BOT] ERROR: Could not send message`));
      }
    }
  } catch (err) {
    app.log.error({ err }, '[BOT] Error handling GuildMemberAdd event');
  }
  console.log(`========================================\n`);
});

// 5. Member Leave / Farewell Listener
bot.on(Events.GuildMemberRemove, async (member) => {
  try {
    // Update Live Voice Stats on member leave
    if (member.guild) {
      updateGuildVoiceStats(member.guild).catch(() => {});
    }

    const res = await db.query(
      'SELECT leave_channel_id FROM guild_settings WHERE guild_id = $1',
      [member.guild.id]
    );
    const leaveChannelId = res.rows[0]?.leave_channel_id;
    if (leaveChannelId) {
      const cleanChannelId = String(leaveChannelId).replace(/[<#@!&>]/g, '').trim();
      const channel = member.guild.channels.cache.get(cleanChannelId) || (await member.guild.channels.fetch(cleanChannelId).catch(() => null));
      if (channel && channel.isTextBased()) {
        const leaveEmbed = new EmbedBuilder()
          .setColor('#94A3B8')
          .setTitle(`👋 Farewell, ${member.user.username}`)
          .setDescription(`**${member.user.tag}** has left the server.\nWe now have **${member.guild.memberCount}** members.`)
          .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
          .setFooter({ text: member.guild.name, iconURL: member.guild.iconURL() || undefined })
          .setTimestamp();

        await channel.send({ embeds: [leaveEmbed] }).catch(() => {});
        app.log.info(`[BOT] Sent farewell announcement for ${member.user.tag} in ${cleanChannelId}`);
      }
    }
  } catch (err) {
    app.log.error({ err }, '[BOT] Error handling GuildMemberRemove event');
  }
});

// 6. Voice State Update Listener (Temp Voice / Join to Create)
bot.on(Events.VoiceStateUpdate, async (oldState: VoiceState, newState: VoiceState) => {
  await handleTempVoiceStateUpdate(oldState, newState);
});

// 7. Message Create Listener (Auto-Mod, Leveling XP, Tags, and Modmail)
bot.on(Events.MessageCreate, async (message: Message) => {
  if (message.author.bot) return;

  // Process Anti-Spam, Modmail, and Tags Pipeline
  try {
    await processSecurityAndSpam(message);
  } catch (err) {
    app.log.error({ err }, '[BOT] Error in security message pipeline');
  }

  // 2. Custom Prefix Command Handling
  try {
    if (!message.guild) return;

    const res = await db.query(
      'SELECT prefix FROM guild_settings WHERE guild_id = $1',
      [message.guild.id]
    );

    const prefix = res.rows[0]?.prefix || '!';

    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/\s+/);
    const commandName = args.shift()?.toLowerCase();

    if (commandName === 'ping') {
      await message.reply('Pong!');
    }
  } catch (err) {
    app.log.error({ err }, '[BOT] Error in MessageCreate event handler');
  }
});

async function start() {
  try {
    await app.register(fastifyCookie);
    await app.register(fastifyJwt, {
      secret: process.env.JWT_SECRET || 'nexus-super-secret-key-change-in-prod',
      cookie: {
        cookieName: 'nexus_token',
        signed: false,
      },
    });

    const publicPath = fs.existsSync(path.join(__dirname, '../public'))
      ? path.join(__dirname, '../public')
      : fs.existsSync(path.join(__dirname, 'public'))
      ? path.join(__dirname, 'public')
      : path.join(process.cwd(), 'public');

    await app.register(fastifyStatic, {
      root: publicPath,
      prefix: '/',
    });

    app.get('/health', async (request, reply) => {
      const authHeader = (request.headers['x-admin-key'] || request.headers['authorization']) as string | undefined;
      const isAdmin = !!(process.env.ADMIN_SECRET_KEY && authHeader === process.env.ADMIN_SECRET_KEY);

      const publicHealth = {
        status: 'ok',
        bot: {
          online: bot.isReady(),
          user: bot.user ? bot.user.tag : null,
          guildCount: bot.guilds.cache.size,
          ping: bot.ws?.ping ?? -1,
        },
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      };

      if (isAdmin) {
        return {
          ...publicHealth,
          diagnostics: {
            tokenConfigured: !!process.env.DISCORD_TOKEN,
            apiBase: process.env.DISCORD_API_BASE_URL || 'https://discord.com',
            lastError: lastBotError,
            lastRateLimit: lastBotRateLimit,
            debugEvents: lastDebugEvents,
          },
        };
      }

      return publicHealth;
    });

    await app.register(authRoutes);
    await app.register(guildRoutes);

    app.get('/', async (request, reply) => {
      return reply.sendFile('index.html');
    });

    app.get('/servers', async (request, reply) => {
      return reply.sendFile('index.html');
    });

    app.get('/dashboard', async (request, reply) => {
      return reply.sendFile('dashboard.html');
    });

    app.get('/leaderboard', async (request, reply) => {
      return reply.sendFile('leaderboard.html');
    });

    // Public API: List public servers available for leaderboards
    app.get('/api/public/leaderboard-servers', async (request, reply) => {
      const servers = Array.from(bot.guilds.cache.values()).map((g) => ({
        id: g.id,
        name: g.name,
        icon: g.iconURL({ size: 128 }),
        memberCount: g.memberCount,
      }));
      return reply.send({ servers });
    });

    // Public API: Fetch server top XP rankings and top inviters
    app.get('/api/public/leaderboard/:guildId', async (request, reply) => {
      const { guildId } = request.params as { guildId: string };
      const guild = bot.guilds.cache.get(guildId) || (await bot.guilds.fetch(guildId).catch(() => null));
      if (!guild) {
        return reply.status(404).send({ error: 'Server not found or bot is not in this server' });
      }

      // Fetch top XP
      const xpRes = await db.query(
        `SELECT user_id, xp, level 
         FROM user_economy 
         WHERE guild_id = $1 
         ORDER BY xp DESC LIMIT 25`,
        [guildId]
      ).catch(() => ({ rows: [] }));

      const topXp = await Promise.all(
        xpRes.rows.map(async (row: any, idx: number) => {
          let member = guild.members.cache.get(row.user_id);
          if (!member) {
            member = await guild.members.fetch(row.user_id).catch(() => null as any);
          }
          return {
            rank: idx + 1,
            userId: row.user_id,
            username: member ? (member.displayName || member.user.username) : `User ${row.user_id.slice(-4)}`,
            avatar: member ? member.user.displayAvatarURL({ size: 64 }) : null,
            level: Number(row.level) || 1,
            xp: Number(row.xp) || 0,
          };
        })
      );

      // Fetch top inviters
      let topInviters: any[] = [];
      try {
        const invites = await guild.invites.fetch().catch(() => null);
        if (invites) {
          const inviterMap = new Map<string, { user: any; uses: number }>();
          for (const [, inv] of invites) {
            if (!inv.inviter) continue;
            const current = inviterMap.get(inv.inviter.id) || { user: inv.inviter, uses: 0 };
            current.uses += inv.uses || 0;
            inviterMap.set(inv.inviter.id, current);
          }
          topInviters = Array.from(inviterMap.values())
            .filter((item) => item.uses > 0)
            .sort((a, b) => b.uses - a.uses)
            .slice(0, 10)
            .map((item, idx) => ({
              rank: idx + 1,
              userId: item.user.id,
              username: item.user.username,
              avatar: item.user.displayAvatarURL({ size: 64 }),
              uses: item.uses,
            }));
        }
      } catch {}

      return reply.send({
        guild: {
          id: guild.id,
          name: guild.name,
          icon: guild.iconURL({ size: 128 }),
          memberCount: guild.memberCount,
        },
        topXp,
        topInviters,
      });
    });

    if (typeof (db as any).connect === 'function') {
      await (db as any).connect();
    }

    // Table initialization with all core and security modules
    await db.query(`
      CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id VARCHAR(32) PRIMARY KEY,
        prefix VARCHAR(10) DEFAULT '!',
        welcome_channel_id VARCHAR(32),
        welcome_message TEXT,
        welcome_bg_url TEXT,
        leave_channel_id VARCHAR(32),
        autorole_id VARCHAR(32),
        log_channel_id VARCHAR(32),
        anti_links BOOLEAN DEFAULT FALSE,
        anti_spam BOOLEAN DEFAULT FALSE,
        level_channel_id VARCHAR(32),
        xp_rate NUMERIC DEFAULT 1.0,
        dj_role_id VARCHAR(32),
        default_volume INTEGER DEFAULT 80,
        currency_symbol VARCHAR(10) DEFAULT '$',
        daily_reward INTEGER DEFAULT 100,
        transcript_channel_id VARCHAR(32),
        support_role_id VARCHAR(32),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS moderation_logs (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(32) NOT NULL,
        target_user_id VARCHAR(32) NOT NULL,
        moderator_user_id VARCHAR(32) NOT NULL,
        action VARCHAR(32) NOT NULL,
        reason TEXT DEFAULT 'No reason provided',
        duration_sec INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS security_events (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(32) NOT NULL,
        user_id VARCHAR(32) NOT NULL,
        event_type VARCHAR(64) NOT NULL,
        reason TEXT NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS guild_security_config (
        guild_id VARCHAR(32) PRIMARY KEY,
        logging_channel_id VARCHAR(32),
        anti_spam_enabled BOOLEAN DEFAULT TRUE,
        anti_scam_enabled BOOLEAN DEFAULT TRUE,
        anti_raid_enabled BOOLEAN DEFAULT TRUE,
        raid_threshold_joins INTEGER DEFAULT 5,
        raid_window_seconds INTEGER DEFAULT 10,
        raid_action VARCHAR(20) DEFAULT 'LOCKDOWN',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS guild_exemptions (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(32) NOT NULL,
        entity_type VARCHAR(20) NOT NULL,
        entity_id VARCHAR(32) NOT NULL,
        exemption_scope VARCHAR(20) DEFAULT 'ALL',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (guild_id, entity_type, entity_id, exemption_scope)
      );

      CREATE TABLE IF NOT EXISTS user_economy (
        guild_id VARCHAR(32) NOT NULL,
        user_id VARCHAR(32) NOT NULL,
        balance BIGINT DEFAULT 0,
        bank BIGINT DEFAULT 0,
        xp BIGINT DEFAULT 0,
        level INTEGER DEFAULT 1,
        last_daily TIMESTAMP WITH TIME ZONE,
        last_work TIMESTAMP WITH TIME ZONE,
        PRIMARY KEY (guild_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS user_warnings (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(32) NOT NULL,
        user_id VARCHAR(32) NOT NULL,
        moderator_id VARCHAR(32) NOT NULL,
        reason TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS guild_tickets (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(32) NOT NULL,
        channel_id VARCHAR(32) NOT NULL,
        user_id VARCHAR(32) NOT NULL,
        status VARCHAR(20) DEFAULT 'OPEN',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        closed_at TIMESTAMP WITH TIME ZONE
      );

      CREATE TABLE IF NOT EXISTS guild_reaction_roles (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(32) NOT NULL,
        channel_id VARCHAR(32) NOT NULL,
        message_id VARCHAR(32) NOT NULL,
        role_id VARCHAR(32) NOT NULL,
        emoji VARCHAR(64),
        label VARCHAR(100) NOT NULL,
        description VARCHAR(200),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS giveaways (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(32) NOT NULL,
        channel_id VARCHAR(32) NOT NULL,
        message_id VARCHAR(32) NOT NULL,
        prize TEXT NOT NULL,
        winner_count INTEGER DEFAULT 1,
        ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
        host_id VARCHAR(32) NOT NULL,
        ended BOOLEAN DEFAULT FALSE,
        entries TEXT[] DEFAULT '{}',
        winners TEXT[] DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_reminders (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(32) NOT NULL,
        user_id VARCHAR(32) NOT NULL,
        channel_id VARCHAR(32) NOT NULL,
        reminder_text TEXT NOT NULL,
        remind_at TIMESTAMP WITH TIME ZONE NOT NULL,
        completed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_afk (
        guild_id VARCHAR(32) NOT NULL,
        user_id VARCHAR(32) NOT NULL,
        reason TEXT DEFAULT 'AFK',
        afk_since TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (guild_id, user_id)
      );
    `);

    // Safety migrations for existing database setups
    await db.query(`
      ALTER TABLE guild_settings 
      ADD COLUMN IF NOT EXISTS prefix VARCHAR(10) DEFAULT '!',
      ADD COLUMN IF NOT EXISTS welcome_channel_id VARCHAR(32),
      ADD COLUMN IF NOT EXISTS welcome_message TEXT,
      ADD COLUMN IF NOT EXISTS welcome_bg_url TEXT,
      ADD COLUMN IF NOT EXISTS leave_channel_id VARCHAR(32),
      ADD COLUMN IF NOT EXISTS leave_message TEXT DEFAULT '{username} has left the server.',
      ADD COLUMN IF NOT EXISTS autorole_id VARCHAR(32),
      ADD COLUMN IF NOT EXISTS dm_welcome_enabled BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS log_channel_id VARCHAR(32),
      ADD COLUMN IF NOT EXISTS mute_role_id VARCHAR(32),
      ADD COLUMN IF NOT EXISTS auto_mod_enabled BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS anti_links BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS anti_spam BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS anti_caps BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS anti_mass_mention BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS banned_words JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS allowed_domains JSONB DEFAULT '["youtube.com", "twitch.tv", "discord.gg", "github.com", "twitter.com", "x.com"]'::jsonb,
      ADD COLUMN IF NOT EXISTS anti_raid_enabled BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS raid_threshold_joins INTEGER DEFAULT 5,
      ADD COLUMN IF NOT EXISTS raid_window_seconds INTEGER DEFAULT 10,
      ADD COLUMN IF NOT EXISTS raid_action VARCHAR(20) DEFAULT 'LOCKDOWN',
      ADD COLUMN IF NOT EXISTS min_account_age_hours INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS anti_nuke_enabled BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS max_channel_deletions INTEGER DEFAULT 3,
      ADD COLUMN IF NOT EXISTS is_locked_down BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS levels_enabled BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS level_channel_id VARCHAR(32),
      ADD COLUMN IF NOT EXISTS level_message TEXT DEFAULT 'GG {user}, you leveled up to Level {level}! 🎉',
      ADD COLUMN IF NOT EXISTS xp_rate NUMERIC DEFAULT 1.0,
      ADD COLUMN IF NOT EXISTS role_rewards JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS no_xp_channels JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS music_enabled BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS dj_role_id VARCHAR(32),
      ADD COLUMN IF NOT EXISTS default_volume INTEGER DEFAULT 80,
      ADD COLUMN IF NOT EXISTS max_queue_length INTEGER DEFAULT 100,
      ADD COLUMN IF NOT EXISTS stay_247_enabled BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS dsp_filters JSONB DEFAULT '{"bassboost": false, "nightcore": false, "vaporwave": false, "audio8d": false}'::jsonb,
      ADD COLUMN IF NOT EXISTS economy_enabled BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS currency_symbol VARCHAR(10) DEFAULT '🪙',
      ADD COLUMN IF NOT EXISTS currency_name VARCHAR(50) DEFAULT 'Nexus Coins',
      ADD COLUMN IF NOT EXISTS daily_reward INTEGER DEFAULT 100,
      ADD COLUMN IF NOT EXISTS streak_bonus INTEGER DEFAULT 25,
      ADD COLUMN IF NOT EXISTS work_min_reward INTEGER DEFAULT 20,
      ADD COLUMN IF NOT EXISTS work_max_reward INTEGER DEFAULT 80,
      ADD COLUMN IF NOT EXISTS rob_enabled BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS rob_success_rate INTEGER DEFAULT 45,
      ADD COLUMN IF NOT EXISTS tickets_enabled BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS category_id VARCHAR(32),
      ADD COLUMN IF NOT EXISTS transcript_channel_id VARCHAR(32),
      ADD COLUMN IF NOT EXISTS support_role_id VARCHAR(32),
      ADD COLUMN IF NOT EXISTS ticket_panel_title VARCHAR(150) DEFAULT 'SRB NEXUS Support Desk',
      ADD COLUMN IF NOT EXISTS ticket_panel_description TEXT DEFAULT 'Need assistance or have questions? Click the button below to open a private ticket with our staff.',
      ADD COLUMN IF NOT EXISTS ticket_button_label VARCHAR(80) DEFAULT '📩 Open Ticket',
      ADD COLUMN IF NOT EXISTS ticket_button_emoji VARCHAR(32) DEFAULT '📩',
      ADD COLUMN IF NOT EXISTS ticket_mode VARCHAR(32) DEFAULT 'general',
      ADD COLUMN IF NOT EXISTS ticket_welcome_msg TEXT DEFAULT 'Welcome to your private support channel! Our staff team has been notified. Please describe your question or issue in detail below.',
      ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS notifications_channel_id VARCHAR(32),
      ADD COLUMN IF NOT EXISTS free_games_enabled BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS discounts_enabled BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS notif_security_alerts BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS notif_ticket_alerts BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS notif_milestones BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

      ALTER TABLE guild_tickets
      ADD COLUMN IF NOT EXISTS ticket_type VARCHAR(50) DEFAULT 'GENERAL_SUPPORT',
      ADD COLUMN IF NOT EXISTS ticket_mode VARCHAR(32) DEFAULT 'general',
      ADD COLUMN IF NOT EXISTS subject VARCHAR(200),
      ADD COLUMN IF NOT EXISTS project_type VARCHAR(100),
      ADD COLUMN IF NOT EXISTS budget VARCHAR(100),
      ADD COLUMN IF NOT EXISTS timeline VARCHAR(100),
      ADD COLUMN IF NOT EXISTS pages VARCHAR(100),
      ADD COLUMN IF NOT EXISTS details TEXT,
      ADD COLUMN IF NOT EXISTS quote_amount VARCHAR(50),
      ADD COLUMN IF NOT EXISTS quote_status VARCHAR(30) DEFAULT 'PENDING',
      ADD COLUMN IF NOT EXISTS claimed_by VARCHAR(32);

      CREATE TABLE IF NOT EXISTS guild_shop_items (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(32) NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        price BIGINT NOT NULL DEFAULT 100,
        role_id VARCHAR(32),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_shop_items_guild ON guild_shop_items (guild_id);

      CREATE TABLE IF NOT EXISTS stream_trackers (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(32) NOT NULL,
        platform VARCHAR(20) NOT NULL,
        channel_name VARCHAR(100) NOT NULL,
        display_name VARCHAR(100),
        discord_channel_id VARCHAR(32) NOT NULL,
        custom_message TEXT,
        mention_role VARCHAR(32) DEFAULT 'none',
        event_type VARCHAR(20) DEFAULT 'all',
        is_live BOOLEAN DEFAULT FALSE,
        last_stream_id VARCHAR(100),
        last_title TEXT,
        last_game VARCHAR(100),
        last_checked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE stream_trackers ADD COLUMN IF NOT EXISTS event_type VARCHAR(20) DEFAULT 'all';

      CREATE TABLE IF NOT EXISTS guild_invite_roles (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(32) NOT NULL,
        invite_code VARCHAR(32) NOT NULL,
        role_id VARCHAR(32) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (guild_id, invite_code)
      );
      CREATE INDEX IF NOT EXISTS idx_invite_roles_guild ON guild_invite_roles (guild_id);

      CREATE TABLE IF NOT EXISTS guild_invite_logs (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(32) NOT NULL,
        user_id VARCHAR(32) NOT NULL,
        user_tag VARCHAR(100) NOT NULL,
        user_avatar TEXT,
        invite_code VARCHAR(32) NOT NULL,
        role_id VARCHAR(32),
        role_name VARCHAR(100),
        joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_invite_logs_guild ON guild_invite_logs (guild_id);

      -- Verification Gate Columns
      ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS verification_enabled BOOLEAN DEFAULT FALSE;
      ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS verification_channel_id VARCHAR(32);
      ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS verification_role_id VARCHAR(32);
      ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS unverified_role_id VARCHAR(32);
      ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS verification_type VARCHAR(20) DEFAULT 'button';

      -- Live Voice Stat Counters Columns
      ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS stat_counters_enabled BOOLEAN DEFAULT FALSE;
      ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS stat_category_id VARCHAR(32);
      ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS stat_channel_members VARCHAR(32);
      ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS stat_channel_online VARCHAR(32);
      ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS stat_channel_bots VARCHAR(32);

      -- Temp Voice Rooms Columns
      ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS temp_voice_enabled BOOLEAN DEFAULT FALSE;
      ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS temp_voice_master_id VARCHAR(32);
      ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS temp_voice_category_id VARCHAR(32);
      ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS temp_voice_name_template VARCHAR(64) DEFAULT '🔊 {username}''s Room';

      -- Modmail Columns
      ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS modmail_enabled BOOLEAN DEFAULT FALSE;
      ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS modmail_channel_id VARCHAR(32);
      ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS modmail_role_id VARCHAR(32);

      -- Tags / Custom Auto-Responders Table
      CREATE TABLE IF NOT EXISTS guild_tags (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(32) NOT NULL,
        name VARCHAR(64) NOT NULL,
        content TEXT NOT NULL,
        embed_title VARCHAR(256),
        embed_color VARCHAR(16) DEFAULT '#5865F2',
        created_by VARCHAR(32),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (guild_id, name)
      );
      CREATE INDEX IF NOT EXISTS idx_tags_guild ON guild_tags (guild_id);

      -- Sovereign Server Owner Configuration Table
      CREATE TABLE IF NOT EXISTS guild_owner_config (
        guild_id VARCHAR(32) PRIMARY KEY,
        owner_id VARCHAR(32) NOT NULL,
        co_owners JSONB DEFAULT '[]'::jsonb,
        protected_roles JSONB DEFAULT '[]'::jsonb,
        settings_locked BOOLEAN DEFAULT FALSE,
        owner_dm_alerts BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_owner_config_guild ON guild_owner_config (guild_id);

      -- Spam Catcher Module Configuration Table
      CREATE TABLE IF NOT EXISTS guild_spam_catcher (
        guild_id VARCHAR(32) PRIMARY KEY,
        enabled BOOLEAN DEFAULT TRUE,
        sensitivity VARCHAR(20) DEFAULT 'medium',
        action VARCHAR(20) DEFAULT 'TIMEOUT',
        timeout_duration_seconds INTEGER DEFAULT 300,
        max_messages_per_window INTEGER DEFAULT 5,
        window_seconds INTEGER DEFAULT 4,
        max_duplicates INTEGER DEFAULT 3,
        max_mentions INTEGER DEFAULT 4,
        anti_discord_invites BOOLEAN DEFAULT TRUE,
        anti_phishing_links BOOLEAN DEFAULT TRUE,
        honeypot_channel_id VARCHAR(32),
        log_channel_id VARCHAR(32),
        whitelist_roles JSONB DEFAULT '[]'::jsonb,
        whitelist_channels JSONB DEFAULT '[]'::jsonb,
        owner_dm_alert BOOLEAN DEFAULT TRUE,
        total_spams_caught INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_spam_catcher_guild ON guild_spam_catcher (guild_id);
    `);

    app.log.info('Database connection established & all tables and security schemas initialized successfully');

    // 1. START FASTIFY HTTP SERVER FIRST (Render requires immediate port binding)
    const port = Number(process.env.PORT) || 10000;
    await app.listen({ port, host: '0.0.0.0' });
    app.log.info(`Fastify REST API server running on http://0.0.0.0:${port}`);

    // 2. CONNECT DISCORD BOT IN BACKGROUND WITH AUTO-RECONNECT
    const discordToken = process.env.DISCORD_TOKEN;
    if (discordToken) {
      const connectBot = async (attempt = 1) => {
        try {
          app.log.info(`[BOT] Connecting to Discord Gateway (attempt #${attempt})...`);
          await bot.login(discordToken);
          lastBotError = null;
          app.log.info(`[BOT] Connected to Discord Gateway successfully as ${bot.user?.tag}`);
        } catch (err: any) {
          lastBotError = {
            message: err.message || String(err),
            code: err.code || err.status || 0,
            attempt,
            timestamp: new Date().toISOString(),
          };
          app.log.error({ err: err.message, code: err.code }, `[BOT] Connection failed on attempt #${attempt}`);
          const delaySec = Math.min(5 * attempt, 30);
          app.log.info(`[BOT] Retrying Discord Gateway connection in ${delaySec}s...`);
          setTimeout(() => connectBot(attempt + 1), delaySec * 1000);
        }
      };
      connectBot();
    } else {
      app.log.warn('DISCORD_TOKEN is missing in environment variables. Bot client offline.');
    }

  } catch (err) {
    app.log.error(err, 'Failed to start SRB NEXUS engine');
    process.exit(1);
  }
}

start();