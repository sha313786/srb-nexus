import {
  ButtonInteraction,
  ModalSubmitInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  Client,
  TextChannel,
} from 'discord.js';
import { db } from '../core/database';
import { logger } from '../core/logger';

const GUILD_ID = '1558245529417293884'; // NAADAN LEGACY ESPORTS
// Temporarily disabled per user request; set ENABLE_TEAM_NICKNAME_CHANGE=true in env (or true here) to re-enable
export const TEAM_NICKNAME_AUTO_CHANGE_ENABLED = process.env.ENABLE_TEAM_NICKNAME_CHANGE === 'true';
const STAFF_REVIEW_CHANNEL_ID = '1570853707317379185'; // 📋・ᴛᴇᴀᴍ-ʀᴇɢɪꜱᴛʀᴀᴛɪᴏɴꜱ
const TEAM_ZONE_CATEGORY_ID = '1570853712459604179'; // 🏆 ══════ 𝐓𝐎𝐔𝐑𝐍𝐀𝐌𝐄𝐍𝐓 𝐙𝐎𝐍𝐄 ══════ 🏆
const REGISTERED_ROLE_ID = '1566440573513244682'; // @registered
const TEAM_LEADER_ROLE_ID = '1571071414448955564'; // 👑 TEAM LEADER

const NON_TEAM_ROLE_IDS = new Set([
  GUILD_ID,
  REGISTERED_ROLE_ID,
  TEAM_LEADER_ROLE_ID,
  '1558424066401116170', // Community
  '1566427236113064008', // verified
  '1558743856952905758', // VALO
  '1567197063039688866', // COC
  '1574803857454923828', // PUBG PC
  '1574803859698880552', // eFootball
  '1570483729317765371', // VALO HEAD
  '1570483606814466128', // COC HEAD
  '1558780001283997777', // CTRL+R
  '1558849788156321823', // DRAG
  '1574850114755887125', // TICKET SUPPORTER
  '1574344826680508488', // STAFF TEAM
  '1574344822859505685', // EVENT COORDINATOR
  '1574344824545607771', // EVENT ADMIN
  '1558414169362006106', // NL APEX
  '1570479143823610006', // NL PRIME
  '1570482996765524129', // NL CORE
  '1574344821080858635', // EVENT DIRECTOR
  '1574344814047141899', // MEDIA AUTHORITY
  '1574344818912657440', // FINANCE DIRECTORATE
  '1558414237007876136', // LEGACY BROADCAST
  '1574344811744333835', // WEB SCOUT
  '1574344809701843045', // WEB VANGUARD
  '1558762448176025651', // ADMINISTRATOR
  '1558416269429055590', // PROTOCOL GUARDS
  '1558428081260072980', // MANAGEMENT
  '1558247194090537162', // DEV
  '1558776105606053948', // PVT
  '1558246978889187458', // DIRECTOR
  '1566426963625779361', // +
]);

const FIXED_SERVER_CATEGORY_IDS = new Set([
  '1558245533238427748', // COMMUNITY
  '1558420666246635700', // TEMP VOICE
  '1558420851827802222', // STAFF ONLY
  '1558422503674744902', // LOGS
  '1558504301138153573', // MANAGEMENT
  '1558728942675042355', // VALO
  '1558728976330137661', // PUBG PC
  '1558762922153353339', // ADMINISTRATOR
  '1558764230000508978', // PUBLIC ZONE
  '1558765305076125716', // SUPPORT
  '1558776368974663760', // PVT ZONE
  '1558778834797600778', // LIVE AREA
  '1558783912551907398', // EFOOTBALL
  '1558785327169020035', // MUSIC
  '1558787531380760606', // STAGE
  '1559197806005063710', // SERVER STATS
  '1567456201275482192', // COC
  '1567498405033283584', // LOGO
  '1570853712459604179', // TOURNAMENT ZONE
  '1574838857357197458', // AFK
]);

const PROTECTED_STAFF_TAG_RE = /^(NLC|NLA|NLP|AD|DIR|DEV|STF)\s*[|・•\-_:]/i;

const COMMUNITY_ROLE_ID = '1558424066401116170'; // @Community (hoisted at pos 16)
const STAFF_TEAM_ROLE_ID = '1574344826680508488'; // @STAFF TEAM (needs access to all team VCs without Admin)

export const TEAM_COLORS = [
  '#00F0FF', // Cyber Cyan
  '#FF2E93', // Neon Fuchsia / Pink
  '#10B981', // Vivid Emerald
  '#F59E0B', // Amber Gold
  '#A855F7', // Royal Purple
  '#EF4444', // Crimson Red
  '#3B82F6', // Cobalt Blue
  '#FB923C', // Bright Orange
  '#84CC16', // Electric Lime
  '#E11D48', // Ruby Rose
  '#FACC15', // Vivid Yellow
  '#8B5CF6', // Violet
  '#EC4899', // Hot Pink
  '#22D3EE', // Electric Sky
  '#34D399', // Mint Green
  '#F97316', // Sunset Orange
];

export function getDistinctTeamColor(guild: any, teamName: string): string {
  const usedColors = new Set<string>(['#000000', '#ffffff', '#0fa5be']); // exclude default + @Community teal
  guild.roles.cache.forEach((r: any) => {
    if (isTeamRole(r, guild) && r.hexColor) {
      usedColors.add(r.hexColor.toLowerCase());
    }
  });

  let hash = 0;
  for (let i = 0; i < teamName.length; i++) {
    hash = (hash << 5) - hash + teamName.charCodeAt(i);
    hash |= 0;
  }
  const startIdx = Math.abs(hash) % TEAM_COLORS.length;
  for (let offset = 0; offset < TEAM_COLORS.length; offset++) {
    const candidate = TEAM_COLORS[(startIdx + offset) % TEAM_COLORS.length];
    if (!usedColors.has(candidate.toLowerCase())) {
      return candidate;
    }
  }
  return TEAM_COLORS[startIdx];
}

/**
 * Ensures a team role has a distinct vivid color, is hoisted separately in the sidebar,
 * and is positioned above @Community so its color and section grouping actually display!
 */
export async function styleAndHoistTeamRole(teamRole: any, guild: any): Promise<void> {
  if (!teamRole || !guild || guild.id !== GUILD_ID) return;

  const needsColor =
    !teamRole.hexColor ||
    teamRole.hexColor.toLowerCase() === '#000000' ||
    teamRole.hexColor.toLowerCase() === '#ffffff' ||
    teamRole.hexColor.toLowerCase() === '#eab308';

  const newColor = needsColor ? getDistinctTeamColor(guild, teamRole.name) : undefined;
  const needsHoist = !teamRole.hoist;

  if (newColor || needsHoist) {
    await teamRole
      .edit({
        ...(newColor ? { color: newColor as any } : {}),
        hoist: true,
        mentionable: true,
        reason: `Separate team display & distinct color for ${teamRole.name}`,
      })
      .catch((err: any) => {
        logger.warn({ err: err.message }, `[TEAM-REG] Failed styling role ${teamRole.name}`);
      });
    logger.info(
      `[TEAM-REG] Styled team role @${teamRole.name} (color=${newColor || teamRole.hexColor}, hoist=true)`
    );
  }

  // Position above @Community so the team section & color override @Community
  const communityRole = guild.roles.cache.get(COMMUNITY_ROLE_ID) || guild.roles.cache.get(REGISTERED_ROLE_ID);
  const botHighest = guild.members.me?.roles?.highest;
  if (communityRole && teamRole.rawPosition <= communityRole.rawPosition) {
    const targetPos = communityRole.rawPosition + 1;
    if (!botHighest || targetPos < botHighest.rawPosition) {
      try {
        await teamRole.setPosition(targetPos);
        logger.info(`[TEAM-REG] Positioned @${teamRole.name} above @Community (pos=${targetPos})`);
      } catch (err: any) {
        logger.warn({ err: err.message }, `[TEAM-REG] Failed positioning role ${teamRole.name}`);
      }
    }
  }
}

// Helper to sanitize team name into a clean discord channel slug
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 30) || 'squad';
}

/**
 * Normalizes Unicode fonts (small caps, math bold, emojis) to plain lowercase alphanumeric
 */
export function normalizeDiscordName(str: string): string {
  const smallCapsMap: Record<string, string> = {
    'ᴀ': 'a', 'ʙ': 'b', 'ᴄ': 'c', 'ᴅ': 'd', 'ᴇ': 'e', 'ꜰ': 'f', 'ɢ': 'g', 'ʜ': 'h',
    'ɪ': 'i', 'ᴊ': 'j', 'ᴋ': 'k', 'ʟ': 'l', 'ᴍ': 'm', 'ɴ': 'n', 'ᴏ': 'o', 'ᴘ': 'p',
    'ǫ': 'q', 'ʀ': 'r', 'ꜱ': 's', 'ᴛ': 't', 'ᴜ': 'u', 'ᴠ': 'v', 'ᴡ': 'w', 'x': 'x',
    'ʏ': 'y', 'ᴢ': 'z'
  };
  return (str || '')
    .split('')
    .map((char) => smallCapsMap[char] || char)
    .join('')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function clientAppId(guild: any): string {
  return guild.client?.user?.id || '1526885301736177705';
}

/**
 * Extract or derive clean short team tag (e.g. "NDL", "VLX")
 */
export function extractTeamTag(teamName: string, teamTag?: string, captainIGN?: string): string {
  if (teamTag && teamTag.trim().length > 0) {
    return teamTag.trim().toUpperCase().replace(/[^A-Z0-9]/gi, '').slice(0, 6);
  }

  // Check if captainIGN has a tag like "VLX・Predator", "VLX | Predator", "[VLX] Predator"
  if (captainIGN) {
    const bracketMatch = captainIGN.match(/^\[([A-Za-z0-9]{2,6})\]/);
    if (bracketMatch) return bracketMatch[1].toUpperCase();

    const sepMatch = captainIGN.match(/^([A-Za-z0-9]{2,6})\s*[・|•\-_:]\s*/);
    if (sepMatch) return sepMatch[1].toUpperCase();
  }

  // Explicit override: Staff roles receive uniform tags
  const upper = teamName.trim().toUpperCase();
  if (upper === 'NL CORE' || upper.includes('NL CORE')) return 'NLC';
  if (upper === 'NL APEX' || upper.includes('NL APEX')) return 'NLA';
  if (upper === 'NL PRIME' || upper.includes('NL PRIME')) return 'NLP';
  if (upper === 'STAFF' || upper.endsWith('STAFF') || upper.includes('STAFF')) {
    return 'STF';
  }

  // Derive acronym or short tag from teamName
  const words = teamName.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    return words.map((w) => w[0]).join('').toUpperCase().slice(0, 5);
  } else if (words.length === 1) {
    const single = words[0].toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (single.length <= 4) return single;
    return single.slice(0, 3);
  }

  return 'NDL';
}

/**
 * Extract clean player name without redundant tag or separators
 */
export function extractCleanPlayerName(rawName: string, tag: string): string {
  let name = (rawName || '').trim();
  // Strip out brackets [TAG] or (TAG)
  name = name.replace(new RegExp(`^\\[${tag}\\]\\s*`, 'i'), '');
  name = name.replace(new RegExp(`^\\(${tag}\\)\\s*`, 'i'), '');
  // Strip out "TAG | ", "TAG・", "TAG•", etc.
  name = name.replace(new RegExp(`^${tag}\\s*[|・•\\-_:]\\s*`, 'i'), '');
  // Strip any other prefix like "ABC | "
  name = name.replace(/^[A-Za-z0-9]{2,6}\s*[|・•\\-_:]\s*/, '');
  return name.trim() || rawName.trim();
}

/**
 * 1. Open the Discord Registration Modal (if triggered via Discord)
 */
export async function openTeamRegistrationModal(interaction: ButtonInteraction): Promise<void> {
  if (interaction.guildId !== GUILD_ID) return;
  const modal = new ModalBuilder()
    .setCustomId('ndl_team_reg_modal')
    .setTitle('🏆 Squad & Team Registration');

  const teamInput = new TextInputBuilder()
    .setCustomId('team_name')
    .setLabel('Squad / Clan Name')
    .setPlaceholder('e.g. Velocity Esports / NDL Phoenix')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(64);

  const captainInput = new TextInputBuilder()
    .setCustomId('captain_ign')
    .setLabel('Team Captain IGN')
    .setPlaceholder('e.g. VLX・Predator')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(64);

  const gameInput = new TextInputBuilder()
    .setCustomId('game_title')
    .setLabel('Game / Tournament Title')
    .setPlaceholder('e.g. BGMI Squad / Valorant / PUBG')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(64);

  const rosterInput = new TextInputBuilder()
    .setCustomId('roster')
    .setLabel('4-5 Players (IGNs & Game IDs)')
    .setPlaceholder('P1: Name (ID)\nP2: Name (ID)\nP3: Name (ID)\nP4: Name (ID)')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(500);

  const contactInput = new TextInputBuilder()
    .setCustomId('contact')
    .setLabel('Captain Discord / Contact')
    .setPlaceholder('e.g. Discord username or phone')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(100);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(teamInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(captainInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(gameInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(rosterInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(contactInput)
  );

  await interaction.showModal(modal);
}

/**
 * 2. Handle Discord Modal Submit
 */
export async function handleTeamRegModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  if (interaction.guildId !== GUILD_ID) return;
  await interaction.deferReply({ ephemeral: true });

  const teamName = interaction.fields.getTextInputValue('team_name').trim();
  const captainIGN = interaction.fields.getTextInputValue('captain_ign').trim();
  const game = interaction.fields.getTextInputValue('game_title').trim();
  const roster = interaction.fields.getTextInputValue('roster').trim();
  const contact = interaction.fields.getTextInputValue('contact')?.trim() || '';

  const regId = `NDL-${Date.now().toString(36).toUpperCase()}`;

  // Store in database
  await db.query(
    `INSERT INTO tournament_registrations 
     (id, guild_id, team_name, captain_ign, captain_discord, event_title, game, roster, contact, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING')`,
    [regId, interaction.guildId || GUILD_ID, teamName, captainIGN, interaction.user.tag, game, game, roster, contact]
  );

  // Send Staff Review Card
  const client = interaction.client;
  await dispatchStaffReviewCard(client, {
    regId,
    teamName,
    captainIGN,
    captainDiscord: interaction.user.tag,
    captainUserId: interaction.user.id,
    game,
    roster,
    contact,
    source: 'Discord Client',
  });

  // User Confirmation
  const confirmEmbed = new EmbedBuilder()
    .setColor('#10B981')
    .setTitle('✅ Team Registration Submitted!')
    .setDescription(
      `Thank you, <@${interaction.user.id}>! Your squad **${teamName}** has been submitted for verification.\n\n` +
      `• **Registration ID:** \`${regId}\`\n` +
      `• **Game:** ${game}\n` +
      `• **Captain:** ${captainIGN}\n\n` +
      `*Our tournament administration team will review your roster shortly. Once approved, your dedicated team role and private channels will be created automatically.*`
    )
    .setFooter({ text: 'NAADAN LEGACY ESPORTS • Powered by SRB NEXUS' })
    .setTimestamp();

  await interaction.editReply({ embeds: [confirmEmbed] });
}

/**
 * 3. Dispatch Staff Review Card (used by both Discord Modal and Website API)
 */
export async function dispatchStaffReviewCard(
  client: Client,
  data: {
    regId: string;
    teamName: string;
    captainIGN: string;
    captainDiscord: string;
    captainUserId?: string;
    game: string;
    roster: string;
    contact?: string;
    source: string;
  }
): Promise<void> {
  const guild = client.guilds.cache.get(GUILD_ID) || (await client.guilds.fetch(GUILD_ID).catch(() => null));
  if (!guild) return;

  const reviewChannel = guild.channels.cache.get(STAFF_REVIEW_CHANNEL_ID) as TextChannel;
  if (!reviewChannel || !reviewChannel.isTextBased()) {
    logger.error('[TEAM-REG] Staff review channel not found');
    return;
  }

  const captainDisplay = data.captainUserId
    ? `<@${data.captainUserId}> (\`${data.captainDiscord}\`)`
    : `\`${data.captainDiscord}\``;

  const embed = new EmbedBuilder()
    .setColor('#F59E0B')
    .setAuthor({
      name: 'NAADAN LEGACY ESPORTS • Squad Review Queue',
      iconURL: guild.iconURL() || undefined,
    })
    .setTitle(`🛡️ New Squad Registration: ${data.teamName}`)
    .setDescription(
      `A new competitive squad has registered via **${data.source}**.\nReview the roster below and choose an action.`
    )
    .addFields(
      { name: '🏆 Squad Name', value: `**${data.teamName}**`, inline: true },
      { name: '🎮 Game', value: data.game || 'Tournament', inline: true },
      { name: '🆔 Reg ID', value: `\`${data.regId}\``, inline: true },
      { name: '👑 Captain IGN', value: data.captainIGN, inline: true },
      { name: '💬 Discord', value: captainDisplay, inline: true },
      { name: '📞 Contact', value: data.contact || 'N/A', inline: true },
      { name: '📋 Roster (Players & IDs)', value: `\`\`\`\n${data.roster.slice(0, 1000)}\n\`\`\``, inline: false }
    )
    .setFooter({ text: 'Click Approve to automatically provision Role, VC, and Text Channel.' })
    .setTimestamp();

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`team_approve_${data.regId}`)
      .setLabel('Approve Team ✅')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`team_reject_${data.regId}`)
      .setLabel('Reject ❌')
      .setStyle(ButtonStyle.Danger)
  );

  await reviewChannel.send({ embeds: [embed], components: [actionRow] });
}

/**
 * 4. Core Automated Provisioning Service
 * Callable via Staff Discord Buttons, Admin Website API, or Supabase Webhook!
 */
export async function provisionTeamDiscordSpace(
  client: Client,
  data: {
    teamName: string;
    teamTag?: string;
    captainDiscord?: string;
    captainIGN?: string;
    game?: string;
    roster?: string;
    approvedBy?: string;
    regId?: string;
  }
): Promise<{
  success: boolean;
  teamRole?: { id: string; name: string };
  textChannel?: { id: string; name: string };
  voiceChannel?: { id: string; name: string };
  captainFound?: boolean;
  error?: string;
}> {
  const guild = client.guilds.cache.get(GUILD_ID) || (await client.guilds.fetch(GUILD_ID).catch(() => null));
  if (!guild) {
    logger.error(`[TEAM-REG] Guild ${GUILD_ID} not found.`);
    return { success: false, error: 'Discord Guild not found' };
  }

  const teamName = data.teamName.trim();
  const slug = slugify(teamName);

  try {
    // A. Create or Find Team Role with Distinct Vivid Color
    let teamRole = guild.roles.cache.find(
      (r) =>
        r.name.toLowerCase() === `team ${teamName}`.toLowerCase() ||
        r.name.toLowerCase() === teamName.toLowerCase()
    );

    const distinctColor = getDistinctTeamColor(guild, teamName);

    if (!teamRole) {
      teamRole = await guild.roles.create({
        name: `Team ${teamName}`,
        color: distinctColor as any,
        hoist: true, // Display separately in sidebar
        mentionable: true,
        reason: `Tournament Team Approval for ${teamName} (${data.approvedBy || 'Admin'})`,
      });
      logger.info(`[TEAM-REG] Created role ${teamRole.name} with color ${distinctColor} (${teamRole.id})`);
    }

    // Ensure distinct color, hoist=true, and position above @Community
    await styleAndHoistTeamRole(teamRole, guild);

    const teamTag = extractTeamTag(teamName, data.teamTag, data.captainIGN);

    // B. Assign role to captain & Auto-set Nickname: TAG | NAME
    let captainMember = null;
    let captainFound = false;
    const allMembers = await guild.members.fetch().catch(() => guild.members.cache);

    if (data.captainDiscord) {
      const cleanTag = data.captainDiscord.toLowerCase().replace(/^@/, '').trim();
      captainMember = allMembers.find(
        (m) =>
          m.user.tag.toLowerCase() === cleanTag ||
          m.user.username.toLowerCase() === cleanTag ||
          (m.user.globalName && m.user.globalName.toLowerCase() === cleanTag) ||
          m.id === cleanTag
      );

      if (captainMember) {
        captainFound = true;
        await captainMember.roles.add(teamRole).catch(() => {});
        // Also grant @registered
        const regRole = guild.roles.cache.get(REGISTERED_ROLE_ID);
        if (regRole) await captainMember.roles.add(regRole).catch(() => {});
        // Also grant @👑 TEAM LEADER
        const leaderRole =
          guild.roles.cache.get(TEAM_LEADER_ROLE_ID) ||
          guild.roles.cache.find((r) => r.name.toLowerCase().includes('team leader') || r.name.toLowerCase().includes('captain'));
        if (leaderRole) await captainMember.roles.add(leaderRole).catch(() => {});
        logger.info(`[TEAM-REG] Assigned roles (Team, Registered, Team Leader) to captain ${captainMember.user.tag}`);

        // Set captain nickname to: TAG | NAME
        const cleanPlayerName = extractCleanPlayerName(
          data.captainIGN || captainMember.displayName || captainMember.user.username,
          teamTag
        );
        const newNickname = `${teamTag} | ${cleanPlayerName}`.slice(0, 32);

        // Record original nickname
        const currentNick = captainMember.nickname || captainMember.user.globalName || captainMember.user.username;
        const originalNickname =
          !currentNick.includes('|') && !currentNick.includes('・')
            ? currentNick
            : captainMember.user.globalName || captainMember.user.username;

        if (data.regId) {
          await db
            .query(
              `UPDATE tournament_registrations 
               SET team_tag = $1, captain_user_id = $2, original_nickname = $3 
               WHERE id = $4`,
              [teamTag, captainMember.id, originalNickname, data.regId]
            )
            .catch(() => {});
        }

        if (TEAM_NICKNAME_AUTO_CHANGE_ENABLED && captainMember.id !== guild.ownerId) {
          try {
            await captainMember.setNickname(newNickname, `Tournament squad approval: ${newNickname}`);
            logger.info(`[TEAM-REG] Updated captain nickname: ${captainMember.user.tag} -> "${newNickname}"`);
          } catch (nickErr: any) {
            logger.warn({ err: nickErr.message }, `[TEAM-REG] Failed setting nickname "${newNickname}" on ${captainMember.user.tag}`);
          }
        } else if (TEAM_NICKNAME_AUTO_CHANGE_ENABLED) {
          logger.info(`[TEAM-REG] Skipped nickname change for Server Owner ${captainMember.user.tag}`);
        }
      }
    }

    // B2. Scan roster for full team members on Discord & Auto-set Nicknames: TAG | NAME
    if (data.roster) {
      const rosterStr = typeof data.roster === 'string' ? data.roster : JSON.stringify(data.roster);
      const idMatches = rosterStr.match(/\b\d{17,20}\b/g) || [];

      for (const rawId of idMatches) {
        if (captainMember && rawId === captainMember.id) continue;
        const tm = allMembers.get(rawId);
        if (tm) {
          await tm.roles.add(teamRole).catch(() => {});
          const regRole = guild.roles.cache.get(REGISTERED_ROLE_ID);
          if (regRole) await tm.roles.add(regRole).catch(() => {});

          if (TEAM_NICKNAME_AUTO_CHANGE_ENABLED && tm.id !== guild.ownerId) {
            const cleanTmName = extractCleanPlayerName(tm.displayName || tm.user.username, teamTag);
            const tmNick = `${teamTag} | ${cleanTmName}`.slice(0, 32);
            await tm.setNickname(tmNick, `Tournament squad teammate approval: ${tmNick}`).catch(() => {});
            logger.info(`[TEAM-REG] Auto-updated teammate nickname: ${tm.user.tag} -> "${tmNick}"`);
          }
        }
      }
    }

    // C. Create or Find Dedicated Team Category
    const categoryName = `【🛡️】TEAM ${teamName.toUpperCase()}`.slice(0, 100);
    let category = guild.channels.cache.find(
      (c) =>
        c.type === ChannelType.GuildCategory &&
        (c.name.toLowerCase() === categoryName.toLowerCase() ||
          c.name.toLowerCase() === `【🛡️】${teamName.toLowerCase()}` ||
          c.name.toLowerCase() === `team ${teamName.toLowerCase()}`)
    ) as any;

    if (!category) {
      category = await guild.channels.create({
        name: categoryName,
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: teamRole.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.Connect,
              PermissionFlagsBits.Speak,
              PermissionFlagsBits.Stream,
            ],
          },
          {
            id: guild.members.me?.id || clientAppId(guild),
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.ManageRoles,
            ],
          },
        ],
      });
      logger.info(`[TEAM-REG] Created dedicated team category ${category.name} (${category.id})`);
    }

    const categoryId = category ? category.id : undefined;

    // D. Create or Find Private Text Channel
    const isNewTextChannel = !guild.channels.cache.some(
      (c) =>
        (c.parentId === categoryId || c.parentId === TEAM_ZONE_CATEGORY_ID) &&
        (c.name === `💬・${slug}` || c.name === slug)
    );

    let textChannel = guild.channels.cache.find(
      (c) =>
        (c.parentId === categoryId || c.parentId === TEAM_ZONE_CATEGORY_ID) &&
        (c.name === `💬・${slug}` || c.name === slug)
    ) as TextChannel;

    if (!textChannel) {
      textChannel = await guild.channels.create({
        name: `💬・${slug}`,
        type: ChannelType.GuildText,
        parent: categoryId,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
          },
          {
            id: teamRole.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          },
          {
            id: guild.members.me?.id || clientAppId(guild),
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ManageChannels,
            ],
          },
        ],
      });
    } else if (textChannel.parentId !== categoryId && categoryId) {
      await (textChannel as any).setParent(categoryId, { lockPermissions: false }).catch(() => {});
    }

    // E. Create or Find Private Voice Channel
    let voiceChannel = guild.channels.cache.find(
      (c) =>
        (c.parentId === categoryId || c.parentId === TEAM_ZONE_CATEGORY_ID) &&
        (c.name === `🔊・${slug}` || c.name === slug)
    );

    if (!voiceChannel) {
      voiceChannel = await guild.channels.create({
        name: `🔊・${slug}`,
        type: ChannelType.GuildVoice,
        parent: categoryId,
        userLimit: 6,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
          },
          {
            id: teamRole.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.Connect,
              PermissionFlagsBits.Speak,
              PermissionFlagsBits.Stream,
            ],
          },
          {
            id: STAFF_TEAM_ROLE_ID,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.Connect,
              PermissionFlagsBits.Speak,
              PermissionFlagsBits.Stream,
              PermissionFlagsBits.UseVAD,
            ],
          },
          {
            id: guild.members.me?.id || clientAppId(guild),
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.Connect,
              PermissionFlagsBits.ManageChannels,
            ],
          },
        ],
      });
    } else if (voiceChannel.parentId !== categoryId && categoryId) {
      await (voiceChannel as any).setParent(categoryId, { lockPermissions: false }).catch(() => {});
    }

    // Send Team Welcome Announcement in Text Channel if new
    if (isNewTextChannel) {
      const teamWelcomeEmbed = new EmbedBuilder()
        .setColor('#EAB308')
        .setTitle(`🏆 Welcome, ${teamName}!`)
        .setDescription(
          `Congratulations! Your squad registration for **${data.game || 'Tournament'}** has been officially **APPROVED**.\n\n` +
          `• **Squad Role:** <@&${teamRole.id}>\n` +
          `• **Text Channel:** <#${textChannel.id}>\n` +
          `• **Voice Room:** <#${voiceChannel.id}>\n` +
          (captainMember ? `• **Team Leader:** <@${captainMember.id}> (<@&${TEAM_LEADER_ROLE_ID}>)\n\n` : `\n`) +
          `Use this private channel and voice room for your scrims, team comms, and tournament updates. Room credentials and match schedules will be dispatched here!`
        )
        .setFooter({ text: 'NAADAN LEGACY ESPORTS • Powered by SRB NEXUS' })
        .setTimestamp();

      await textChannel.send({
        content: captainMember ? `<@${captainMember.id}>` : undefined,
        embeds: [teamWelcomeEmbed],
      });
    }

    // F. Notify Staff Channel (#📋・ᴛᴇᴀᴍ-ʀᴇɢɪꜱᴛʀᴀᴛɪᴏɴꜱ)
    const reviewChannel = guild.channels.cache.get(STAFF_REVIEW_CHANNEL_ID) as TextChannel;
    if (reviewChannel && reviewChannel.isTextBased()) {
      const staffLogEmbed = new EmbedBuilder()
        .setColor('#10B981')
        .setTitle(`⚡ Squad Auto-Provisioned: ${teamName}`)
        .setDescription(`A team has been approved via **${data.approvedBy || 'Admin Portal'}** and provisioned in Discord.`)
        .addFields(
          { name: '🏆 Squad Name', value: teamName, inline: true },
          { name: '🎮 Game', value: data.game || 'Valorant', inline: true },
          { name: '⚡ Role', value: `<@&${teamRole.id}>`, inline: true },
          { name: '💬 Channel', value: `<#${textChannel.id}>`, inline: true },
          { name: '🔊 VC', value: `<#${voiceChannel.id}>`, inline: true },
          {
            name: '👑 Captain',
            value: captainMember
              ? `<@${captainMember.id}> (${data.captainIGN || ''})`
              : `\`${data.captainDiscord || 'N/A'}\` *(Not yet on server)*`,
            inline: true,
          }
        )
        .setTimestamp();

      await reviewChannel.send({ embeds: [staffLogEmbed] });
    }

    return {
      success: true,
      teamRole: { id: teamRole.id, name: teamRole.name },
      textChannel: { id: textChannel.id, name: textChannel.name },
      voiceChannel: { id: voiceChannel.id, name: voiceChannel.name },
      captainFound,
    };
  } catch (err: any) {
    logger.error({ err }, `[TEAM-REG] Failed provisioning team ${teamName}`);
    return { success: false, error: err.message };
  }
}

/**
 * 5. Handle Staff Button Approval in Discord
 */
export async function handleTeamApproval(interaction: ButtonInteraction, regId: string): Promise<void> {
  const guild = interaction.guild;
  if (!guild || guild.id !== GUILD_ID) return;

  // Check Staff Permission
  const member = interaction.member as any;
  const isStaff =
    member?.permissions?.has(PermissionFlagsBits.ManageChannels) ||
    member?.roles?.cache?.some((r: any) =>
      ['staff', 'administrator', 'management', 'admin'].some((roleName) =>
        r.name.toLowerCase().includes(roleName)
      )
    );

  if (!isStaff) {
    await interaction.reply({ content: '❌ Only staff and tournament administrators can approve team registrations.', ephemeral: true });
    return;
  }

  await interaction.deferUpdate();

  // Query DB
  const res = await db.query('SELECT * FROM tournament_registrations WHERE id = $1', [regId]);
  const reg = res.rows[0];

  if (!reg) {
    await interaction.followUp({ content: '❌ Registration record not found in database.', ephemeral: true });
    return;
  }

  if (reg.status === 'APPROVED') {
    await interaction.followUp({ content: '⚠️ This team has already been approved.', ephemeral: true });
    return;
  }

  const result = await provisionTeamDiscordSpace(interaction.client, {
    teamName: reg.team_name,
    captainDiscord: reg.captain_discord,
    captainIGN: reg.captain_ign,
    game: reg.game,
    roster: reg.roster,
    approvedBy: interaction.user.tag,
    regId,
  });

  if (!result.success) {
    await interaction.followUp({ content: `❌ Error while provisioning channels/roles: ${result.error}`, ephemeral: true });
    return;
  }

  // Update Database
  await db.query(
    `UPDATE tournament_registrations 
     SET status = 'APPROVED',
         approved_by = $1,
         role_id = $2,
         text_channel_id = $3,
         voice_channel_id = $4,
         updated_at = NOW()
     WHERE id = $5`,
    [interaction.user.id, result.teamRole?.id, result.textChannel?.id, result.voiceChannel?.id, regId]
  );

  // Update Staff Review Embed
  const originalEmbed = interaction.message.embeds[0];
  const updatedEmbed = EmbedBuilder.from(originalEmbed)
    .setColor('#10B981')
    .setTitle(`✅ Squad APPROVED: ${reg.team_name}`)
    .addFields(
      { name: '⚡ Provisioned Role', value: `<@&${result.teamRole?.id}>`, inline: true },
      { name: '💬 Team Text Channel', value: `<#${result.textChannel?.id}>`, inline: true },
      { name: '🔊 Team VC', value: `<#${result.voiceChannel?.id}>`, inline: true },
      { name: '👤 Approved By', value: `<@${interaction.user.id}>`, inline: true }
    );

  await interaction.editReply({
    embeds: [updatedEmbed],
    components: [], // remove buttons
  });

  logger.info(`[TEAM-REG] Approved team ${reg.team_name} (${regId}) by ${interaction.user.tag}`);
}

/**
 * 6. Handle Staff Button Rejection in Discord
 */
export async function handleTeamRejection(interaction: ButtonInteraction, regId: string): Promise<void> {
  if (interaction.guildId !== GUILD_ID) return;
  const member = interaction.member as any;
  const isStaff =
    member?.permissions?.has(PermissionFlagsBits.ManageChannels) ||
    member?.roles?.cache?.some((r: any) =>
      ['staff', 'administrator', 'management', 'admin'].some((roleName) =>
        r.name.toLowerCase().includes(roleName)
      )
    );

  if (!isStaff) {
    await interaction.reply({ content: '❌ Only staff can reject team registrations.', ephemeral: true });
    return;
  }

  await interaction.deferUpdate();

  await db.query(
    `UPDATE tournament_registrations 
     SET status = 'REJECTED', approved_by = $1, updated_at = NOW() 
     WHERE id = $2`,
    [interaction.user.id, regId]
  );

  const originalEmbed = interaction.message.embeds[0];
  const updatedEmbed = EmbedBuilder.from(originalEmbed)
    .setColor('#EF4444')
    .setTitle(`❌ Squad REJECTED`)
    .addFields({ name: '👤 Rejected By', value: `<@${interaction.user.id}>`, inline: true });

  await interaction.editReply({
    embeds: [updatedEmbed],
    components: [],
  });

  logger.info(`[TEAM-REG] Rejected team reg ${regId} by ${interaction.user.tag}`);
}

/**
 * 7. Deprovision, Disqualify or Delete Team
 * Automatically removes roles, resets nicknames, deletes team channels, and notifies staff!
 */
export async function deprovisionOrDisqualifyTeam(
  client: Client,
  data: {
    regId?: string;
    teamName?: string;
    teamTag?: string;
    roleId?: string;
    action: 'DISQUALIFIED' | 'DELETED';
    reason?: string;
    executedBy?: string;
  }
): Promise<{
  success: boolean;
  message: string;
  affectedMembers: number;
  channelsDeleted: number;
  error?: string;
}> {
  const guild = client.guilds.cache.get(GUILD_ID) || (await client.guilds.fetch(GUILD_ID).catch(() => null));
  if (!guild) {
    return { success: false, message: 'Guild not found', affectedMembers: 0, channelsDeleted: 0, error: 'Guild not found' };
  }

  try {
    // 1. Fetch registration if regId provided
    let reg: any = null;
    if (data.regId) {
      const res = await db.query('SELECT * FROM tournament_registrations WHERE id = $1', [data.regId]).catch(() => ({ rows: [] }));
      reg = res.rows[0];
    } else if (data.teamName) {
      const res = await db.query(
        'SELECT * FROM tournament_registrations WHERE LOWER(team_name) = LOWER($1) ORDER BY created_at DESC LIMIT 1',
        [data.teamName]
      ).catch(() => ({ rows: [] }));
      reg = res.rows[0];
    }

    const teamName = reg?.team_name || data.teamName || '';
    const teamTag = data.teamTag || reg?.team_tag || (teamName ? extractTeamTag(teamName) : '');
    const roleId = reg?.role_id || data.roleId;
    const slug = slugify(teamName);
    const normTeam = normalizeDiscordName(teamName);
    const normTag = normalizeDiscordName(teamTag);

    // 2. Find Team Role (check roleId, exact name, tag, normalized name, or channel permissions)
    let teamRole = roleId ? guild.roles.cache.get(roleId) : null;
    if (!teamRole && (teamName || teamTag)) {
      teamRole =
        guild.roles.cache.find((r) => {
          const rName = r.name.toLowerCase();
          const rNorm = normalizeDiscordName(r.name);
          return (
            (teamName && (rName === teamName.toLowerCase() || rName === `team ${teamName.toLowerCase()}`)) ||
            (teamTag && (rName === teamTag.toLowerCase() || rName === `team ${teamTag.toLowerCase()}`)) ||
            (normTeam && (rNorm === normTeam || rNorm === `team${normTeam}`)) ||
            (normTag && (rNorm === normTag || rNorm === `team${normTag}`))
          );
        }) || null;
    }

    let affectedCount = 0;
    const allMembers = await guild.members.fetch().catch(() => guild.members.cache);

    // 3. Collect all squad members: either having teamRole or being the captain
    const membersToReset = new Set<any>();

    if (teamRole) {
      teamRole.members.forEach((m) => membersToReset.add(m));
    }

    if (reg?.captain_user_id) {
      const capt = allMembers.get(reg.captain_user_id);
      if (capt) membersToReset.add(capt);
    } else if (reg?.captain_discord) {
      const cleanTag = reg.captain_discord.toLowerCase().replace(/^@/, '').trim();
      const capt = allMembers.find(
        (m) =>
          m.user.tag.toLowerCase() === cleanTag ||
          m.user.username.toLowerCase() === cleanTag ||
          m.id === cleanTag
      );
      if (capt) membersToReset.add(capt);
    }

    // 4. Remove Roles & Reset Nicknames
    for (const member of membersToReset) {
      try {
        // Remove team role
        if (teamRole && member.roles.cache.has(teamRole.id)) {
          await member.roles.remove(teamRole, `Team ${data.action}: Removed team role`).catch(() => {});
        }

        // Remove TEAM LEADER role
        if (member.roles.cache.has(TEAM_LEADER_ROLE_ID)) {
          await member.roles.remove(TEAM_LEADER_ROLE_ID, `Team ${data.action}: Removed team leader role`).catch(() => {});
        }

        // Remove @registered role
        if (member.roles.cache.has(REGISTERED_ROLE_ID)) {
          await member.roles.remove(REGISTERED_ROLE_ID, `Team ${data.action}: Removed registered role`).catch(() => {});
        }

        // Reset Nickname
        if (TEAM_NICKNAME_AUTO_CHANGE_ENABLED && member.id !== guild.ownerId) {
          const currentNick = member.nickname || '';
          if (currentNick.includes('|')) {
            const restoredNick = reg?.original_nickname || currentNick.split('|').slice(1).join('|').trim();
            await member.setNickname(restoredNick && restoredNick.length > 0 ? restoredNick : null, `Team ${data.action}: Resetting tag`).catch(() => {});
            logger.info(`[TEAM-REG] Reset nickname for ${member.user.tag} -> ${restoredNick || 'Default'}`);
          }
        }
        affectedCount++;
      } catch (mErr: any) {
        logger.warn({ err: mErr.message }, `[TEAM-REG] Error resetting member ${member.user?.tag}`);
      }
    }

    // 5. Delete Channels & Dedicated Team Category
    let channelsDeleted = 0;
    const textChannelId = reg?.text_channel_id;
    const voiceChannelId = reg?.voice_channel_id;

    let parentCategory: any = null;

    if (textChannelId) {
      const ch = guild.channels.cache.get(textChannelId);
      if (ch) {
        if (ch.parent && ch.parent.type === ChannelType.GuildCategory && ch.parent.id !== TEAM_ZONE_CATEGORY_ID) {
          parentCategory = ch.parent;
        }
        await ch.delete(`Tournament Team ${data.action} by ${data.executedBy || 'Admin'}`).catch(() => {});
        channelsDeleted++;
      }
    } else {
      const textChannels = guild.channels.cache.filter((c: any) => {
        if (c.type !== ChannelType.GuildText) return false;
        const cNorm = normalizeDiscordName(c.name);
        return (
          (normTeam && (cNorm === normTeam || cNorm === `team${normTeam}` || cNorm.includes(normTeam))) ||
          (normTag && (cNorm === normTag || cNorm === `team${normTag}` || cNorm.includes(normTag))) ||
          c.name === `💬・${slug}` ||
          c.name === slug
        );
      });
      for (const [, ch] of textChannels) {
        if (ch.parent && ch.parent.type === ChannelType.GuildCategory && ch.parent.id !== TEAM_ZONE_CATEGORY_ID) {
          parentCategory = ch.parent;
        }
        await ch.delete(`Tournament Team ${data.action}`).catch(() => {});
        channelsDeleted++;
      }
    }

    if (voiceChannelId) {
      const vc = guild.channels.cache.get(voiceChannelId);
      if (vc) {
        if (!parentCategory && vc.parent && vc.parent.type === ChannelType.GuildCategory && vc.parent.id !== TEAM_ZONE_CATEGORY_ID) {
          parentCategory = vc.parent;
        }
        await vc.delete(`Tournament Team ${data.action} by ${data.executedBy || 'Admin'}`).catch(() => {});
        channelsDeleted++;
      }
    } else {
      const voiceChannels = guild.channels.cache.filter((c: any) => {
        if (c.type !== ChannelType.GuildVoice) return false;
        const cNorm = normalizeDiscordName(c.name);
        return (
          (normTeam && (cNorm === normTeam || cNorm === `team${normTeam}` || cNorm.includes(normTeam))) ||
          (normTag && (cNorm === normTag || cNorm === `team${normTag}` || cNorm.includes(normTag))) ||
          c.name === `🔊・${slug}` ||
          c.name === slug
        );
      });
      for (const [, vc] of voiceChannels) {
        if (!parentCategory && vc.parent && vc.parent.type === ChannelType.GuildCategory && vc.parent.id !== TEAM_ZONE_CATEGORY_ID) {
          parentCategory = vc.parent;
        }
        await vc.delete(`Tournament Team ${data.action}`).catch(() => {});
        channelsDeleted++;
      }
    }

    // Find and delete team category
    if (!parentCategory) {
      parentCategory = guild.channels.cache.find((c: any) => {
        if (c.type !== ChannelType.GuildCategory) return false;
        const cNorm = normalizeDiscordName(c.name);
        return (
          (normTeam && (cNorm === normTeam || cNorm === `team${normTeam}` || cNorm.includes(normTeam))) ||
          (normTag && (cNorm === normTag || cNorm === `team${normTag}` || cNorm.includes(normTag)))
        );
      });
    }

    // Fallback: If teamRole still not found, check category permission overwrites
    if (!teamRole && parentCategory) {
      for (const [id] of parentCategory.permissionOverwrites?.cache || []) {
        if (id !== guild.id && id !== client.user?.id) {
          const r = guild.roles.cache.get(id);
          if (r && isTeamRole(r, guild)) {
            teamRole = r;
            break;
          }
        }
      }
    }

    if (parentCategory && parentCategory.id !== TEAM_ZONE_CATEGORY_ID) {
      await parentCategory.delete(`Tournament Team ${data.action} by ${data.executedBy || 'Admin'}`).catch(() => {});
      logger.info(`[TEAM-REG] Deleted team category: ${parentCategory.name} (${parentCategory.id})`);
    }

    // 6. Delete Team Role
    if (teamRole) {
      await teamRole.delete(`Tournament Team ${data.action} by ${data.executedBy || 'Admin'}`).catch(() => {});
      logger.info(`[TEAM-REG] Deleted team role: ${teamRole.name} (${teamRole.id})`);
    }

    // 7. Update Database status
    try {
      if (reg) {
        await db.query(
          `UPDATE tournament_registrations SET status = $1, updated_at = NOW() WHERE id = $2`,
          [data.action, reg.id]
        );
      } else if (data.teamName) {
        await db.query(
          `UPDATE tournament_registrations SET status = $1, updated_at = NOW() WHERE LOWER(team_name) = LOWER($2)`,
          [data.action, data.teamName]
        );
      }
    } catch (dbErr: any) {
      logger.warn({ err: dbErr.message }, '[TEAM-REG] Database update skipped or failed');
    }

    // 8. Send Staff Alert in #📋・ᴛᴇᴀᴍ-ʀᴇɢɪꜱᴛʀᴀᴛɪᴏɴꜱ
    const staffChannel = guild.channels.cache.get(STAFF_REVIEW_CHANNEL_ID) as TextChannel;
    if (staffChannel && staffChannel.isTextBased()) {
      const actionColor = data.action === 'DISQUALIFIED' ? '#DC2626' : '#6B7280';
      const actionIcon = data.action === 'DISQUALIFIED' ? '🚫' : '🗑️';

      const alertEmbed = new EmbedBuilder()
        .setColor(actionColor)
        .setTitle(`${actionIcon} Squad ${data.action}: ${teamName}`)
        .setDescription(
          `Team **${teamName}** has been **${data.action.toLowerCase()}**.\n` +
          `• **Roles Removed:** Team Role & \`👑 TEAM LEADER\` revoked from ${affectedCount} member(s).\n` +
          `• **Nicknames Reset:** Player tag removed; nicknames restored to original.\n` +
          `• **Channels Cleaned:** ${channelsDeleted} channel(s) deleted.\n` +
          `• **Executed By:** ${data.executedBy || 'Admin Portal'}` +
          (data.reason ? `\n• **Reason:** ${data.reason}` : '')
        )
        .setTimestamp();

      await staffChannel.send({ embeds: [alertEmbed] }).catch(() => {});
    }

    return {
      success: true,
      message: `Squad ${teamName} successfully ${data.action.toLowerCase()}. ${affectedCount} members reset, ${channelsDeleted} channels cleaned.`,
      affectedMembers: affectedCount,
      channelsDeleted,
    };
  } catch (err: any) {
    logger.error({ err }, `[TEAM-REG] Error in deprovisionOrDisqualifyTeam for ${data.teamName || data.regId}`);
    return { success: false, message: err.message, affectedMembers: 0, channelsDeleted: 0, error: err.message };
  }
}

export function isDedicatedTeamChannel(ch: any): boolean {
  if (!ch) return false;
  if (ch.name?.startsWith('【🛡️】') || ch.parent?.name?.startsWith('【🛡️】')) return true;
  if (ch.parentId === TEAM_ZONE_CATEGORY_ID) return true;
  if (ch.type === ChannelType.GuildCategory && !FIXED_SERVER_CATEGORY_IDS.has(ch.id)) return true;
  if (ch.parentId && !FIXED_SERVER_CATEGORY_IDS.has(ch.parentId)) return true;
  return false;
}

export function isTeamRole(role: any, guild: any): boolean {
  if (!role || role.managed || NON_TEAM_ROLE_IDS.has(role.id)) return false;
  if (role.name.toLowerCase().startsWith('team ')) return true;
  if (
    role.permissions?.has(PermissionFlagsBits.Administrator) ||
    role.permissions?.has(PermissionFlagsBits.ManageGuild) ||
    role.permissions?.has(PermissionFlagsBits.ManageChannels)
  ) {
    return false;
  }
  // Check if role has explicit overwrites in dedicated team categories/channels (including website-created ones)
  return guild.channels.cache.some(
    (c: any) =>
      isDedicatedTeamChannel(c) &&
      c.permissionOverwrites?.cache?.has(role.id)
  );
}

/**
 * Shared helper to format and apply "TAG | Name" nickname for a team role member.
 */
export async function applyTeamNicknameToMember(member: any, teamRole: any): Promise<boolean> {
  if (!TEAM_NICKNAME_AUTO_CHANGE_ENABLED) return false;
  const guild = member?.guild;
  if (!guild || guild.id !== GUILD_ID || !teamRole) return false;
  if (member.id === guild.ownerId || !member.manageable) return false;

  const currentNick = member.nickname || '';
  if (PROTECTED_STAFF_TAG_RE.test(currentNick)) return false;

  const teamName = teamRole.name.replace(/^team\s+/i, '').trim();
  const tag = extractTeamTag(teamName);
  const cleanPlayerName = extractCleanPlayerName(member.displayName || member.user.username, tag);
  const formattedNick = `${tag} | ${cleanPlayerName}`.slice(0, 32);

  if (currentNick.startsWith(`${tag} |`)) return false;

  try {
    await member.setNickname(formattedNick, `Tournament squad role assigned: ${formattedNick}`);
    logger.info(`[TEAM-REG] Auto-updated teammate nickname: ${member.user.tag} -> "${formattedNick}"`);
    return true;
  } catch (err: any) {
    logger.warn({ err: err.message }, `[TEAM-REG] Failed auto-updating teammate nickname for ${member.user.tag}`);
    return false;
  }
}

/**
 * Grants @STAFF TEAM role ViewChannel + Connect + Speak + Stream on any dedicated team voice channel.
 * Does NOT grant Administrator permission on the role.
 */
export async function grantStaffTeamAccessToTeamVC(channel: any, guild: any): Promise<boolean> {
  if (!channel || !guild || guild.id !== GUILD_ID) return false;
  if (channel.type !== ChannelType.GuildVoice && channel.type !== ChannelType.GuildStageVoice) return false;
  if (!isDedicatedTeamChannel(channel)) return false;
  if (!guild.roles.cache.has(STAFF_TEAM_ROLE_ID)) return false;

  try {
    await channel.permissionOverwrites.edit(STAFF_TEAM_ROLE_ID, {
      ViewChannel: true,
      Connect: true,
      Speak: true,
      Stream: true,
      UseVAD: true,
    });
    logger.info(`[TEAM-REG] Granted @STAFF TEAM access to team VC #${channel.name} (${channel.id})`);
    return true;
  } catch (err: any) {
    logger.warn({ err: err.message }, `[TEAM-REG] Failed granting @STAFF TEAM access on VC #${channel.name}`);
    return false;
  }
}

/**
 * Styles/hoists team roles, grants @STAFF TEAM access to team VCs, and syncs nicknames (if enabled)
 * when a new team category/channel is created.
 */
export async function syncTeamRoleNicknamesFromChannel(channel: any): Promise<void> {
  const guild = channel?.guild;
  if (!guild || guild.id !== GUILD_ID || !isDedicatedTeamChannel(channel)) return;

  await guild.roles.fetch().catch(() => {});

  // Ensure @STAFF TEAM has access if this is a team VC
  await grantStaffTeamAccessToTeamVC(channel, guild);

  const overwrites = channel.permissionOverwrites?.cache;
  if (!overwrites) return;

  for (const [id, ow] of overwrites) {
    if (ow.type !== 0) continue;
    const role = guild.roles.cache.get(id);
    if (!role || !isTeamRole(role, guild)) continue;

    // Always ensure team role is distinctly colored, hoisted separately, and above @Community
    await styleAndHoistTeamRole(role, guild);

    if (TEAM_NICKNAME_AUTO_CHANGE_ENABLED) {
      await guild.members.fetch().catch(() => {});
      for (const member of role.members.values()) {
        await applyTeamNicknameToMember(member, role);
      }
    }
  }
}

/**
 * 8. GuildMemberUpdate listener for team roles
 * Guarantees that ANY squad member assigned a Team role automatically gets:
 * - Nickname formatted as: TAG | NAME
 * And when all team roles are removed:
 * - Nickname reverted back to normal
 * - Team Leader & Registered roles revoked
 */
export async function handleTeamMemberRoleUpdate(oldMember: any, newMember: any): Promise<void> {
  const guild = newMember.guild;
  if (!guild || guild.id !== GUILD_ID) return;

  const oldTeamRoles = oldMember.roles.cache.filter((r: any) => isTeamRole(r, guild));
  const newTeamRoles = newMember.roles.cache.filter((r: any) => isTeamRole(r, guild));

  // Role Added
  if (newTeamRoles.size > oldTeamRoles.size) {
    const addedRole = newTeamRoles.find((r: any) => !oldTeamRoles.has(r.id));
    if (addedRole) {
      await applyTeamNicknameToMember(newMember, addedRole);
    }
  }

  // Role Removed
  if (oldTeamRoles.size > newTeamRoles.size) {
    // If no more team roles remain
    if (newTeamRoles.size === 0) {
      // Remove TEAM LEADER if present
      if (newMember.roles.cache.has(TEAM_LEADER_ROLE_ID)) {
        await newMember.roles.remove(TEAM_LEADER_ROLE_ID, 'Team role removed').catch(() => {});
      }
      // Remove @registered if present
      if (newMember.roles.cache.has(REGISTERED_ROLE_ID)) {
        await newMember.roles.remove(REGISTERED_ROLE_ID, 'Team role removed').catch(() => {});
      }
      // Reset Nickname (remove "TAG | " prefix)
      if (TEAM_NICKNAME_AUTO_CHANGE_ENABLED && newMember.id !== guild.ownerId) {
        const currentNick = newMember.nickname || '';
        if (currentNick.includes('|') && !PROTECTED_STAFF_TAG_RE.test(currentNick)) {
          const clean = currentNick.split('|').slice(1).join('|').trim();
          await newMember.setNickname(clean.length > 0 ? clean : null, 'Team role removed: Resetting nickname').catch(() => {});
          logger.info(`[TEAM-REG] Reset teammate nickname: ${newMember.user.tag} -> "${clean || 'Default'}"`);
        }
      }
    }
  }
}
