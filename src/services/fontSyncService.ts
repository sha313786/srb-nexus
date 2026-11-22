import { Guild, GuildBasedChannel, ChannelType, CategoryChannel } from 'discord.js';
import { logger } from '../core/logger';

export type FontStyleKey =
  | 'small_caps'
  | 'sans_bold'
  | 'serif_bold'
  | 'monospace'
  | 'gothic'
  | 'script'
  | 'circled'
  | 'normal';

export interface FontStyleOption {
  key: FontStyleKey;
  label: string;
  preview: string;
  description: string;
}

export interface SeparatorOption {
  symbol: string;
  label: string;
  preview: string;
  description: string;
}

export const FONT_STYLE_OPTIONS: FontStyleOption[] = [
  {
    key: 'small_caps',
    label: 'Small Caps',
    preview: 'ꜱᴍᴀʟʟ ᴄᴀᴘꜱ',
    description: 'Aesthetic miniature capital letters (Discord favorite)',
  },
  {
    key: 'sans_bold',
    label: 'Sans Bold',
    preview: '𝗦𝗮𝗻𝘀 𝗕𝗼𝗹𝗱',
    description: 'Modern, punchy, clean bold typography',
  },
  {
    key: 'serif_bold',
    label: 'Serif Bold',
    preview: '𝐒𝐞𝐫𝐢𝐟 𝐁𝐨𝐥𝐝',
    description: 'Classic, authoritative serif bold characters',
  },
  {
    key: 'monospace',
    label: 'Monospace',
    preview: '𝙼𝚘𝚗𝚘𝚜𝚙𝚊𝚌𝚎',
    description: 'Clean typewriter / developer monospace aesthetic',
  },
  {
    key: 'gothic',
    label: 'Gothic / Fraktur',
    preview: '𝔊𝔬𝔱𝔥𝔦𝔠 𝔖𝔱𝔶𝔩𝔢',
    description: 'Medieval, dark fantasy gothic lettering',
  },
  {
    key: 'script',
    label: 'Cursive / Script',
    preview: '𝓈𝒸𝓇𝒾𝓅𝓉 𝓈𝓉𝓎𝓁ℯ',
    description: 'Elegant, handwritten calligraphic script',
  },
  {
    key: 'circled',
    label: 'Circled',
    preview: 'Ⓒⓘⓡⓒⓛⓔⓓ',
    description: 'Enclosed bubble circle letters',
  },
  {
    key: 'normal',
    label: 'Reset to Normal',
    preview: 'Normal Text (A-Z)',
    description: 'Restores plain standard Latin text',
  },
];

export const SEPARATOR_OPTIONS: SeparatorOption[] = [
  {
    symbol: '│',
    label: 'Vertical Bar (│)',
    preview: '💬 │ general',
    description: 'Clean minimalist vertical line separator',
  },
  {
    symbol: '・',
    label: 'Middle Dot (・)',
    preview: '💬 ・ general',
    description: 'Popular Japanese aesthetic center dot',
  },
  {
    symbol: '┆',
    label: 'Dashed Bar (┆)',
    preview: '💬 ┆ general',
    description: 'Dotted vertical divider',
  },
  {
    symbol: '✦',
    label: 'Sparkle Star (✦)',
    preview: '💬 ✦ general',
    description: 'Fancy diamond star accent',
  },
  {
    symbol: '┋',
    label: 'Triple Dash (┋)',
    preview: '💬 ┋ general',
    description: 'Bold dashed column divider',
  },
  {
    symbol: '—',
    label: 'Em Dash (—)',
    preview: '💬 — general',
    description: 'Long horizontal aesthetic dash',
  },
  {
    symbol: '•',
    label: 'Bullet Point (•)',
    preview: '💬 • general',
    description: 'Simple circular bullet indicator',
  },
  {
    symbol: '~',
    label: 'Tilde Wave (~)',
    preview: '💬 ~ general',
    description: 'Casual wavy separator',
  },
];

// Unicode character mapping tables
const SMALL_CAPS_MAP: Record<string, string> = {
  a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ',
  i: 'ɪ', j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ',
  q: 'Q', r: 'ʀ', s: 'ꜱ', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x',
  y: 'ʏ', z: 'ᴢ',
  A: 'ᴀ', B: 'ʙ', C: 'ᴄ', D: 'ᴅ', E: 'ᴇ', F: 'ꜰ', G: 'ɢ', H: 'ʜ',
  I: 'ɪ', J: 'ᴊ', K: 'ᴋ', L: 'ʟ', M: 'ᴍ', N: 'ɴ', O: 'ᴏ', P: 'ᴘ',
  Q: 'Q', R: 'ʀ', S: 'ꜱ', T: 'ᴛ', U: 'ᴜ', V: 'ᴠ', W: 'ᴡ', X: 'x',
  Y: 'ʏ', Z: 'ᴢ',
};

const SANS_BOLD_MAP: Record<string, string> = {
  a: '𝗮', b: '𝗯', c: '𝗰', d: '𝗱', e: '𝗲', f: '𝗳', g: '𝗴', h: '𝗵',
  i: '𝗶', j: '𝗷', k: '𝗸', l: '𝗹', m: '𝗺', n: '𝗻', o: '𝗼', p: '𝗽',
  q: '𝗾', r: '𝗿', s: '𝘀', t: '𝘁', u: '𝘂', v: '𝘃', w: '𝘄', x: '𝘅',
  y: '𝘆', z: '𝘇',
  A: '𝗔', B: '𝗕', C: '𝗖', D: '𝗗', E: '𝗘', F: '𝗙', G: '𝗚', H: '𝗛',
  I: '𝗜', J: '𝗝', K: '𝗞', L: '𝗟', M: '𝗠', N: '𝗡', O: '𝗢', P: '𝗣',
  Q: '𝗤', R: '𝗥', S: '𝗦', T: '𝗧', U: '𝗨', V: '𝗩', W: '𝗪', X: '𝗫',
  Y: '𝗬', Z: '𝗭',
  '0': '𝟬', '1': '𝟭', '2': '𝟮', '3': '𝟯', '4': '𝟰', '5': '𝟱',
  '6': '𝟲', '7': '𝟳', '8': '𝟴', '9': '𝟵',
};

const SERIF_BOLD_MAP: Record<string, string> = {
  a: '𝐚', b: '𝐛', c: '𝐜', d: '𝐝', e: '𝐞', f: '𝐟', g: '𝐠', h: '𝐡',
  i: '𝐢', j: '𝐣', k: '𝐤', l: '𝐥', m: '𝐦', n: '𝐧', o: '𝐨', p: '𝐩',
  q: '𝐪', r: '𝐫', s: '𝐬', t: '𝐭', u: '𝐮', v: '𝐯', w: '𝐰', x: '𝐱',
  y: '𝐲', z: '𝐳',
  A: '𝐀', B: '𝐁', C: '𝐂', D: '𝐃', E: '𝐄', F: '𝐅', G: '𝐆', H: '𝐇',
  I: '𝐈', J: '𝐉', K: '𝐊', L: '𝐋', M: '𝐌', N: '𝐍', O: '𝐎', P: '𝐏',
  Q: '𝐐', R: '𝐑', S: '𝐒', T: '𝐓', U: '𝐔', V: '𝐕', W: '𝐖', X: '𝐗',
  Y: '𝐘', Z: '𝐙',
  '0': '𝟎', '1': '𝟏', '2': '𝟐', '3': '𝟑', '4': '𝟒', '5': '𝟓',
  '6': '𝟔', '7': '𝟕', '8': '𝟖', '9': '𝟗',
};

const MONOSPACE_MAP: Record<string, string> = {
  a: '𝚊', b: '𝚋', c: '𝚌', d: '𝚍', e: '𝚎', f: '𝚏', g: '𝚐', h: '𝚑',
  i: '𝚒', j: '𝚓', k: '𝚔', l: '𝚕', m: '𝚖', n: '𝚗', o: '𝚘', p: '𝚙',
  q: '𝚚', r: '𝚛', s: '𝚜', t: '𝚝', u: '𝚞', v: '𝚟', w: '𝚠', x: '𝚡',
  y: '𝚢', z: '𝚣',
  A: '𝙰', B: '𝙱', C: '𝙲', D: '𝙳', E: '𝙴', F: '𝙵', G: '𝙶', H: '𝙷',
  I: '𝙸', J: '𝙹', K: '𝙺', L: '𝙻', M: '𝙼', N: '𝙽', O: '𝙾', P: '𝙿',
  Q: '𝚀', R: '𝚁', S: '𝚂', T: '𝚃', U: '𝚄', V: '𝚅', W: '𝚆', X: '𝚇',
  Y: '𝚈', Z: '𝚉',
  '0': '𝟶', '1': '𝟷', '2': '𝟸', '3': '𝟹', '4': '𝟺', '5': '𝟻',
  '6': '𝟼', '7': '𝟽', '8': '𝟾', '9': '𝟿',
};

const GOTHIC_MAP: Record<string, string> = {
  a: '𝔞', b: '𝔟', c: '𝔠', d: '𝔡', e: '𝔢', f: '𝔣', g: '𝔤', h: '𝔥',
  i: '𝔦', j: '𝔧', k: '𝔨', l: '𝔩', m: '𝔪', n: '𝔫', o: '𝔬', p: '𝔭',
  q: '𝔮', r: '𝔯', s: '𝔰', t: '𝔱', u: '𝔲', v: '𝔳', w: '𝔴', x: '𝔵',
  y: '𝔶', z: '𝔷',
  A: '𝔄', B: '𝔅', C: 'ℭ', D: '𝔇', E: '𝔈', F: '𝔉', G: '𝔊', H: 'ℌ',
  I: 'ℑ', J: '𝔍', K: '𝔎', L: '𝔏', M: '𝔐', N: '𝔑', O: '𝔒', P: '𝔓',
  Q: '𝔔', R: 'ℜ', S: '𝔖', T: '𝔗', U: '𝔘', V: '𝔙', W: '𝔚', X: '𝔛',
  Y: '𝔜', Z: 'ℨ',
};

const SCRIPT_MAP: Record<string, string> = {
  a: '𝒶', b: '𝒷', c: '𝒸', d: '𝒹', e: 'ℯ', f: '𝒻', g: 'ℊ', h: '𝒽',
  i: '𝒾', j: '𝒿', k: '𝓀', l: '𝓁', m: '𝓂', n: '𝓃', o: 'ℴ', p: '𝓅',
  q: '𝓆', r: '𝓇', s: '𝓈', t: '𝓉', u: '𝓊', v: '𝓋', w: '𝓌', x: '𝓍',
  y: '𝓎', z: '𝓏',
  A: '𝒜', B: 'ℬ', C: '𝒞', D: '𝒟', E: 'ℰ', F: 'ℱ', G: '𝒢', H: 'ℋ',
  I: 'ℐ', J: '𝒥', K: '𝒦', L: 'ℒ', M: 'ℳ', N: '𝒩', O: '𝒪', P: '𝒫',
  Q: '𝒬', R: 'ℛ', S: '𝒮', T: '𝒯', U: '𝒰', V: '𝒱', W: '𝒲', X: '𝒳',
  Y: '𝒴', Z: '𝒵',
};

const CIRCLED_MAP: Record<string, string> = {
  a: 'ⓐ', b: 'ⓑ', c: 'ⓒ', d: 'ⓓ', e: 'ⓔ', f: 'ⓕ', g: 'ⓖ', h: 'ⓗ',
  i: 'ⓘ', j: 'ⓙ', k: 'ⓚ', l: 'ⓛ', m: 'ⓜ', n: 'ⓝ', o: 'ⓞ', p: 'ⓟ',
  q: 'ⓠ', r: 'ⓡ', s: 'ⓢ', t: 'ⓣ', u: 'ⓤ', v: 'ⓥ', w: 'ⓦ', x: 'ⓧ',
  y: 'ⓨ', z: 'ⓩ',
  A: 'Ⓐ', B: 'Ⓑ', C: 'Ⓒ', D: 'Ⓓ', E: 'Ⓔ', F: 'Ⓕ', G: 'Ⓖ', H: 'Ⓗ',
  I: 'Ⓘ', J: 'Ⓙ', K: 'Ⓚ', L: 'Ⓛ', M: 'Ⓜ', N: 'Ⓝ', O: 'Ⓞ', P: 'Ⓟ',
  Q: 'Ⓠ', R: 'Ⓡ', S: 'Ⓢ', T: 'Ⓣ', U: 'Ⓤ', V: 'Ⓥ', W: 'Ⓦ', X: 'Ⓧ',
  Y: 'Ⓨ', Z: 'Ⓩ',
  '0': '⓪', '1': '①', '2': '②', '3': '③', '4': '④', '5': '⑤',
  '6': '⑥', '7': '⑦', '8': '⑧', '9': '⑨',
};

// Build reverse normalizer map
const REVERSE_NORMAL_MAP: Record<string, string> = {};
function registerReverse(map: Record<string, string>) {
  for (const [ascii, fancy] of Object.entries(map)) {
    REVERSE_NORMAL_MAP[fancy] = ascii;
  }
}
registerReverse(SMALL_CAPS_MAP);
registerReverse(SANS_BOLD_MAP);
registerReverse(SERIF_BOLD_MAP);
registerReverse(MONOSPACE_MAP);
registerReverse(GOTHIC_MAP);
registerReverse(SCRIPT_MAP);
registerReverse(CIRCLED_MAP);

/**
 * Normalizes any fancy unicode text back to standard ASCII characters
 */
export function normalizeToPlain(text: string): string {
  let result = '';
  for (const char of Array.from(text)) {
    result += REVERSE_NORMAL_MAP[char] || char;
  }
  return result;
}

/**
 * Converts plain text into chosen font style
 */
export function convertTextToFont(text: string, fontKey: FontStyleKey): string {
  if (fontKey === 'normal') {
    return normalizeToPlain(text);
  }

  // First normalize so we start from clean ASCII
  const plain = normalizeToPlain(text);

  let targetMap: Record<string, string>;
  switch (fontKey) {
    case 'small_caps':
      targetMap = SMALL_CAPS_MAP;
      break;
    case 'sans_bold':
      targetMap = SANS_BOLD_MAP;
      break;
    case 'serif_bold':
      targetMap = SERIF_BOLD_MAP;
      break;
    case 'monospace':
      targetMap = MONOSPACE_MAP;
      break;
    case 'gothic':
      targetMap = GOTHIC_MAP;
      break;
    case 'script':
      targetMap = SCRIPT_MAP;
      break;
    case 'circled':
      targetMap = CIRCLED_MAP;
      break;
    default:
      return plain;
  }

  let result = '';
  for (const char of Array.from(plain)) {
    result += targetMap[char] || char;
  }
  return result;
}

const KNOWN_SEPARATORS_REGEX = /^[│┃|・•┆┊✦✧┋—–~]+/;
const LEADING_EMOJI_REGEX = /^(\s*(?:<a?:[a-zA-Z0-9_]+:\d+>|\p{Extended_Pictographic}|[\u2600-\u27BF]|[\u2300-\u23FF]|[\u2B50\u2B55\u2705\u274C]|[\u2000-\u3300])+\s*)/u;

export interface ParsedChannelName {
  original: string;
  prefixEmoji: string;
  separator: string;
  title: string;
}

/**
 * Deconstructs a channel/category name into prefix emojis, separator, and title
 */
export function parseChannelName(name: string): ParsedChannelName {
  let trimmed = name.trim();
  let prefixEmoji = '';
  let separator = '';
  let title = trimmed;

  // 1. Check for leading emoji
  const emojiMatch = trimmed.match(LEADING_EMOJI_REGEX);
  if (emojiMatch) {
    prefixEmoji = emojiMatch[1].trim();
    trimmed = trimmed.slice(emojiMatch[0].length).trim();
  }

  // 2. Check for separator immediately after emoji or at start
  const sepMatch = trimmed.match(KNOWN_SEPARATORS_REGEX);
  if (sepMatch) {
    separator = sepMatch[0].trim();
    trimmed = trimmed.slice(sepMatch[0].length).trim();
  }

  title = trimmed;

  return {
    original: name,
    prefixEmoji,
    separator,
    title,
  };
}

/**
 * Reassembles a channel name with a new separator
 */
export function transformChannelSeparator(name: string, newSeparator: string): string {
  const parsed = parseChannelName(name);

  if (parsed.prefixEmoji) {
    return `${parsed.prefixEmoji} ${newSeparator} ${parsed.title}`;
  }

  // If no prefix emoji existed previously, keep name intact
  return name;
}

/**
 * Reassembles a channel name with a new font style
 */
export function transformChannelFont(name: string, fontKey: FontStyleKey): string {
  const parsed = parseChannelName(name);
  const newTitle = convertTextToFont(parsed.title, fontKey);

  if (parsed.prefixEmoji && parsed.separator) {
    return `${parsed.prefixEmoji} ${parsed.separator} ${newTitle}`;
  }

  if (parsed.prefixEmoji) {
    return `${parsed.prefixEmoji} ${newTitle}`;
  }

  return newTitle;
}

/**
 * Preview modifications across a set of channels
 */
export function generateSyncPreview(
  channels: GuildBasedChannel[],
  type: 'design' | 'font',
  value: string,
  limit: number = 5
): Array<{ id: string; oldName: string; newName: string }> {
  const results: Array<{ id: string; oldName: string; newName: string }> = [];

  for (const ch of channels) {
    if (results.length >= limit) break;
    const oldName = ch.name;
    const newName =
      type === 'design'
        ? transformChannelSeparator(oldName, value)
        : transformChannelFont(oldName, value as FontStyleKey);

    if (oldName !== newName) {
      results.push({ id: ch.id, oldName, newName });
    }
  }

  return results;
}

/**
 * Batch rename channels with rate limit safety (800ms delay between operations)
 */
export async function executeBatchSync(
  channels: GuildBasedChannel[],
  type: 'design' | 'font',
  value: string,
  onProgress?: (current: number, total: number, channelName: string) => Promise<void>
): Promise<{ updated: number; failed: number; skipped: number }> {
  let updated = 0;
  let failed = 0;
  let skipped = 0;

  const total = channels.length;

  for (let i = 0; i < total; i++) {
    const ch = channels[i];
    const oldName = ch.name;
    const newName =
      type === 'design'
        ? transformChannelSeparator(oldName, value)
        : transformChannelFont(oldName, value as FontStyleKey);

    if (oldName === newName) {
      skipped++;
      continue;
    }

    try {
      await ch.setName(newName, `[SRB NEXUS] Font & Design Sync: ${type} -> ${value}`);
      updated++;
      if (onProgress && (i % 3 === 0 || i === total - 1)) {
        await onProgress(i + 1, total, newName).catch(() => {});
      }
      // Gentle pause to respect Discord rate limits
      await new Promise((resolve) => setTimeout(resolve, 800));
    } catch (err: any) {
      logger.warn({ err, channelId: ch.id, channelName: oldName }, '[FONT_SYNC] Channel rename failed');
      failed++;
    }
  }

  return { updated, failed, skipped };
}
