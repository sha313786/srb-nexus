-- SRB NEXUS Complete Unified Database Schema

-- 1. Main Guild Settings (Used by Dashboard & Bot)
CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id VARCHAR(32) PRIMARY KEY,
    prefix VARCHAR(10) DEFAULT '!',
    welcome_channel_id VARCHAR(32),
    welcome_message TEXT DEFAULT 'Welcome to {server}, {user}!',
    welcome_bg_url TEXT DEFAULT NULL,
    leave_channel_id VARCHAR(32),
    leave_message TEXT DEFAULT '{username} has left the server.',
    autorole_id VARCHAR(32),
    dm_welcome_enabled BOOLEAN DEFAULT FALSE,
    log_channel_id VARCHAR(32),
    mute_role_id VARCHAR(32),
    auto_mod_enabled BOOLEAN DEFAULT TRUE,
    anti_links BOOLEAN DEFAULT FALSE,
    anti_spam BOOLEAN DEFAULT FALSE,
    anti_caps BOOLEAN DEFAULT FALSE,
    anti_mass_mention BOOLEAN DEFAULT FALSE,
    banned_words JSONB DEFAULT '[]'::jsonb,
    allowed_domains JSONB DEFAULT '["youtube.com", "twitch.tv", "discord.gg", "github.com", "twitter.com", "x.com"]'::jsonb,
    anti_raid_enabled BOOLEAN DEFAULT TRUE,
    raid_threshold_joins INTEGER DEFAULT 5,
    raid_window_seconds INTEGER DEFAULT 10,
    raid_action VARCHAR(20) DEFAULT 'LOCKDOWN',
    min_account_age_hours INTEGER DEFAULT 0,
    anti_nuke_enabled BOOLEAN DEFAULT FALSE,
    max_channel_deletions INTEGER DEFAULT 3,
    is_locked_down BOOLEAN DEFAULT FALSE,
    levels_enabled BOOLEAN DEFAULT TRUE,
    level_channel_id VARCHAR(32),
    level_message TEXT DEFAULT 'GG {user}, you leveled up to Level {level}! 🎉',
    xp_rate NUMERIC DEFAULT 1.0,
    role_rewards JSONB DEFAULT '[]'::jsonb,
    no_xp_channels JSONB DEFAULT '[]'::jsonb,
    music_enabled BOOLEAN DEFAULT TRUE,
    dj_role_id VARCHAR(32),
    default_volume INTEGER DEFAULT 80,
    max_queue_length INTEGER DEFAULT 100,
    stay_247_enabled BOOLEAN DEFAULT FALSE,
    dsp_filters JSONB DEFAULT '{"bassboost": false, "nightcore": false, "vaporwave": false, "audio8d": false}'::jsonb,
    economy_enabled BOOLEAN DEFAULT TRUE,
    currency_symbol VARCHAR(10) DEFAULT '🪙',
    currency_name VARCHAR(50) DEFAULT 'Nexus Coins',
    daily_reward INTEGER DEFAULT 100,
    streak_bonus INTEGER DEFAULT 25,
    work_min_reward INTEGER DEFAULT 20,
    work_max_reward INTEGER DEFAULT 80,
    rob_enabled BOOLEAN DEFAULT TRUE,
    rob_success_rate INTEGER DEFAULT 45,
    tickets_enabled BOOLEAN DEFAULT TRUE,
    category_id VARCHAR(32),
    transcript_channel_id VARCHAR(32),
    support_role_id VARCHAR(32),
    ticket_panel_title VARCHAR(150) DEFAULT 'SRB NEXUS Support Desk',
    ticket_panel_description TEXT DEFAULT 'Need assistance or have questions? Click the button below to open a private ticket with our staff.',
    ticket_button_label VARCHAR(80) DEFAULT '📩 Open Ticket',
    ticket_button_emoji VARCHAR(32) DEFAULT '📩',
    notifications_enabled BOOLEAN DEFAULT TRUE,
    notifications_channel_id VARCHAR(32),
    free_games_enabled BOOLEAN DEFAULT TRUE,
    discounts_enabled BOOLEAN DEFAULT FALSE,
    notif_security_alerts BOOLEAN DEFAULT TRUE,
    notif_ticket_alerts BOOLEAN DEFAULT TRUE,
    notif_milestones BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS guild_shop_items (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(32) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price BIGINT NOT NULL DEFAULT 100,
    role_id VARCHAR(32),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Moderation Logs
CREATE TABLE IF NOT EXISTS moderation_logs (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(32) NOT NULL,
    target_user_id VARCHAR(32) NOT NULL,
    moderator_user_id VARCHAR(32) NOT NULL,
    action VARCHAR(32) NOT NULL, -- KICK, BAN, TIMEOUT, PURGE
    reason TEXT DEFAULT 'No reason provided',
    duration_sec INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_modlogs_guild_target ON moderation_logs (guild_id, target_user_id);

-- 3. Security Events (Automated Moderation Audits)
CREATE TABLE IF NOT EXISTS security_events (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    event_type VARCHAR(64) NOT NULL, -- SPAM_DIRECT_KICK, SCAM_DIRECT_KICK, RAID_LOCKDOWN
    reason TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_security_events_guild ON security_events (guild_id, created_at DESC);

-- 4. Guild Security & Anti-Raid Configuration
CREATE TABLE IF NOT EXISTS guild_security_config (
    guild_id VARCHAR(32) PRIMARY KEY,
    logging_channel_id VARCHAR(32),
    anti_spam_enabled BOOLEAN DEFAULT TRUE,
    anti_scam_enabled BOOLEAN DEFAULT TRUE,
    anti_raid_enabled BOOLEAN DEFAULT TRUE,
    raid_threshold_joins INTEGER DEFAULT 5, -- Max joins within window
    raid_window_seconds INTEGER DEFAULT 10,  -- Window in seconds
    raid_action VARCHAR(20) DEFAULT 'LOCKDOWN', -- KICK, BAN, LOCKDOWN
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Guild Security Exemptions / Whitelist
CREATE TABLE IF NOT EXISTS guild_exemptions (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(32) NOT NULL,
    entity_type VARCHAR(20) NOT NULL, -- USER, ROLE, CHANNEL, BOT
    entity_id VARCHAR(32) NOT NULL,
    exemption_scope VARCHAR(20) DEFAULT 'ALL', -- SPAM, SCAM, RAID, ALL
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (guild_id, entity_type, entity_id, exemption_scope)
);

-- 6. User Economy Balances & XP
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

-- 7. Moderation Warnings System
CREATE TABLE IF NOT EXISTS user_warnings (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    moderator_id VARCHAR(32) NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_warnings_guild_user ON user_warnings (guild_id, user_id);

-- 8. Support Tickets Tracking
CREATE TABLE IF NOT EXISTS guild_tickets (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(32) NOT NULL,
    channel_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    status VARCHAR(20) DEFAULT 'OPEN',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP WITH TIME ZONE
);

-- 7. Modular Subsystems (Legacy / Future Expansion Support)
CREATE TABLE IF NOT EXISTS module_overview (
    guild_id VARCHAR(32) PRIMARY KEY,
    prefix VARCHAR(10) DEFAULT '!',
    system_notifications BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS module_welcome (
    guild_id VARCHAR(32) PRIMARY KEY,
    welcome_channel_id VARCHAR(32),
    welcome_message TEXT DEFAULT 'Welcome {user} to {server}!',
    welcome_bg_url TEXT DEFAULT NULL,
    leave_channel_id VARCHAR(32),
    leave_message TEXT DEFAULT '{username} has left the server.',
    autorole_id VARCHAR(32),
    enabled BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS module_moderation (
    guild_id VARCHAR(32) PRIMARY KEY,
    log_channel_id VARCHAR(32),
    mute_role_id VARCHAR(32),
    anti_links BOOLEAN DEFAULT FALSE,
    anti_spam BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS module_notifications (
    guild_id VARCHAR(32) PRIMARY KEY,
    notifications_channel_id VARCHAR(32),
    free_games_enabled BOOLEAN DEFAULT FALSE,
    discounts_enabled BOOLEAN DEFAULT FALSE,
    enabled BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS module_levels (
    guild_id VARCHAR(32) PRIMARY KEY,
    level_channel_id VARCHAR(32),
    level_message TEXT DEFAULT 'GG {user}, you reached Level {level}!',
    xp_rate NUMERIC DEFAULT 1.0,
    role_rewards JSONB DEFAULT '[]'::jsonb,
    enabled BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS module_music (
    guild_id VARCHAR(32) PRIMARY KEY,
    dj_role_id VARCHAR(32),
    default_volume INTEGER DEFAULT 80,
    max_queue_length INTEGER DEFAULT 100,
    enabled BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS module_economy (
    guild_id VARCHAR(32) PRIMARY KEY,
    currency_symbol VARCHAR(10) DEFAULT '$',
    daily_reward INTEGER DEFAULT 100,
    work_min_reward INTEGER DEFAULT 20,
    work_max_reward INTEGER DEFAULT 80,
    enabled BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS module_tickets (
    guild_id VARCHAR(32) PRIMARY KEY,
    category_id VARCHAR(32),
    transcript_channel_id VARCHAR(32),
    support_role_id VARCHAR(32)
);

-- 9. Reaction Roles Configuration
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
CREATE INDEX IF NOT EXISTS idx_rr_guild_msg ON guild_reaction_roles (guild_id, message_id);

-- 10. Giveaways System
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
CREATE INDEX IF NOT EXISTS idx_giveaways_active ON giveaways (ended, ends_at);

-- 11. User Reminders
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
CREATE INDEX IF NOT EXISTS idx_reminders_pending ON user_reminders (completed, remind_at);

-- 12. AFK Status
CREATE TABLE IF NOT EXISTS user_afk (
    guild_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    reason TEXT DEFAULT 'AFK',
    afk_since TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, user_id)
);