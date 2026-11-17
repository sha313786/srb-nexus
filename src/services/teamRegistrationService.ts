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
const STAFF_REVIEW_CHANNEL_ID = '1570853707317379185'; // 📋・ᴛᴇᴀᴍ-ʀᴇɢɪꜱᴛʀᴀᴛɪᴏɴꜱ
const TEAM_ZONE_CATEGORY_ID = '1570853712459604179'; // 🏆 ══════ 𝐓𝐎𝐔𝐑𝐍𝐀𝐌𝐄𝐍𝐓 𝐙𝐎𝐍𝐄 ══════ 🏆
const REGISTERED_ROLE_ID = '1566440573513244682'; // @registered
const TEAM_LEADER_ROLE_ID = '1571071414448955564'; // 👑 TEAM LEADER

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
  '#06B6D4', // Aqua
  '#8B5CF6', // Violet
];

export function getDistinctTeamColor(guild: any, teamName: string): string {
  const existingTeamRoles = guild.roles.cache.filter((r: any) => r.name.toLowerCase().startsWith('team '));
  let hash = 0;
  for (let i = 0; i < teamName.length; i++) {
    hash = (hash << 5) - hash + teamName.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs((existingTeamRoles.size + hash) % TEAM_COLORS.length);
  return TEAM_COLORS[index];
}

// Helper to sanitize team name into a clean discord channel slug
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 30) || 'squad';
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

      // Position above registered role so team color displays prominently on member name
      const regRole = guild.roles.cache.get(REGISTERED_ROLE_ID);
      if (regRole && teamRole.position < regRole.position) {
        await teamRole.setPosition(regRole.position + 1).catch(() => {});
      }
      logger.info(`[TEAM-REG] Created role ${teamRole.name} with color ${distinctColor} (${teamRole.id})`);
    } else {
      // Ensure existing team role has distinct color and is hoisted
      if (teamRole.hexColor === '#000000' || teamRole.hexColor === '#ffffff' || teamRole.hexColor === '#eab308') {
        await teamRole.edit({ color: distinctColor as any, hoist: true }).catch(() => {});
      }
    }

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

        if (captainMember.id !== guild.ownerId) {
          try {
            await captainMember.setNickname(newNickname, `Tournament squad approval: ${newNickname}`);
            logger.info(`[TEAM-REG] Updated captain nickname: ${captainMember.user.tag} -> "${newNickname}"`);
          } catch (nickErr: any) {
            logger.warn({ err: nickErr.message }, `[TEAM-REG] Failed setting nickname "${newNickname}" on ${captainMember.user.tag}`);
          }
        } else {
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

          if (tm.id !== guild.ownerId) {
            const cleanTmName = extractCleanPlayerName(tm.displayName || tm.user.username, teamTag);
            const tmNick = `${teamTag} | ${cleanTmName}`.slice(0, 32);
            await tm.setNickname(tmNick, `Tournament squad teammate approval: ${tmNick}`).catch(() => {});
            logger.info(`[TEAM-REG] Auto-updated teammate nickname: ${tm.user.tag} -> "${tmNick}"`);
          }
        }
      }
    }

    // C. Resolve Target Category (TOURNAMENT ZONE)
    let category = guild.channels.cache.get(TEAM_ZONE_CATEGORY_ID) || (await guild.channels.fetch(TEAM_ZONE_CATEGORY_ID).catch(() => null));
    if (!category || category.type !== ChannelType.GuildCategory) {
      category = guild.channels.cache.find(
        (c) => c.type === ChannelType.GuildCategory && (c.name.includes('TOURNAMENT') || c.name.includes('TEAM ZONE'))
      ) as any;
    }

    const categoryId = category ? category.id : undefined;

    // D. Create or Find Private Text Channel
    const isNewTextChannel = !guild.channels.cache.some(
      (c) => c.parentId === categoryId && (c.name === `💬・${slug}` || c.name === slug)
    );

    let textChannel = guild.channels.cache.find(
      (c) => c.parentId === categoryId && (c.name === `💬・${slug}` || c.name === slug)
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
    }

    // E. Create or Find Private Voice Channel
    let voiceChannel = guild.channels.cache.find(
      (c) => c.parentId === categoryId && (c.name === `🔊・${slug}` || c.name === slug)
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
            id: guild.members.me?.id || clientAppId(guild),
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.Connect,
              PermissionFlagsBits.ManageChannels,
            ],
          },
        ],
      });
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
  if (!guild) return;

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
      const res = await db.query('SELECT * FROM tournament_registrations WHERE id = $1', [data.regId]);
      reg = res.rows[0];
    } else if (data.teamName) {
      const res = await db.query(
        'SELECT * FROM tournament_registrations WHERE LOWER(team_name) = LOWER($1) ORDER BY created_at DESC LIMIT 1',
        [data.teamName]
      );
      reg = res.rows[0];
    }

    const teamName = reg?.team_name || data.teamName || 'Unknown Team';
    const roleId = reg?.role_id || data.roleId;
    const slug = slugify(teamName);

    // 2. Find Team Role
    let teamRole = roleId ? guild.roles.cache.get(roleId) : null;
    if (!teamRole && teamName) {
      teamRole =
        guild.roles.cache.find(
          (r) =>
            r.name.toLowerCase() === `team ${teamName}`.toLowerCase() ||
            r.name.toLowerCase() === teamName.toLowerCase()
        ) || null;
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
        if (member.id !== guild.ownerId) {
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

    // 5. Delete Channels
    let channelsDeleted = 0;
    const textChannelId = reg?.text_channel_id;
    const voiceChannelId = reg?.voice_channel_id;

    if (textChannelId) {
      const ch = guild.channels.cache.get(textChannelId);
      if (ch) {
        await ch.delete(`Tournament Team ${data.action} by ${data.executedBy || 'Admin'}`).catch(() => {});
        channelsDeleted++;
      }
    } else {
      const ch = guild.channels.cache.find(
        (c) => c.parentId === TEAM_ZONE_CATEGORY_ID && (c.name === `💬・${slug}` || c.name === slug)
      );
      if (ch) {
        await ch.delete(`Tournament Team ${data.action}`).catch(() => {});
        channelsDeleted++;
      }
    }

    if (voiceChannelId) {
      const vc = guild.channels.cache.get(voiceChannelId);
      if (vc) {
        await vc.delete(`Tournament Team ${data.action} by ${data.executedBy || 'Admin'}`).catch(() => {});
        channelsDeleted++;
      }
    } else {
      const vc = guild.channels.cache.find(
        (c) => c.parentId === TEAM_ZONE_CATEGORY_ID && (c.name === `🔊・${slug}` || c.name === slug)
      );
      if (vc) {
        await vc.delete(`Tournament Team ${data.action}`).catch(() => {});
        channelsDeleted++;
      }
    }

    // 6. Delete Team Role
    if (teamRole) {
      await teamRole.delete(`Tournament Team ${data.action} by ${data.executedBy || 'Admin'}`).catch(() => {});
    }

    // 7. Update Database status
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

export function isTeamRole(role: any, guild: any): boolean {
  if (!role || role.id === guild.id || role.id === REGISTERED_ROLE_ID || role.id === TEAM_LEADER_ROLE_ID) return false;
  if (role.name.toLowerCase().startsWith('team ')) return true;
  // Check if role has explicit permissions in tournament category channels
  return guild.channels.cache.some(
    (c: any) => c.parentId === TEAM_ZONE_CATEGORY_ID && c.permissionOverwrites?.cache?.has(role.id)
  );
}

/**
 * 8. GuildMemberUpdate listener for team roles
 * Guarantees that ANY squad member assigned a Team role automatically gets:
 * - Nickname formatted as: TAG | NAME
 * - @registered role
 * And when the team role is removed:
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
      const teamName = addedRole.name.replace(/^team\s+/i, '').trim();
      const tag = extractTeamTag(teamName);
      const cleanPlayerName = extractCleanPlayerName(newMember.displayName || newMember.user.username, tag);
      const formattedNick = `${tag} | ${cleanPlayerName}`.slice(0, 32);

      // Auto-set nickname if not already having this tag
      if (newMember.id !== guild.ownerId) {
        const currentNick = newMember.nickname || '';
        if (!currentNick.startsWith(`${tag} |`)) {
          try {
            await newMember.setNickname(formattedNick, `Tournament squad role assigned: ${formattedNick}`);
            logger.info(`[TEAM-REG] Auto-updated teammate nickname: ${newMember.user.tag} -> "${formattedNick}"`);
          } catch (err: any) {
            logger.warn({ err: err.message }, `[TEAM-REG] Failed auto-updating teammate nickname for ${newMember.user.tag}`);
          }
        }
      }

      // Also ensure @registered role
      const regRole = guild.roles.cache.get(REGISTERED_ROLE_ID);
      if (regRole && !newMember.roles.cache.has(regRole.id)) {
        await newMember.roles.add(regRole, `Teammate added to ${teamName}`).catch(() => {});
      }
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
      if (newMember.id !== guild.ownerId) {
        const currentNick = newMember.nickname || '';
        if (currentNick.includes('|')) {
          const clean = currentNick.split('|').slice(1).join('|').trim();
          await newMember.setNickname(clean.length > 0 ? clean : null, 'Team role removed: Resetting nickname').catch(() => {});
          logger.info(`[TEAM-REG] Reset teammate nickname: ${newMember.user.tag} -> "${clean || 'Default'}"`);
        }
      }
    }
  }
}
