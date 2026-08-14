-- General / Overview Module
CREATE TABLE IF NOT EXISTS module_overview (
    guild_id VARCHAR(20) PRIMARY KEY,
    prefix VARCHAR(10) DEFAULT '!',
    system_notifications BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Welcome & Leave Module
CREATE TABLE IF NOT EXISTS module_welcome (
    guild_id VARCHAR(20) PRIMARY KEY,
    welcome_channel_id VARCHAR(20),
    welcome_message TEXT DEFAULT 'Welcome {user} to {server}!',
    welcome_bg_url TEXT DEFAULT NULL,
    leave_channel_id VARCHAR(20),
    leave_message TEXT DEFAULT '{username} has left the server.',
    autorole_id VARCHAR(20),
    enabled BOOLEAN DEFAULT TRUE
);

-- Moderation Module
CREATE TABLE IF NOT EXISTS module_moderation (
    guild_id VARCHAR(20) PRIMARY KEY,
    log_channel_id VARCHAR(20),
    mute_role_id VARCHAR(20),
    anti_links BOOLEAN DEFAULT FALSE,
    anti_spam BOOLEAN DEFAULT FALSE
);

-- Notifications & Deals Module
CREATE TABLE IF NOT EXISTS module_notifications (
    guild_id VARCHAR(20) PRIMARY KEY,
    notifications_channel_id VARCHAR(20),
    free_games_enabled BOOLEAN DEFAULT FALSE,
    discounts_enabled BOOLEAN DEFAULT FALSE,
    enabled BOOLEAN DEFAULT TRUE
);

-- Leveling Module
CREATE TABLE IF NOT EXISTS module_levels (
    guild_id VARCHAR(20) PRIMARY KEY,
    level_channel_id VARCHAR(20), -- 'current' or channel_id
    level_message TEXT DEFAULT 'GG {user}, you reached Level {level}!',
    xp_rate FLOAT DEFAULT 1.0,
    role_rewards JSONB DEFAULT '[]'::jsonb,
    enabled BOOLEAN DEFAULT TRUE
);

-- Music Player Module
CREATE TABLE IF NOT EXISTS module_music (
    guild_id VARCHAR(20) PRIMARY KEY,
    dj_role_id VARCHAR(20),
    default_volume INT DEFAULT 80,
    max_queue_length INT DEFAULT 100,
    enabled BOOLEAN DEFAULT TRUE
);

-- Economy Module
CREATE TABLE IF NOT EXISTS module_economy (
    guild_id VARCHAR(20) PRIMARY KEY,
    currency_symbol VARCHAR(10) DEFAULT '🪙',
    daily_reward INT DEFAULT 100,
    work_min_reward INT DEFAULT 20,
    work_max_reward INT DEFAULT 80,
    enabled BOOLEAN DEFAULT TRUE
);

-- Tickets Module
CREATE TABLE IF NOT EXISTS module_tickets (
    guild_id VARCHAR(20) PRIMARY KEY,
    category_id VARCHAR(20),
    transcript_channel_id VARCHAR(20),
    support_role_id VARCHAR(20)
);

-- User Economy Balances
CREATE TABLE IF NOT EXISTS user_economy (
    guild_id VARCHAR(20),
    user_id VARCHAR(20),
    balance BIGINT DEFAULT 0,
    bank BIGINT DEFAULT 0,
    last_daily TIMESTAMP WITH TIME ZONE,
    last_work TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (guild_id, user_id)
);