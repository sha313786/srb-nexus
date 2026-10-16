import {
  Client,
  ButtonInteraction,
  ModalSubmitInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  TextChannel,
  GuildMember,
} from 'discord.js';
import { db } from '../core/database';
import { logger } from '../core/logger';

// Store dynamic session captcha codes in memory: `${userId}_${guildId}` -> code
const captchaSessions = new Map<string, string>();

/**
 * Deploy or update the Verification Gate panel in the designated channel
 */
export async function deployVerificationPanel(
  client: Client,
  guildId: string,
  channelId: string,
  type: 'button' | 'captcha' = 'button',
  customTitle?: string,
  customDesc?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const guild = client.guilds.cache.get(guildId) || (await client.guilds.fetch(guildId).catch(() => null));
    if (!guild) return { success: false, error: 'Guild not found' };

    const channel = guild.channels.cache.get(channelId) || (await guild.channels.fetch(channelId).catch(() => null));
    if (!channel || !channel.isTextBased()) return { success: false, error: 'Invalid verification text channel' };

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle(customTitle || '🛡️ Server Verification Gate')
      .setDescription(
        customDesc ||
          `Welcome to **${guild.name}**!\n\nTo ensure our community remains safe and free of automated spam bots, all members must verify before accessing channels.\n\nClick the button below to complete verification.`
      )
      .addFields(
        { name: '🔒 Security Status', value: 'Active Velocity Shield', inline: true },
        { name: '⚡ Method', value: type === 'captcha' ? 'Visual Math Captcha' : 'Instant One-Click Gate', inline: true }
      )
      .setFooter({ text: `${guild.name} • Powered by SRB NEXUS`, iconURL: guild.iconURL() || undefined })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`nexus_verify_${type}`)
        .setLabel('Complete Verification')
        .setEmoji('🛡️')
        .setStyle(ButtonStyle.Success)
    );

    const sent = await (channel as TextChannel).send({ embeds: [embed], components: [row] });
    return { success: true, messageId: sent.id };
  } catch (err: any) {
    logger.error({ err }, `[VERIFY] Failed to deploy verification panel in guild ${guildId}`);
    return { success: false, error: err.message };
  }
}

/**
 * Handle verification button interaction
 */
export async function handleVerificationButton(interaction: ButtonInteraction): Promise<void> {
  const { guildId, user, member, customId } = interaction;
  if (!guildId || !member) return;

  try {
    const res = await db.query(
      'SELECT verification_enabled, verification_role_id, unverified_role_id, verification_type FROM guild_settings WHERE guild_id = $1',
      [guildId]
    );

    // If verification was not explicitly marked enabled in DB, but the user is clicking the deployed gate button,
    // auto-enable it in the database so members are never locked out!
    if (res.rows.length === 0) {
      await db.query(
        `INSERT INTO guild_settings (guild_id, verification_enabled, verification_type)
         VALUES ($1, TRUE, $2)
         ON CONFLICT (guild_id) DO UPDATE SET verification_enabled = TRUE`,
        [guildId, customId.includes('captcha') ? 'captcha' : 'button']
      ).catch(() => {});
    } else if (!res.rows[0].verification_enabled) {
      await db.query(
        `UPDATE guild_settings SET verification_enabled = TRUE WHERE guild_id = $1`,
        [guildId]
      ).catch(() => {});
    }

    const verification_role_id = res.rows[0]?.verification_role_id;
    const unverified_role_id = res.rows[0]?.unverified_role_id;
    const verification_type = res.rows[0]?.verification_type || (customId.includes('captcha') ? 'captcha' : 'button');

    // If Captcha mode, prompt modal challenge
    if (customId === 'nexus_verify_captcha' || verification_type === 'captcha') {
      const num1 = Math.floor(Math.random() * 8) + 1;
      const num2 = Math.floor(Math.random() * 8) + 1;
      const answer = String(num1 + num2);

      captchaSessions.set(`${user.id}_${guildId}`, answer);

      const modal = new ModalBuilder()
        .setCustomId(`nexus_verify_modal_${answer}`)
        .setTitle('🛡️ Anti-Bot Verification Check');

      const questionInput = new TextInputBuilder()
        .setCustomId('captcha_answer')
        .setLabel(`What is ${num1} + ${num2}?`)
        .setPlaceholder('Enter the sum (numbers only)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(3);

      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(questionInput));
      await interaction.showModal(modal);
      return;
    }

    // Button mode: grant verification immediately
    await completeVerification(interaction, member as GuildMember, verification_role_id, unverified_role_id);
  } catch (err: any) {
    logger.error({ err }, `[VERIFY] Error processing verification for ${user.tag}`);
    await interaction.reply({
      content: '❌ An error occurred during verification. Please contact server moderators.',
      ephemeral: true,
    }).catch(() => {});
  }
}

/**
 * Handle verification captcha modal submission
 */
export async function handleVerificationModal(interaction: ModalSubmitInteraction): Promise<void> {
  const { guildId, user, member, customId } = interaction;
  if (!guildId || !member) return;

  const expectedAnswer = customId.replace('nexus_verify_modal_', '');
  const userAnswer = interaction.fields.getTextInputValue('captcha_answer').trim();

  if (userAnswer !== expectedAnswer) {
    await interaction.reply({
      content: '❌ Incorrect answer. Please try clicking the verification button again.',
      ephemeral: true,
    });
    return;
  }

  captchaSessions.delete(`${user.id}_${guildId}`);

  try {
    const res = await db.query(
      'SELECT verification_role_id, unverified_role_id FROM guild_settings WHERE guild_id = $1',
      [guildId]
    );

    const { verification_role_id, unverified_role_id } = res.rows[0] || {};
    await completeVerification(interaction, member as GuildMember, verification_role_id, unverified_role_id);
  } catch (err: any) {
    logger.error({ err }, `[VERIFY] Error granting verified role to ${user.tag}`);
    await interaction.reply({
      content: '❌ An error occurred finalizing your roles. Please contact staff.',
      ephemeral: true,
    }).catch(() => {});
  }
}

/**
 * Helper to assign verified role and remove unverified role
 */
async function completeVerification(
  interaction: ButtonInteraction | ModalSubmitInteraction,
  member: GuildMember,
  verifiedRoleId?: string,
  unverifiedRoleId?: string
): Promise<void> {
  const guild = member.guild;
  let targetRoleId = verifiedRoleId ? verifiedRoleId.replace(/[<#@!&>]/g, '').trim() : undefined;

  // Auto-detect Member or Verified role if none was configured
  if (!targetRoleId || !guild.roles.cache.has(targetRoleId)) {
    const autoRole = guild.roles.cache.find(
      (r) => /^(member|verified|members|community)$/i.test(r.name) && !r.managed && r.id !== guild.id
    );
    if (autoRole) {
      targetRoleId = autoRole.id;
      db.query(`UPDATE guild_settings SET verification_role_id = $1 WHERE guild_id = $2`, [autoRole.id, guild.id]).catch(() => {});
    }
  }

  let assignedRoleName: string | null = null;
  if (targetRoleId) {
    const role = guild.roles.cache.get(targetRoleId);
    if (role) {
      const added = await member.roles.add(role).catch((e) => {
        logger.warn({ e }, `[VERIFY] Could not add role ${role.name} to ${member.user.tag}`);
        return null;
      });
      if (added) assignedRoleName = role.name;
    }
  }

  if (unverifiedRoleId) {
    const cleanRole = unverifiedRoleId.replace(/[<#@!&>]/g, '').trim();
    const role = guild.roles.cache.get(cleanRole);
    if (role) {
      await member.roles.remove(role).catch(() => {});
    }
  }

  const roleNote = assignedRoleName 
    ? `You have been assigned the **@${assignedRoleName}** role and now have full access to the server.`
    : `You have successfully passed verification and now have access to the server.`;

  await interaction.reply({
    content: `🎉 **Verification Complete!** ${roleNote} Welcome to **${guild.name}**!`,
    ephemeral: true,
  });

  logger.info(`[VERIFY] Member ${member.user.tag} (${member.id}) verified in ${guild.name}`);
}
