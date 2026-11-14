import { ButtonInteraction, EmbedBuilder, GuildMember } from 'discord.js';
import { db } from '../core/database';
import { logger } from '../core/logger';

const CHECKIN_CHANNEL_ID = '1571085804053205113'; // 【✅】ᴍᴀᴛᴄʜ-ᴄʜᴇᴄᴋɪɴ
const TEAM_LEADER_ROLE_ID = '1571071414448955564'; // 👑 TEAM LEADER
const REGISTERED_ROLE_ID = '1566440573513244682'; // @registered

// In-memory set of checked-in squads for instant lookup
const checkedInSquads = new Map<string, { leaderId: string; leaderTag: string; time: Date }>();

async function ensureTable(): Promise<void> {
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
  } catch (err: any) {
    logger.warn({ err: err.message }, '[CHECKIN] Table creation skipped or table exists');
  }
}

/**
 * Handle Squad Ready Check-In Button
 */
export async function handleSquadCheckin(interaction: ButtonInteraction): Promise<void> {
  const member = interaction.member as GuildMember;
  if (!member) {
    await interaction.reply({ content: '❌ Could not verify member permissions.', ephemeral: true });
    return;
  }

  // Find team role: either starts with 'Team ' or any role other than @everyone, bots, etc.
  const teamRole = member.roles.cache.find(
    (r) => r.name.toLowerCase().startsWith('team ') && r.id !== member.guild.id
  );

  const isLeader = member.roles.cache.has(TEAM_LEADER_ROLE_ID);
  const isRegistered = member.roles.cache.has(REGISTERED_ROLE_ID);

  if (!teamRole && !isLeader && !isRegistered) {
    await interaction.reply({
      content:
        '⚠️ **Access Denied:** Only registered squad captains (`👑 TEAM LEADER`) or squad members can perform match check-ins. If your squad was recently approved, please ensure your roles have been assigned.',
      ephemeral: true,
    });
    return;
  }

  const teamName = teamRole ? teamRole.name.replace(/^team\s+/i, '') : `${member.user.username}'s Squad`;

  // Check if already checked in
  if (checkedInSquads.has(teamName.toLowerCase())) {
    const existing = checkedInSquads.get(teamName.toLowerCase())!;
    await interaction.reply({
      content: `ℹ️ **Already Checked In:** Squad **${teamName}** was already marked READY by <@${existing.leaderId}> at <t:${Math.floor(existing.time.getTime() / 1000)}:T>.`,
      ephemeral: true,
    });
    return;
  }

  // Record check-in
  checkedInSquads.set(teamName.toLowerCase(), {
    leaderId: member.id,
    leaderTag: member.user.tag,
    time: new Date(),
  });

  await ensureTable();
  try {
    await db.query(
      `INSERT INTO tournament_checkins (guild_id, user_id, user_tag, team_name) VALUES ($1, $2, $3, $4)`,
      [member.guild.id, member.id, member.user.tag, teamName]
    );
  } catch (err: any) {
    logger.error({ err: err.message }, '[CHECKIN] Failed to log checkin to DB');
  }

  // Reply ephemeral to captain
  await interaction.reply({
    content: `✅ **Check-In Confirmed!** Squad **${teamName}** has been officially marked **READY** on the tournament board. Good luck in the lobby!`,
    ephemeral: true,
  });

  // Post live check-in alert in channel
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
}

/**
 * Handle View Check-In Roster Button
 */
export async function handleCheckinStatus(interaction: ButtonInteraction): Promise<void> {
  if (checkedInSquads.size === 0) {
    await interaction.reply({
      content: '📋 **Check-In Board:** No squads have checked in for the upcoming match session yet.',
      ephemeral: true,
    });
    return;
  }

  const squadList = Array.from(checkedInSquads.entries())
    .map(([_, data], idx) => `${idx + 1}. **${data.leaderTag}'s Team** (<@${data.leaderId}>) • Checked in at <t:${Math.floor(data.time.getTime() / 1000)}:T>`)
    .join('\n');

  const embed = new EmbedBuilder()
    .setColor('#3B82F6')
    .setTitle('📋 CURRENT CHECKED-IN SQUADS')
    .setDescription(squadList)
    .setFooter({ text: `Total Checked In: ${checkedInSquads.size} Squads` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
