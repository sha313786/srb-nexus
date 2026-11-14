import { ButtonInteraction, EmbedBuilder, GuildMember, PermissionFlagsBits } from 'discord.js';
import { db } from '../core/database';
import { logger } from '../core/logger';

const CHECKIN_CHANNEL_ID = '1571085804053205113'; // 【✅】ᴍᴀᴛᴄʜ-ᴄʜᴇᴄᴋɪɴ
const TEAM_LEADER_ROLE_ID = '1571071414448955564'; // 👑 TEAM LEADER
const REGISTERED_ROLE_ID = '1566440573513244682'; // @registered

// In-memory cache of checked-in squads for instant lookup
const checkedInSquads = new Map<string, { leaderId: string; leaderTag: string; time: Date }>();

let tableInitialized = false;
async function ensureTable(): Promise<void> {
  if (tableInitialized) return;
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS tournament_checkins (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(32) NOT NULL,
        user_id VARCHAR(32) NOT NULL,
        user_tag VARCHAR(100),
        team_name VARCHAR(128) NOT NULL,
        checked_in_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    tableInitialized = true;
  } catch (err: any) {
    logger.warn({ err: err.message }, '[CHECKIN] Table creation skipped or table exists');
  }
}

/**
 * Handle Squad Ready Check-In Button
 */
export async function handleSquadCheckin(interaction: ButtonInteraction): Promise<void> {
  // 1. Immediately acknowledge interaction to avoid Discord 3-second timeout
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
  }

  try {
    const member = interaction.member as GuildMember;
    if (!member) {
      await interaction.editReply({ content: '❌ Could not verify your member profile in this server.' });
      return;
    }

    const isAdmin =
      member.permissions?.has(PermissionFlagsBits.Administrator) ||
      member.permissions?.has(PermissionFlagsBits.ManageGuild) ||
      member.id === member.guild?.ownerId;

    // Find team role: starts with 'team '
    const teamRole = member.roles?.cache?.find(
      (r) => r.name.toLowerCase().startsWith('team ') && r.id !== member.guild.id
    );

    const isLeader = member.roles?.cache?.has(TEAM_LEADER_ROLE_ID);
    const isRegistered = member.roles?.cache?.has(REGISTERED_ROLE_ID);

    // If regular user without any team role or leader role
    if (!teamRole && !isLeader && !isRegistered && !isAdmin) {
      await interaction.editReply({
        content:
          '⚠️ **Access Denied:** Only registered squad captains (`👑 TEAM LEADER`) or squad members can perform match check-ins. If your squad was recently approved, please ensure your roles have been assigned.',
      });
      return;
    }

    const teamName = teamRole
      ? teamRole.name.replace(/^team\s+/i, '')
      : isLeader
      ? `${member.displayName || member.user.username}'s Squad`
      : isAdmin
      ? `Staff Test Squad (${member.user.username})`
      : `${member.user.username}'s Squad`;

    // Check if already checked in
    if (checkedInSquads.has(teamName.toLowerCase())) {
      const existing = checkedInSquads.get(teamName.toLowerCase())!;
      await interaction.editReply({
        content: `ℹ️ **Already Checked In:** Squad **${teamName}** was already marked READY by <@${existing.leaderId}> at <t:${Math.floor(existing.time.getTime() / 1000)}:T>.`,
      });
      return;
    }

    // Record check-in in memory
    checkedInSquads.set(teamName.toLowerCase(), {
      leaderId: member.id,
      leaderTag: member.user.tag,
      time: new Date(),
    });

    // Save to DB asynchronously in background (non-blocking)
    setImmediate(async () => {
      try {
        await ensureTable();
        await db.query(
          `INSERT INTO tournament_checkins (guild_id, user_id, user_tag, team_name) VALUES ($1, $2, $3, $4)`,
          [member.guild.id, member.id, member.user.tag, teamName]
        );
      } catch (err: any) {
        logger.error({ err: err.message }, '[CHECKIN] Failed to log checkin to DB');
      }
    });

    // Reply confirmation to user
    const adminNote = isAdmin && !teamRole && !isLeader ? ' *(Admin Verified)*' : '';
    await interaction.editReply({
      content: `✅ **Check-In Confirmed!** Squad **${teamName}**${adminNote} has been officially marked **READY** on the tournament board. Good luck in the lobby!`,
    });

    // Post live check-in announcement in check-in channel
    const checkinChannel = member.guild.channels.cache.get(CHECKIN_CHANNEL_ID) as any;
    if (checkinChannel && checkinChannel.isTextBased()) {
      const embed = new EmbedBuilder()
        .setColor('#10B981')
        .setDescription(
          `🟢 **SQUAD READY:** <@${member.id}> has confirmed check-in for **${teamName}**! 🎮\n` +
          `• Status: **Checked In** | Squad Count: **${checkedInSquads.size} Teams Ready**`
        )
        .setTimestamp();

      await checkinChannel.send({ embeds: [embed] }).catch(() => {});
    }
  } catch (error: any) {
    logger.error({ err: error.message }, '[CHECKIN] Error during handleSquadCheckin');
    await interaction.editReply({
      content: '❌ An error occurred while processing your check-in. Please try again.',
    }).catch(() => {});
  }
}

/**
 * Handle View Check-In Roster Button
 */
export async function handleCheckinStatus(interaction: ButtonInteraction): Promise<void> {
  // Immediately acknowledge interaction
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
  }

  try {
    if (checkedInSquads.size === 0) {
      await interaction.editReply({
        content: '📋 **Check-In Board:** No squads have checked in for the upcoming match session yet.',
      });
      return;
    }

    const squadList = Array.from(checkedInSquads.entries())
      .map(([name, data], idx) => `${idx + 1}. **${name.toUpperCase()}** (<@${data.leaderId}>) • Checked in at <t:${Math.floor(data.time.getTime() / 1000)}:T>`)
      .join('\n');

    const embed = new EmbedBuilder()
      .setColor('#3B82F6')
      .setTitle('📋 CURRENT CHECKED-IN SQUADS')
      .setDescription(squadList)
      .setFooter({ text: `Total Checked In: ${checkedInSquads.size} Squads` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    logger.error({ err: error.message }, '[CHECKIN] Error during handleCheckinStatus');
    await interaction.editReply({
      content: '❌ An error occurred while fetching the check-in roster.',
    }).catch(() => {});
  }
}
