-- Welcome & Leave Module
CREATE TABLE IF NOT EXISTS module_welcome (
    guild_id VARCHAR(20) PRIMARY KEY,
    welcome_channel_id VARCHAR(20),
    welcome_message TEXT DEFAULT 'Welcome {user} to {server}!',
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

-- Leveling Module
CREATE TABLE IF NOT EXISTS module_levels (
    guild_id VARCHAR(20) PRIMARY KEY,
    level_channel_id VARCHAR(20), -- 'current' or channel_id
    xp_rate FLOAT DEFAULT 1.0,
    enabled BOOLEAN DEFAULT TRUE
);

-- Tickets Module
CREATE TABLE IF NOT EXISTS module_tickets (
    guild_id VARCHAR(20) PRIMARY KEY,
    category_id VARCHAR(20),
    transcript_channel_id VARCHAR(20),
    support_role_id VARCHAR(20)
);