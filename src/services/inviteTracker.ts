import {
  Client,
  Guild,
  GuildMember,
  Events,
  PermissionFlagsBits,
  Role,
} from 'discord.js';
import { db } from '../core/database';
import { logger } from '../core/logger';

// ---------------------------------------------------------------------------
// 1. In-Memory Invite & Vanity Cache
// ---------------------------------------------------------------------------
// Maps: guildId -> Map<inviteCode, usesCount>
const guildInvitesCache = new Map<string, Map<string, number>>();

// Maps: guildId -> vanityUsesCount
const guildVanityCache = new Map<string, number>();

/**
 * Cache all current invites and vanity usage for a specific guild
 */
export async function cacheGuildInvites(guild: Guild): Promise<void> {
  const botMember = guild.members.me || (await guild.members.fetchMe().catch(() => null));
  if (!botMember || !botMember.permissions.has(PermissionFlagsBits.ManageGuild)) {
    logger.warn(`[INVITE] Missing 'ManageGuild' permission in ${guild.name} (${guild.id}). Cannot cache invites.`);
    return;
  }

  try {
    const invites = await guild.invites.fetch();
    const codeUsesMap = new Map<string, number>();
    for (const [code, invite] of invites) {
      codeUsesMap.set(code, invite.uses ?? 0);
    }
    guildInvitesCache.set(guild.id, codeUsesMap);

    // Cache vanity URL if guild has one
    if (guild.vanityURLCode) {
      const vanityData = await guild.fetchVanityData().catch(() => null);
      if (vanityData) {
        guildVanityCache.set(guild.id, vanityData.uses ?? 0);
      }
    }

    logger.info(`[INVITE] Cached ${codeUsesMap.size} invites for guild: ${guild.name}`);
  } catch (err: any) {
    logger.error({ err }, `[INVITE] Failed to fetch invites for guild ${guild.name} (${guild.id})`);
  }
}

/**
 * Initialize invite tracking across all joined guilds on startup
 */
export async function initInviteTracker(client: Client): Promise<void> {
  logger.info('[INVITE] Initializing invite cache across all guilds...');

  // 1. Initial snapshot of all cached guilds
  for (const [, guild] of client.guilds.cache) {
    await cacheGuildInvites(guild);
  }

  // 2. Listen to real-time invite creation
  client.on(Events.InviteCreate, (invite) => {
    if (!invite.guild || !(invite.guild instanceof Guild)) return;
    const guildMap = guildInvitesCache.get(invite.guild.id);
    if (guildMap) {
      guildMap.set(invite.code, invite.uses ?? 0);
      logger.info(`[INVITE] New invite created: ${invite.code} in ${invite.guild.name}`);
    } else {
      guildInvitesCache.set(invite.guild.id, new Map([[invite.code, invite.uses ?? 0]]));
    }
  });

  // 3. Listen to invite deletion
  client.on(Events.InviteDelete, (invite) => {
    if (!invite.guild || !(invite.guild instanceof Guild)) return;
    const guildMap = guildInvitesCache.get(invite.guild.id);
    if (guildMap) {
      guildMap.delete(invite.code);
      logger.info(`[INVITE] Invite deleted: ${invite.code} in ${invite.guild.name}`);
    }
  });

  // 4. Cache invites when bot joins a new guild
  client.on(Events.GuildCreate, async (guild) => {
    await cacheGuildInvites(guild);
  });
}

// ---------------------------------------------------------------------------
// 2. Invite Detection & Diffing on Member Join
// ---------------------------------------------------------------------------
/**
 * Detect which invite code was used by a joining member by comparing current
 * invites with the cached snapshot.
 *
 * Handles:
 * - Standard multi-use invites (uses incremented by 1)
 * - Single-use or maxUses-reached invites (disappear upon use)
 * - Vanity URLs (vanityData.uses incremented)
 */
export async function detectUsedInvite(member: GuildMember): Promise<string | null> {
  const guild = member.guild;
  const botMember = guild.members.me || (await guild.members.fetchMe().catch(() => null));

  if (!botMember || !botMember.permissions.has(PermissionFlagsBits.ManageGuild)) {
    logger.warn(`[INVITE] Cannot track invite in ${guild.name}: Bot lacks 'ManageGuild' permission.`);
    return null;
  }

  const cachedInvites = guildInvitesCache.get(guild.id);
  if (!cachedInvites) {
    // If not cached yet, cache now and exit
    await cacheGuildInvites(guild);
    return null;
  }

  let usedInviteCode: string | null = null;

  try {
    const currentInvites = await guild.invites.fetch();

    // Case 1: Check existing invites whose use count incremented
    for (const [code, invite] of currentInvites) {
      const cachedUses = cachedInvites.get(code);
      if (cachedUses !== undefined && (invite.uses ?? 0) > cachedUses) {
        usedInviteCode = code;
        break;
      }
    }

    // Case 2: Check for single-use / max-uses invites that were deleted upon use
    if (!usedInviteCode) {
      for (const [cachedCode] of cachedInvites) {
        if (!currentInvites.has(cachedCode)) {
          usedInviteCode = cachedCode;
          break;
        }
      }
    }

    // Case 3: Check vanity URL if not matched yet
    if (!usedInviteCode && guild.vanityURLCode) {
      const vanityData = await guild.fetchVanityData().catch(() => null);
      const cachedVanityUses = guildVanityCache.get(guild.id) ?? 0;
      if (vanityData && (vanityData.uses ?? 0) > cachedVanityUses) {
        usedInviteCode = guild.vanityURLCode;
        guildVanityCache.set(guild.id, vanityData.uses ?? 0);
      }
    }

    // Update in-memory cache with the new invites snapshot
    const updatedMap = new Map<string, number>();
    for (const [code, invite] of currentInvites) {
      updatedMap.set(code, invite.uses ?? 0);
    }
    guildInvitesCache.set(guild.id, updatedMap);

    return usedInviteCode;
  } catch (err: any) {
    logger.error({ err }, `[INVITE] Error diffing invites on member join in ${guild.name}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// 3. Role Assignment & Permission Validations
// ---------------------------------------------------------------------------
export interface RoleAssignResult {
  matched: boolean;
  assigned: boolean;
  roleId?: string;
  roleName?: string;
  error?: string;
}

/**
 * Assign the corresponding role to a member based on the invite code used.
 */
export async function handleInviteRoleAssignment(
  member: GuildMember,
  inviteCode: string | null
): Promise<RoleAssignResult> {
  if (!inviteCode) {
    return { matched: false, assigned: false, error: 'No invite code detected' };
  }

  try {
    // 1. Look up role mapping in database
    const res = await db.query(
      `SELECT role_id FROM guild_invite_roles WHERE guild_id = $1 AND invite_code = $2 LIMIT 1`,
      [member.guild.id, inviteCode]
    );

    if (res.rows.length === 0) {
      return { matched: false, assigned: false };
    }

    const roleId = res.rows[0].role_id;
    const guild = member.guild;
    const botMember = guild.members.me || (await guild.members.fetchMe().catch(() => null));

    // 2. Validate Bot's ManageRoles permission
    if (!botMember || !botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
      const err = `Bot lacks 'ManageRoles' permission in ${guild.name}`;
      logger.error(`[INVITE] ${err}`);
      return { matched: true, assigned: false, roleId, error: err };
    }

    // 3. Fetch and validate role
    const role: Role | null =
      guild.roles.cache.get(roleId) || (await guild.roles.fetch(roleId).catch(() => null));

    if (!role) {
      const err = `Configured role ID ${roleId} not found in guild ${guild.name}`;
      logger.warn(`[INVITE] ${err}`);
      return { matched: true, assigned: false, roleId, error: err };
    }

    // 4. Role Hierarchy Check
    if (botMember.roles.highest.position <= role.position) {
      const err = `Cannot assign role '${role.name}': Role position is higher than or equal to bot's highest role.`;
      logger.error(`[INVITE] ${err}`);
      return { matched: true, assigned: false, roleId, roleName: role.name, error: err };
    }

    // 5. Managed / Integration Role Check
    if (role.managed) {
      const err = `Cannot assign role '${role.name}': Role is managed by an integration/bot.`;
      logger.error(`[INVITE] ${err}`);
      return { matched: true, assigned: false, roleId, roleName: role.name, error: err };
    }

    // 6. Assign the role to the member
    await member.roles.add(role, `Auto-assigned via invite code: ${inviteCode}`);
    logger.info(`[INVITE] Successfully assigned role '${role.name}' to ${member.user.tag} (Invite: ${inviteCode})`);

    return {
      matched: true,
      assigned: true,
      roleId: role.id,
      roleName: role.name,
    };
  } catch (err: any) {
    const errorMsg = err.message || 'Unknown error assigning role';
    logger.error({ err }, `[INVITE] Exception assigning invite role to ${member.user.tag}`);
    return { matched: true, assigned: false, error: errorMsg };
  }
}
