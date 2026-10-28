import { Guild, GuildMember } from 'discord.js';
import { db } from '../core/database';
import { logger } from '../core/logger';

export const COMMON_STAFF_NAME = 'SRB Support';
const DEFAULT_SUPPORT_ROLE_ID = '1525111410651041973'; // 🎯 Support Team in SRB Studio

// Initialize database table for original nickname retention
export async function initStaffNicknameTable(): Promise<void> {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS staff_original_nicknames (
        guild_id VARCHAR(32) NOT NULL,
        user_id VARCHAR(32) NOT NULL,
        original_name VARCHAR(64),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (guild_id, user_id)
      );
    `);
  } catch (err) {
    logger.error({ err }, '[STAFF NICKNAME] Failed to initialize staff_original_nicknames table');
  }
}

/**
 * Resolves the configured support role ID for a guild.
 */
async function getSupportRoleId(guild: Guild): Promise<string> {
  try {
    const res = await db.query(
      `SELECT support_role_id FROM guild_settings WHERE guild_id = $1`,
      [guild.id]
    ).catch(() => null);

    const configured = res?.rows?.[0]?.support_role_id;
    if (configured && guild.roles.cache.has(configured)) {
      return configured;
    }
  } catch {}

  // Fallback for SRB Studio
  if (guild.id === '1525065834572021851' && guild.roles.cache.has(DEFAULT_SUPPORT_ROLE_ID)) {
    return DEFAULT_SUPPORT_ROLE_ID;
  }

  // Fallback to searching role by name
  const found = guild.roles.cache.find(
    (r) => /support team/i.test(r.name) || (r.name.toLowerCase().includes('support') && !r.name.toLowerCase().includes('bot'))
  );
  return found ? found.id : DEFAULT_SUPPORT_ROLE_ID;
}

/**
 * Handles GuildMemberUpdate events when roles are added or removed.
 */
export async function handleStaffNicknameUpdate(
  oldMember: GuildMember,
  newMember: GuildMember
): Promise<void> {
  // CRITICAL: Staff uniform nickname is exclusive to SRB Studio only!
  if (newMember.guild.id !== '1525065834572021851') {
    return;
  }

  try {
    const guild = newMember.guild;
    const supportRoleId = await getSupportRoleId(guild);

    const hadRole = oldMember.roles.cache.has(supportRoleId);
    const hasRole = newMember.roles.cache.has(supportRoleId);

    // If member has the support role and nickname is not yet 'SRB Support', rename them!
    if (hasRole) {
      if (newMember.nickname !== COMMON_STAFF_NAME) {
        await applyStaffNickname(newMember);
      }
      return;
    }

    // Case 2: Support role was REMOVED
    if (hadRole && !hasRole) {
      await restoreStaffNickname(newMember);
      return;
    }
  } catch (err) {
    logger.error({ err }, '[STAFF NICKNAME] Error handling staff nickname update');
  }
}

/**
 * Applies the uniform 'SRB Support' nickname to a staff member.
 */
export async function applyStaffNickname(member: GuildMember): Promise<boolean> {
  const guild = member.guild;
  if (guild.id !== '1525065834572021851') return false;

  // Cannot modify guild owner nickname (Discord API limitation)
  const ownerId = guild.ownerId || guild.client.guilds.cache.get(guild.id)?.ownerId || '608606355762315270';
  if (member.id === ownerId || member.id === guild.ownerId) {
    logger.info(`[STAFF NICKNAME] Skipped server owner ${member.user.tag} (Discord does not permit bots to change Server Owner nickname)`);
    return false;
  }

  // Check Discord manageability (checks role hierarchy and bot permissions)
  if (!member.manageable) {
    logger.warn(`[STAFF NICKNAME] Cannot rename ${member.user.tag} (not manageable: role is higher than or equal to bot)`);
    return false;
  }

  // Already named correctly
  if (member.nickname === COMMON_STAFF_NAME) {
    return true;
  }

  // Save original nickname in DB if not already saved
  const originalName = member.nickname || member.user.username;
  await db.query(
    `INSERT INTO staff_original_nicknames (guild_id, user_id, original_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (guild_id, user_id) DO NOTHING`,
    [guild.id, member.id, originalName]
  ).catch(() => {});

  try {
    await member.setNickname(COMMON_STAFF_NAME, 'Automated Support Staff uniform identity');
    logger.info(`[STAFF NICKNAME] Renamed ${member.user.tag} (${member.id}) -> '${COMMON_STAFF_NAME}'`);
    return true;
  } catch (err) {
    logger.error({ err, memberId: member.id }, `[STAFF NICKNAME] Failed to set nickname for ${member.user.tag}`);
    return false;
  }
}

/**
 * Restores a member's original nickname when the support role is removed.
 */
export async function restoreStaffNickname(member: GuildMember): Promise<boolean> {
  const guild = member.guild;
  if (guild.id !== '1525065834572021851') return false;

  if (member.id === guild.ownerId) return false;

  // Only restore if current nickname is still the staff name
  if (member.nickname !== COMMON_STAFF_NAME) {
    return true;
  }

  // Retrieve original name from DB
  const res = await db.query(
    `SELECT original_name FROM staff_original_nicknames WHERE guild_id = $1 AND user_id = $2`,
    [guild.id, member.id]
  ).catch(() => null);

  const originalName = res?.rows?.[0]?.original_name || null;

  try {
    await member.setNickname(originalName, 'Support Staff role removed - restored original name');
    await db.query(
      `DELETE FROM staff_original_nicknames WHERE guild_id = $1 AND user_id = $2`,
      [guild.id, member.id]
    ).catch(() => {});
    logger.info(`[STAFF NICKNAME] Restored original nickname for ${member.user.tag} -> ${originalName || 'default username'}`);
    return true;
  } catch (err) {
    logger.error({ err, memberId: member.id }, `[STAFF NICKNAME] Failed to restore nickname for ${member.user.tag}`);
    return false;
  }
}

/**
 * Synchronizes all existing members holding the support role in a guild.
 */
export async function syncAllSupportStaffNicknames(
  guild: Guild
): Promise<{ updated: number; skipped: number }> {
  if (guild.id !== '1525065834572021851') {
    return { updated: 0, skipped: 0 };
  }
  let updated = 0;
  let skipped = 0;

  try {
    const supportRoleId = await getSupportRoleId(guild);
    const members = await guild.members.fetch();
    const staffMembers = members.filter((m) => m.roles.cache.has(supportRoleId));

    for (const [_, member] of staffMembers) {
      if (member.id === guild.ownerId) {
        skipped++;
        continue;
      }

      if (member.nickname === COMMON_STAFF_NAME) {
        skipped++;
        continue;
      }

      const success = await applyStaffNickname(member);
      if (success) {
        updated++;
      } else {
        skipped++;
      }
    }
  } catch (err) {
    logger.error({ err }, '[STAFF NICKNAME] Error syncing all support staff nicknames');
  }

  return { updated, skipped };
}
