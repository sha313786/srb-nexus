import { Guild, GuildMember } from 'discord.js';
import { logger } from '../core/logger';

export const NAADAN_GUILD_ID = '1558245529417293884';

export interface NaadanStaffTier {
  roleId: string;
  name: string;
  tag: string;
  priority: number;
}

export const NAADAN_STAFF_TIERS: NaadanStaffTier[] = [
  { roleId: '1570482996765524129', name: 'NL CORE', tag: 'NLC', priority: 3 },
  { roleId: '1570479143823610006', name: 'NL PRIME', tag: 'NLP', priority: 2 },
  { roleId: '1558414169362006106', name: 'NL APEX', tag: 'NLA', priority: 1 },
];

/**
 * Strips known staff/team prefixes from a username/nickname
 */
export function cleanStaffName(rawName: string): string {
  let name = (rawName || '').trim();
  // Strip out any NLC |, NLA |, NLP |, STF |, STA | prefix
  name = name.replace(/^(NLC|NLA|NLP|STF|STA)\s*[|・•\-_:]\s*/i, '');
  return name.trim();
}

/**
 * Determines highest priority staff tier for a member
 */
export function getMemberStaffTier(member: GuildMember): NaadanStaffTier | null {
  let highestTier: NaadanStaffTier | null = null;
  for (const tier of NAADAN_STAFF_TIERS) {
    const hasRole = member.roles.cache.some(
      (r) => r.id === tier.roleId || r.name.trim().toUpperCase() === tier.name
    );
    if (hasRole) {
      if (!highestTier || tier.priority > highestTier.priority) {
        highestTier = tier;
      }
    }
  }
  return highestTier;
}

/**
 * Handles GuildMemberUpdate events specifically for Naadan Legacy Esports staff roles.
 * Strictly scoped to NAADAN_GUILD_ID so no other servers are ever affected.
 */
export async function handleNaadanStaffNicknameUpdate(
  oldMember: GuildMember,
  newMember: GuildMember
): Promise<void> {
  // CRITICAL: Strictly isolate to Naadan Legacy Esports server only!
  if (newMember.guild.id !== NAADAN_GUILD_ID) {
    return;
  }

  const guild = newMember.guild;
  const ownerId = guild.ownerId || guild.client.guilds.cache.get(guild.id)?.ownerId;
  if (newMember.id === ownerId || newMember.id === guild.ownerId) {
    return; // Cannot alter server owner
  }

  const oldTier = getMemberStaffTier(oldMember);
  const newTier = getMemberStaffTier(newMember);

  // Case 1: Member has a staff tier now
  if (newTier) {
    const baseName = cleanStaffName(newMember.displayName || newMember.user.username);
    const targetNickname = `${newTier.tag} | ${baseName}`.slice(0, 32);

    if (newMember.nickname !== targetNickname) {
      if (!newMember.manageable) {
        logger.warn(`[NAADAN-STAFF] Cannot update nickname for ${newMember.user.tag} (role hierarchy restriction)`);
        return;
      }
      try {
        await newMember.setNickname(targetNickname, `Naadan staff role assigned: ${newTier.name} (${newTier.tag})`);
        logger.info(`[NAADAN-STAFF] Updated nickname for ${newMember.user.tag} -> "${targetNickname}"`);
      } catch (err: any) {
        logger.error({ err }, `[NAADAN-STAFF] Failed to update nickname for ${newMember.user.tag}`);
      }
    }
    return;
  }

  // Case 2: Member previously had staff tier, but now has NONE of them
  if (oldTier && !newTier) {
    const currentNick = newMember.nickname || '';
    const clean = cleanStaffName(currentNick);
    if (!newMember.manageable) return;

    try {
      await newMember.setNickname(
        clean.length > 0 && clean !== newMember.user.username ? clean : null,
        'Naadan staff role removed: reset nickname'
      );
      logger.info(`[NAADAN-STAFF] Reset nickname for ${newMember.user.tag} -> "${clean || 'Default'}"`);
    } catch (err: any) {
      logger.error({ err }, `[NAADAN-STAFF] Failed to reset nickname for ${newMember.user.tag}`);
    }
  }
}

/**
 * Bulk sync all existing staff members in Naadan Legacy Esports to their respective tags.
 */
export async function syncAllNaadanStaffNicknames(guild: Guild): Promise<{ updated: number; skipped: number }> {
  if (guild.id !== NAADAN_GUILD_ID) return { updated: 0, skipped: 0 };

  const members = await guild.members.fetch();
  let updated = 0;
  let skipped = 0;

  for (const member of members.values()) {
    if (member.id === guild.ownerId) {
      skipped++;
      continue;
    }

    const tier = getMemberStaffTier(member);
    if (!tier) continue;

    const baseName = cleanStaffName(member.displayName || member.user.username);
    const targetNickname = `${tier.tag} | ${baseName}`.slice(0, 32);

    if (member.nickname !== targetNickname) {
      if (!member.manageable) {
        logger.warn(`[NAADAN-STAFF] Cannot sync ${member.user.tag} (not manageable)`);
        skipped++;
        continue;
      }
      try {
        await member.setNickname(targetNickname, `Sync Naadan staff nickname: ${tier.tag}`);
        updated++;
        logger.info(`[NAADAN-STAFF] Synced ${member.user.tag} -> "${targetNickname}"`);
      } catch (err) {
        skipped++;
      }
    }
  }

  return { updated, skipped };
}
