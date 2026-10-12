import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyJwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import {
  Client,
  GatewayIntentBits,
  Guild,
  Events,
  GuildMember,
  Message,
  EmbedBuilder,
  AttachmentBuilder,
} from 'discord.js';

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

dotenv.config();

const app = Fastify({ logger: true });

export const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
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

  // Try loading custom background image from dashboard setting
  if (customBgUrl) {
    try {
      const bgImage = await loadImage(customBgUrl);
      ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);

      // Dark translucent overlay for crisp text readability
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      bgLoaded = true;
    } catch (err) {
      console.error('[BOT] Failed to load custom background image, using fallback theme', err);
    }
  }

  // Default theme background fallback
  if (!bgLoaded) {
    ctx.fillStyle = '#111319';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 8;
    ctx.strokeRect(15, 15, canvas.width - 30, canvas.height - 30);
  }

  // Welcome Text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 42px Sans-Serif';
  ctx.fillText(`WELCOME TO ${member.guild.name.toUpperCase()}`, 350, 170);

  // Username
  ctx.fillStyle = '#e74c3c';
  ctx.font = 'bold 36px Sans-Serif';
  ctx.fillText(member.user.username, 350, 230);

  // Member Count Badge
  ctx.fillStyle = 'rgba(44, 47, 56, 0.85)';
  ctx.roundRect(350, 260, 200, 45, 10);
  ctx.fill();

  ctx.fillStyle = '#3498db';
  ctx.font = 'bold 22px Sans-Serif';
  ctx.fillText(`Member #${member.guild.memberCount}`, 375, 290);

  // User Circle Avatar
  try {
    const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
    const avatar = await loadImage(avatarUrl);

    ctx.save();
    ctx.beginPath();
    ctx.arc(200, 225, 100, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, 100, 125, 200, 200);
    ctx.restore();

    // Circle Outline for Avatar
    ctx.beginPath();
    ctx.arc(200, 225, 102, 0, Math.PI * 2, true);
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 6;
    ctx.stroke();
  } catch (err) {
    console.error('[BOT] Failed to draw avatar on canvas', err);
  }

  const buffer = await canvas.encode('png');
  return new AttachmentBuilder(buffer, { name: 'welcome-card.png' });
}

// 1. Ready listener
bot.once(Events.ClientReady, async () => {
  app.log.info(`[BOT] Discord bot online and logged in as ${bot.user?.tag}`);

  // REGISTER SLASH COMMANDS WITH DISCORD API
  if (bot.user) {
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
    const res = await db.query(
      'SELECT welcome_channel_id, welcome_message, autorole_id, welcome_bg_url FROM guild_settings WHERE guild_id = $1',
      [member.guild.id]
    );

    if (res.rows.length === 0) {
      app.log.warn(`[BOT] ABORTED: No row found in database for guild_id ${member.guild.id}`);
      return;
    }

    const { welcome_channel_id, welcome_message, autorole_id, welcome_bg_url } = res.rows[0];

    // Auto-Role Assignment
    if (autorole_id) {
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

bot.on(Events.MessageCreate, async (message: Message) => {
  if (message.author.bot || !message.guild) return;

  // 1. Process Anti-Spam & Anti-Scam Security Pipeline
  try {
    await processSecurityAndSpam(message);
  } catch (err) {
    app.log.error({ err }, '[BOT] Error in security message pipeline');
  }

  // 2. Custom Prefix Command Handling
  try {
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

    app.get('/health', async () => {
      return { status: 'ok' };
    });

    await app.register(authRoutes);
    await app.register(guildRoutes);

    app.get('/', async (request, reply) => {
      return reply.redirect('/dashboard');
    });

    app.get('/servers', async (request, reply) => {
      return reply.sendFile('index.html');
    });

    app.get('/dashboard', async (request, reply) => {
      return reply.sendFile('dashboard.html');
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
      ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS notifications_channel_id VARCHAR(32),
      ADD COLUMN IF NOT EXISTS free_games_enabled BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS discounts_enabled BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS notif_security_alerts BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS notif_ticket_alerts BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS notif_milestones BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

      ALTER TABLE guild_tickets
      ADD COLUMN IF NOT EXISTS ticket_type VARCHAR(50) DEFAULT 'WEBSITE_QUOTATION',
      ADD COLUMN IF NOT EXISTS project_type VARCHAR(100),
      ADD COLUMN IF NOT EXISTS budget VARCHAR(100),
      ADD COLUMN IF NOT EXISTS timeline VARCHAR(100),
      ADD COLUMN IF NOT EXISTS pages VARCHAR(100),
      ADD COLUMN IF NOT EXISTS details TEXT,
      ADD COLUMN IF NOT EXISTS quote_amount VARCHAR(50),
      ADD COLUMN IF NOT EXISTS quote_status VARCHAR(30) DEFAULT 'PENDING';

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
    `);

    app.log.info('Database connection established & all tables and security schemas initialized successfully');

    // 1. LOGIN DISCORD BOT FIRST
    if (process.env.DISCORD_TOKEN) {
      await bot.login(process.env.DISCORD_TOKEN);
    } else {
      app.log.warn('DISCORD_TOKEN is missing in environment variables. Bot client offline.');
    }

    // 2. START FASTIFY HTTP SERVER LAST
    const port = Number(process.env.PORT) || 10000;
    await app.listen({ port, host: '0.0.0.0' });
    app.log.info(`Fastify REST API server running on http://0.0.0.0:${port}`);

  } catch (err) {
    app.log.error(err, 'Failed to start SRB NEXUS engine');
    process.exit(1);
  }
}

start();