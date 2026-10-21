import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  User,
} from 'discord.js';
import { db } from '../../core/database';
import { isBotOwner } from '../../api/routes/guilds';
import { logger } from '../../core/logger';

export const serverownerCommand = {
  data: new SlashCommandBuilder()
    .setName('serverowner')
    .setDescription('👑 Sovereign governance & owner suite for server owners')
    .addSubcommand((sub) =>
      sub
        .setName('status')
        .setDescription('View server sovereign governance status, co-owners, and safety locks')
    )
    .addSubcommand((sub) =>
      sub
        .setName('co-owner')
        .setDescription('Designate or revoke executive co-owner status for trusted users')
        .addStringOption((opt) =>
          opt
            .setName('action')
            .setDescription('Action to perform')
            .setRequired(true)
            .addChoices(
              { name: 'Add Co-Owner', value: 'add' },
              { name: 'Remove Co-Owner', value: 'remove' }
            )
        )
        .addUserOption((opt) =>
          opt
            .setName('user')
            .setDescription('Target member to promote or demote')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('lock')
        .setDescription('Lock or unlock server configuration from being modified by junior admins')
        .addStringOption((opt) =>
          opt
            .setName('mode')
            .setDescription('Configuration lock mode')
            .setRequired(true)
            .addChoices(
              { name: 'Enable Lock (Owner Only)', value: 'enable' },
              { name: 'Disable Lock (All Admins)', value: 'disable' }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('alerts')
        .setDescription('Toggle immediate direct DM alerts on raids, spam, and security incidents')
        .addStringOption((opt) =>
          opt
            .setName('mode')
            .setDescription('Alerts toggle mode')
            .setRequired(true)
            .addChoices(
              { name: 'Enable Direct DM Alerts', value: 'enable' },
              { name: 'Disable Direct DM Alerts', value: 'disable' }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('test-alert')
        .setDescription('Send a test security notification directly to your Discord DMs')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const guild = interaction.guild;
    const isOwner = interaction.user.id === guild.ownerId;
    const isBotSysOwner = await isBotOwner(interaction.user.id);

    // Strict sovereign check: ONLY the Discord Server Owner or the Bot System Developer
    if (!isOwner && !isBotSysOwner) {
      await interaction.reply({
        content: '⛔ **Access Denied**: The `/serverowner` suite is sovereign and restricted exclusively to the Discord Server Owner.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const subcommand = interaction.options.getSubcommand();

    try {
      // Ensure row exists in guild_owner_config
      await db.query(
        `INSERT INTO guild_owner_config (guild_id, owner_id)
         VALUES ($1, $2)
         ON CONFLICT (guild_id) DO NOTHING`,
        [guild.id, guild.ownerId]
      );

      const configRes = await db.query(
        `SELECT * FROM guild_owner_config WHERE guild_id = $1`,
        [guild.id]
      );
      const ownerConfig = configRes.rows[0] || {
        guild_id: guild.id,
        owner_id: guild.ownerId,
        co_owners: [],
        protected_roles: [],
        settings_locked: false,
        owner_dm_alerts: true,
      };

      const coOwners: string[] = Array.isArray(ownerConfig.co_owners) ? ownerConfig.co_owners : [];
      const protectedRoles: string[] = Array.isArray(ownerConfig.protected_roles) ? ownerConfig.protected_roles : [];

      // 1. SUBCOMMAND: status
      if (subcommand === 'status') {
        const ownerMember = await guild.fetchOwner().catch(() => null);
        const ownerDisplay = ownerMember ? `<@${ownerMember.id}> (\`${ownerMember.user.tag}\`)` : `<@${guild.ownerId}>`;

        const coOwnersFormatted =
          coOwners.length > 0
            ? coOwners.map((id) => `• <@${id}> (\`${id}\`)`).join('\n')
            : '*No executive co-owners designated.*';

        const rolesFormatted =
          protectedRoles.length > 0
            ? protectedRoles.map((id) => `• <@&${id}>`).join('\n')
            : '*No protected roles configured.*';

        const embed = new EmbedBuilder()
          .setTitle(`👑 Sovereign Governance Suite: ${guild.name}`)
          .setDescription(
            `Welcome to the **Sovereign Server Owner Suite**. As the Discord Server Owner, you possess ultimate administrative authority over SRB NEXUS in this guild.`
          )
          .setColor(0x00f0ff)
          .setThumbnail(guild.iconURL({ size: 128 }) || null)
          .addFields(
            {
              name: '👑 Primary Server Owner',
              value: ownerDisplay,
              inline: false,
            },
            {
              name: '🔒 Dashboard Settings Lock',
              value: ownerConfig.settings_locked
                ? '🔴 **LOCKED** — Junior administrators are blocked from changing bot modules on the dashboard.'
                : '🟢 **UNLOCKED** — Administrators with `Manage Server` can edit module settings.',
              inline: false,
            },
            {
              name: '📬 Owner Direct DM Alerts',
              value: ownerConfig.owner_dm_alerts
                ? '🟢 **ENABLED** — High-priority security incidents (raids, nuke attempts, spam surges) send immediate DMs to you.'
                : '🔴 **DISABLED** — Direct DM alerts muted.',
              inline: false,
            },
            {
              name: `👥 Executive Co-Owners (${coOwners.length})`,
              value: coOwnersFormatted,
              inline: false,
            },
            {
              name: `🛡️ Protected Roles (${protectedRoles.length})`,
              value: rolesFormatted,
              inline: false,
            }
          )
          .setFooter({
            text: 'SRB NEXUS Sovereign Infrastructure • Web Dashboard: srb-nexus-eyaj.onrender.com',
          })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // 2. SUBCOMMAND: co-owner
      if (subcommand === 'co-owner') {
        const action = interaction.options.getString('action', true);
        const targetUser: User = interaction.options.getUser('user', true);

        if (targetUser.bot) {
          await interaction.editReply('⚠️ Bots cannot be designated as executive co-owners.');
          return;
        }

        if (targetUser.id === guild.ownerId) {
          await interaction.editReply('ℹ️ The primary server owner already has permanent sovereign authority.');
          return;
        }

        let updatedCoOwners = [...coOwners];

        if (action === 'add') {
          if (updatedCoOwners.includes(targetUser.id)) {
            await interaction.editReply(`⚠️ <@${targetUser.id}> is already an executive co-owner.`);
            return;
          }
          updatedCoOwners.push(targetUser.id);
        } else {
          if (!updatedCoOwners.includes(targetUser.id)) {
            await interaction.editReply(`⚠️ <@${targetUser.id}> is not in the executive co-owners list.`);
            return;
          }
          updatedCoOwners = updatedCoOwners.filter((id) => id !== targetUser.id);
        }

        await db.query(
          `UPDATE guild_owner_config
           SET co_owners = $1, updated_at = NOW()
           WHERE guild_id = $2`,
          [JSON.stringify(updatedCoOwners), guild.id]
        );

        const embed = new EmbedBuilder()
          .setTitle(action === 'add' ? '👥 Executive Co-Owner Designated' : '👥 Executive Co-Owner Revoked')
          .setDescription(
            action === 'add'
              ? `Successfully granted executive co-owner privileges to <@${targetUser.id}> (\`${targetUser.tag}\`). They now retain full configuration access on the SRB NEXUS web dashboard even when Sovereign Settings Lock is active.`
              : `Revoked executive co-owner privileges from <@${targetUser.id}> (\`${targetUser.tag}\`).`
          )
          .setColor(action === 'add' ? 0x00ff88 : 0xffaa00)
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // 3. SUBCOMMAND: lock
      if (subcommand === 'lock') {
        const mode = interaction.options.getString('mode', true);
        const lockState = mode === 'enable';

        await db.query(
          `UPDATE guild_owner_config
           SET settings_locked = $1, updated_at = NOW()
           WHERE guild_id = $2`,
          [lockState, guild.id]
        );

        const embed = new EmbedBuilder()
          .setTitle(lockState ? '🔒 Sovereign Settings Lock ACTIVATED' : '🔓 Sovereign Settings Lock LIFTED')
          .setDescription(
            lockState
              ? `**Server configuration has been locked by the Server Owner.**\n\nStandard Discord administrators can no longer toggle modules or modify security policies via the SRB NEXUS web dashboard. Only you and authorized Co-Owners can adjust settings.`
              : `**Server configuration has been unlocked.**\n\nAdministrators with standard Discord permissions may now configure modules via the web dashboard.`
          )
          .setColor(lockState ? 0xff0055 : 0x00f0ff)
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // 4. SUBCOMMAND: alerts
      if (subcommand === 'alerts') {
        const mode = interaction.options.getString('mode', true);
        const alertState = mode === 'enable';

        await db.query(
          `UPDATE guild_owner_config
           SET owner_dm_alerts = $1, updated_at = NOW()
           WHERE guild_id = $2`,
          [alertState, guild.id]
        );

        const embed = new EmbedBuilder()
          .setTitle(alertState ? '📬 Owner Direct DM Alerts ACTIVATED' : '🔕 Owner Direct DM Alerts MUTED')
          .setDescription(
            alertState
              ? `You will now receive high-priority direct messages whenever security events (Anti-Raid triggers, Spam attacks, Nuke attempts, or Mass actions) occur in **${guild.name}**.`
              : `Direct DM alerts for security events in **${guild.name}** have been muted.`
          )
          .setColor(alertState ? 0x00ff88 : 0x777777)
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // 5. SUBCOMMAND: test-alert
      if (subcommand === 'test-alert') {
        const testEmbed = new EmbedBuilder()
          .setTitle('👑 [SRB NEXUS] Sovereign Owner Alert Verification')
          .setDescription(
            `Hello <@${interaction.user.id}>!\n\nThis is a test notification from **SRB NEXUS** for your server **${guild.name}**.\n\nYour Owner DM notification pipeline is active and verified. Whenever critical security incidents take place, you will receive real-time incident briefs directly here.`
          )
          .setColor(0x00f0ff)
          .addFields(
            { name: 'Server Name', value: guild.name, inline: true },
            { name: 'Server ID', value: guild.id, inline: true },
            { name: 'Channel Status', value: '🟢 Direct Link Verified', inline: true }
          )
          .setFooter({ text: 'SRB NEXUS Sovereign Infrastructure Suite' })
          .setTimestamp();

        try {
          await interaction.user.send({ embeds: [testEmbed] });
          await interaction.editReply('✅ **Verified**: A test security alert has been dispatched to your Discord DMs!');
        } catch (dmErr) {
          logger.warn({ dmErr, userId: interaction.user.id }, 'Failed to deliver test alert DM to server owner');
          await interaction.editReply(
            '⚠️ **Delivery Failed**: SRB NEXUS could not send you a direct message.\n\nPlease check your Discord **User Settings ➔ Privacy & Safety ➔ "Allow direct messages from server members"** to ensure alerts can reach you.'
          );
        }
        return;
      }
    } catch (err) {
      logger.error({ err }, 'Error in /serverowner command execution');
      await interaction.editReply('❌ An unexpected error occurred while executing the server owner command.');
    }
  },
};
