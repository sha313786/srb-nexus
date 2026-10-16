import { db } from '../core/database';
import { logger } from '../core/logger';
import { EmbedBuilder } from 'discord.js';

export interface TagRow {
  id: number;
  guild_id: string;
  name: string;
  content: string;
  embed_title?: string;
  embed_color?: string;
  created_by?: string;
  created_at: Date;
}

/**
 * Fetch a tag by name for a specific guild
 */
export async function getGuildTag(guildId: string, tagName: string): Promise<TagRow | null> {
  try {
    const res = await db.query(
      'SELECT * FROM guild_tags WHERE guild_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1',
      [guildId, tagName.trim()]
    );
    return res.rows[0] || null;
  } catch (err: any) {
    logger.error({ err }, `[TAGS] Error fetching tag '${tagName}' for guild ${guildId}`);
    return null;
  }
}

/**
 * List all tags configured for a guild
 */
export async function listGuildTags(guildId: string): Promise<TagRow[]> {
  try {
    const res = await db.query(
      'SELECT * FROM guild_tags WHERE guild_id = $1 ORDER BY name ASC',
      [guildId]
    );
    return res.rows || [];
  } catch (err: any) {
    logger.error({ err }, `[TAGS] Error listing tags for guild ${guildId}`);
    return [];
  }
}

/**
 * Create or update an existing tag
 */
export async function upsertGuildTag(
  guildId: string,
  name: string,
  content: string,
  embedTitle?: string,
  embedColor: string = '#5865F2',
  createdBy?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!cleanName) return { success: false, error: 'Tag name must be alphanumeric with no spaces' };

    await db.query(
      `INSERT INTO guild_tags (guild_id, name, content, embed_title, embed_color, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (guild_id, name) DO UPDATE SET
        content = EXCLUDED.content,
        embed_title = EXCLUDED.embed_title,
        embed_color = EXCLUDED.embed_color,
        created_at = CURRENT_TIMESTAMP`,
      [guildId, cleanName, content.trim(), embedTitle ? embedTitle.trim() : null, embedColor || '#5865F2', createdBy || null]
    );

    return { success: true };
  } catch (err: any) {
    logger.error({ err }, `[TAGS] Error saving tag '${name}' for guild ${guildId}`);
    return { success: false, error: err.message };
  }
}

/**
 * Delete a tag by name
 */
export async function deleteGuildTag(guildId: string, name: string): Promise<boolean> {
  try {
    const res = await db.query(
      'DELETE FROM guild_tags WHERE guild_id = $1 AND LOWER(name) = LOWER($2)',
      [guildId, name.trim()]
    );
    return (res.rowCount ?? 0) > 0;
  } catch (err: any) {
    logger.error({ err }, `[TAGS] Error deleting tag '${name}' for guild ${guildId}`);
    return false;
  }
}

/**
 * Format tag response as either a clean Embed or plain text
 */
export function formatTagMessage(tag: TagRow): { content?: string; embeds?: EmbedBuilder[] } {
  if (tag.embed_title || tag.embed_color) {
    const embed = new EmbedBuilder()
      .setColor((tag.embed_color as any) || '#5865F2')
      .setTitle(tag.embed_title || tag.name)
      .setDescription(tag.content);
    return { embeds: [embed] };
  }
  return { content: tag.content };
}
