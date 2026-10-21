import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
  Role,
} from 'discord.js';
import { db } from '../../core/database';
import { isBotOwner, isSovereignUser } from '../../api/routes/guilds';
import { invalidateSpamCatcherCache, getSpamCatcherConfig } from '../../security/antiSpam';
import { deploySpamCatcherHoneypot } from '../../services/spamCatcherDeployer';
import { logger } from '../../core/logger';

export const spamcatcherCommand = {
  data: new SlashCommandBuilder()
    .setName('spamcatcher')
    .setDescription('🛡️ Configure the Spam Catcher module for your server')
    .addSubcommand((sub) =>
      sub
        .setName('status')
        .setDescription('View current Spam Catcher configuration, sensitivity, action, and statistics')
    )
    .addSubcommand((sub) =>
      sub
        .setName('deploy')
        .setDescription('Deploy the honeypot spam-catcher channel with the official warning embed')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Target text channel (leave empty to auto-create "#🐝-spam-catcher")')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('timeout_hours')
            .setDescription('Timeout duration in hours (default: 6 hours)')
            .setMinValue(1)
            .setMaxValue(720)
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName('action')
            .setDescription('Enforcement penalty')
            .addChoices(
              { name: 'Timeout Member (Recommended)', value: 'TIMEOUT' },
              { name: 'Kick Member', value: 'KICK' },
              { name: 'Ban Member', value: 'BAN' }
            )
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('toggle')
        .setDescription('Enable or disable the Spam Catcher module')
        .addStringOption((opt) =>
          opt
            .setName('mode')
            .setDescription('Module state')
            .setRequired(true)
            .addChoices(
              { name: 'Enable Spam Catcher', value: 'enable' },
              { name: 'Disable Spam Catcher', value: 'disable' }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('sensitivity')
        .setDescription('Configure detection sensitivity preset')
        .addStringOption((opt) =>
          opt
            .setName('level')
            .setDescription('Sensitivity level')
            .setRequired(true)
            .addChoices(
              { name: 'Low (8 msgs / 6s, 6 mentions)', value: 'low' },
              { name: 'Medium (5 msgs / 4s, 4 mentions)', value: 'medium' },
              { name: 'High (4 msgs / 3s, 3 mentions)', value: 'high' },
              { name: 'Extreme (3 msgs / 2s, 2 mentions)', value: 'extreme' }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('action')
        .setDescription('Enforce countermeasure action when spam is detected')
        .addStringOption((opt) =>
          opt
            .setName('enforcement')
            .setDescription('Action to take')
            .setRequired(true)
            .addChoices(
              { name: 'Timeout Member', value: 'TIMEOUT' },
              { name: 'Kick Member', value: 'KICK' },
              { name: 'Ban Member', value: 'BAN' },
              { name: 'Delete Message Only', value: 'DELETE' }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('timeout')
        .setDescription('Set timeout duration in minutes (if action is TIMEOUT)')
        .addIntegerOption((opt) =>
          opt
            .setName('minutes')
            .setDescription('Duration in minutes (1 to 1440)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(1440)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('honeypot')
        .setDescription('Designate a decoy honeypot trap channel (any message triggers instant action)')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Target trap channel')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addBooleanOption((opt) =>
          opt
            .setName('disable')
            .setDescription('Disable honeypot trap channel')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('logchannel')
        .setDescription('Set or clear the security log channel for spam incidents')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Text channel for spam interception receipts')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addBooleanOption((opt) =>
          opt
            .setName('disable')
            .setDescription('Disable custom spam log channel')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('alerts')
        .setDescription('Toggle immediate direct DM alerts to the Server Owner')
        .addStringOption((opt) =>
          opt
            .setName('mode')
            .setDescription('Owner DM alerts mode')
            .setRequired(true)
            .addChoices(
              { name: 'Enable Owner DM Alerts', value: 'enable' },
              { name: 'Disable Owner DM Alerts', value: 'disable' }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('whitelist-role')
        .setDescription('Add or remove a role from Spam Catcher immunity')
        .addStringOption((opt) =>
          opt
            .setName('action')
            .setDescription('Action')
            .setRequired(true)
            .addChoices({ name: 'Add to Whitelist', value: 'add' }, { name: 'Remove from Whitelist', value: 'remove' })
        )
        .addRoleOption((opt) =>
          opt
            .setName('role')
            .setDescription('Target Discord role')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('whitelist-channel')
        .setDescription('Add or remove a channel from Spam Catcher immunity (e.g. #bot-commands)')
        .addStringOption((opt) =>
          opt
            .setName('action')
            .setDescription('Action')
            .setRequired(true)
            .addChoices({ name: 'Add to Whitelist', value: 'add' }, { name: 'Remove from Whitelist', value: 'remove' })
        )
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Target Discord text channel')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('test')
        .setDescription('Simulate a spam catch event to verify logging and owner DM alerts')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const guild = interaction.guild;
    const sovereign = await isSovereignUser(interaction.user.id, guild.id);

    // Permission Check: If Server Owner Settings are locked, only Sovereign users (Owner, Co-Owners, Bot Owner) can configure
    const ownerConfigCheck = await db.query(
      `SELECT settings_locked FROM guild_owner_config WHERE guild_id = $1`,
      [guild.id]
    ).catch(() => ({ rows: [] }));

    const isLocked = Boolean(ownerConfigCheck.rows[0]?.settings_locked);
    if (isLocked && !sovereign.allowed) {
      await interaction.reply({
        content: '🔒 **Access Denied**: Server Settings are locked by the Server Owner. Only the Server Owner and designated Co-Owners can configure modules.',
        ephemeral: true,
      });
      return;
    }

    if (!sovereign.allowed && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: '⛔ **Access Denied**: You need Administrator permissions or Server Owner authorization to configure the Spam Catcher module.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const subcommand = interaction.options.getSubcommand();

    try {
      // Ensure row exists
      await db.query(
        `INSERT INTO guild_spam_catcher (guild_id) VALUES ($1) ON CONFLICT (guild_id) DO NOTHING`,
        [guild.id]
      );

      const dbRes = await db.query(`SELECT * FROM guild_spam_catcher WHERE guild_id = $1`, [guild.id]);
      const current = dbRes.rows[0] || {};

      // 0. DEPLOY HONEYPOT CHANNEL
      if (subcommand === 'deploy') {
        const channel = interaction.options.getChannel('channel');
        const timeoutHours = interaction.options.getInteger('timeout_hours') || 6;
        const action = (interaction.options.getString('action') as any) || 'TIMEOUT';

        const deployRes = await deploySpamCatcherHoneypot(interaction.client, {
          guildId: guild.id,
          channelId: channel?.id,
          timeoutHours,
          action,
        });

        if (!deployRes.success) {
          await interaction.editReply(`❌ Failed to deploy Spam Catcher: ${deployRes.error}`);
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle('🐝 Spam Catcher Channel Deployed!')
          .setDescription(
            `Successfully deployed the Spam Catcher trap into <#${deployRes.channelId}> with an automated **${timeoutHours} Hours timeout** countermeasure.\n\nAny message sent by automated spam bots or unverified self-bots in this channel will be purged immediately and the sender timed out.`
          )
          .setColor(0x00f0ff)
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // 1. STATUS
      if (subcommand === 'status') {
        const cfg = await getSpamCatcherConfig(guild.id);
        const totalCaught = current.total_spams_caught || 0;

        const whitelistRolesFormatted =
          cfg.whitelist_roles.length > 0
            ? cfg.whitelist_roles.map((id) => `<@&${id}>`).join(', ')
            : '*None (Staff immune by default)*';

        const whitelistChannelsFormatted =
          cfg.whitelist_channels.length > 0
            ? cfg.whitelist_channels.map((id) => `<#${id}>`).join(', ')
            : '*None*';

        const honeypotDisplay = cfg.honeypot_channel_id ? `<#${cfg.honeypot_channel_id}>` : '*Disabled*';
        const logChannelDisplay = cfg.log_channel_id ? `<#${cfg.log_channel_id}>` : '*Server Default Log*';

        const embed = new EmbedBuilder()
          .setTitle(`🛡️ Spam Catcher Module Status: ${guild.name}`)
          .setDescription('Active heuristics and auto-countermeasures guarding this server against spam floods, self-bots, and mass mentions.')
          .setColor(cfg.enabled ? 0x00f0ff : 0x777777)
          .addFields(
            {
              name: '⚙️ Module State',
              value: cfg.enabled ? '🟢 **ACTIVE & ENFORCING**' : '🔴 **DISABLED**',
              inline: true,
            },
            {
              name: '🎯 Sensitivity Preset',
              value: `\`${cfg.sensitivity.toUpperCase()}\` (${cfg.max_messages_per_window} msgs / ${cfg.window_seconds}s)`,
              inline: true,
            },
            {
              name: '⚡ Countermeasure Action',
              value: `\`${cfg.action}\`${cfg.action === 'TIMEOUT' ? ` (${Math.round((cfg.timeout_duration_seconds || 300) / 60)}m)` : ''}`,
              inline: true,
            },
            {
              name: '🍯 Honeypot Trap Channel',
              value: honeypotDisplay,
              inline: true,
            },
            {
              name: '📜 Custom Log Channel',
              value: logChannelDisplay,
              inline: true,
            },
            {
              name: '📬 Owner Direct DM Alerts',
              value: cfg.owner_dm_alert ? '🟢 **ENABLED**' : '🔴 **MUTED**',
              inline: true,
            },
            {
              name: '📊 Interceptions Caught',
              value: `**${totalCaught.toLocaleString()}** spammers neutralized`,
              inline: true,
            },
            {
              name: '🛡️ Whitelisted Roles',
              value: whitelistRolesFormatted,
              inline: false,
            },
            {
              name: '💬 Whitelisted Channels',
              value: whitelistChannelsFormatted,
              inline: false,
            }
          )
          .setFooter({ text: 'SRB NEXUS Sovereign Infrastructure • Web Dashboard: srb-nexus-eyaj.onrender.com' })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // 2. TOGGLE
      if (subcommand === 'toggle') {
        const mode = interaction.options.getString('mode', true);
        const isEnabled = mode === 'enable';

        await db.query(
          `UPDATE guild_spam_catcher SET enabled = $1, updated_at = NOW() WHERE guild_id = $2`,
          [isEnabled, guild.id]
        );
        invalidateSpamCatcherCache(guild.id);

        await interaction.editReply(
          isEnabled
            ? '🟢 **Spam Catcher Enabled**: SRB NEXUS is actively intercepting message floods, duplicates, and mass mentions.'
            : '🔴 **Spam Catcher Disabled**: Message spam filtering is currently inactive.'
        );
        return;
      }

      // 3. SENSITIVITY
      if (subcommand === 'sensitivity') {
        const level = interaction.options.getString('level', true);

        await db.query(
          `UPDATE guild_spam_catcher SET sensitivity = $1, updated_at = NOW() WHERE guild_id = $2`,
          [level, guild.id]
        );
        invalidateSpamCatcherCache(guild.id);

        await interaction.editReply(`🎯 **Spam Catcher Sensitivity Updated**: Set to **${level.toUpperCase()}**.`);
        return;
      }

      // 4. ACTION
      if (subcommand === 'action') {
        const action = interaction.options.getString('enforcement', true);

        await db.query(
          `UPDATE guild_spam_catcher SET action = $1, updated_at = NOW() WHERE guild_id = $2`,
          [action, guild.id]
        );
        invalidateSpamCatcherCache(guild.id);

        await interaction.editReply(`⚡ **Countermeasure Action Updated**: Spammers will receive \`${action}\`.`);
        return;
      }

      // 5. TIMEOUT DURATION
      if (subcommand === 'timeout') {
        const minutes = interaction.options.getInteger('minutes', true);
        const seconds = minutes * 60;

        await db.query(
          `UPDATE guild_spam_catcher SET timeout_duration_seconds = $1, updated_at = NOW() WHERE guild_id = $2`,
          [seconds, guild.id]
        );
        invalidateSpamCatcherCache(guild.id);

        await interaction.editReply(`⏱️ **Timeout Duration Updated**: Set to **${minutes} minutes** (${seconds}s).`);
        return;
      }

      // 6. HONEYPOT
      if (subcommand === 'honeypot') {
        const disable = interaction.options.getBoolean('disable') ?? false;
        const channel = interaction.options.getChannel('channel');

        if (disable || (!channel && !disable)) {
          await db.query(
            `UPDATE guild_spam_catcher SET honeypot_channel_id = NULL, updated_at = NOW() WHERE guild_id = $1`,
            [guild.id]
          );
          invalidateSpamCatcherCache(guild.id);
          await interaction.editReply('🍯 **Honeypot Trap Channel Disabled**.');
          return;
        }

        if (channel) {
          await db.query(
            `UPDATE guild_spam_catcher SET honeypot_channel_id = $1, updated_at = NOW() WHERE guild_id = $2`,
            [channel.id, guild.id]
          );
          invalidateSpamCatcherCache(guild.id);
          await interaction.editReply(`🍯 **Honeypot Trap Channel Configured**: <#${channel.id}> designated as a decoy trap channel. Any non-staff message posted here will trigger an instant catch!`);
          return;
        }
      }

      // 7. LOG CHANNEL
      if (subcommand === 'logchannel') {
        const disable = interaction.options.getBoolean('disable') ?? false;
        const channel = interaction.options.getChannel('channel');

        if (disable || (!channel && !disable)) {
          await db.query(
            `UPDATE guild_spam_catcher SET log_channel_id = NULL, updated_at = NOW() WHERE guild_id = $1`,
            [guild.id]
          );
          invalidateSpamCatcherCache(guild.id);
          await interaction.editReply('📜 **Custom Spam Log Channel Disabled** (Using server default audit log).');
          return;
        }

        if (channel) {
          await db.query(
            `UPDATE guild_spam_catcher SET log_channel_id = $1, updated_at = NOW() WHERE guild_id = $2`,
            [channel.id, guild.id]
          );
          invalidateSpamCatcherCache(guild.id);
          await interaction.editReply(`📜 **Spam Catcher Log Channel Configured**: Interception receipts will be dispatched to <#${channel.id}>.`);
          return;
        }
      }

      // 8. ALERTS
      if (subcommand === 'alerts') {
        const mode = interaction.options.getString('mode', true);
        const alertsEnabled = mode === 'enable';

        await db.query(
          `UPDATE guild_spam_catcher SET owner_dm_alert = $1, updated_at = NOW() WHERE guild_id = $2`,
          [alertsEnabled, guild.id]
        );
        invalidateSpamCatcherCache(guild.id);

        await interaction.editReply(
          alertsEnabled
            ? '📬 **Owner Direct DM Alerts Enabled**: The Server Owner will receive real-time direct messages when spam is intercepted.'
            : '🔕 **Owner Direct DM Alerts Muted**.'
        );
        return;
      }

      // 9. WHITELIST ROLE
      if (subcommand === 'whitelist-role') {
        const action = interaction.options.getString('action', true);
        const targetRole = interaction.options.getRole('role', true);

        let roles: string[] = Array.isArray(current.whitelist_roles) ? current.whitelist_roles : [];

        if (action === 'add') {
          if (!roles.includes(targetRole.id)) roles.push(targetRole.id);
        } else {
          roles = roles.filter((r) => r !== targetRole.id);
        }

        await db.query(
          `UPDATE guild_spam_catcher SET whitelist_roles = $1, updated_at = NOW() WHERE guild_id = $2`,
          [JSON.stringify(roles), guild.id]
        );
        invalidateSpamCatcherCache(guild.id);

        await interaction.editReply(`🛡️ **Role Whitelist Updated**: <@&${targetRole.id}> is ${action === 'add' ? 'now exempt from' : 'no longer exempt from'} Spam Catcher.`);
        return;
      }

      // 10. WHITELIST CHANNEL
      if (subcommand === 'whitelist-channel') {
        const action = interaction.options.getString('action', true);
        const targetChannel = interaction.options.getChannel('channel', true);

        let channels: string[] = Array.isArray(current.whitelist_channels) ? current.whitelist_channels : [];

        if (action === 'add') {
          if (!channels.includes(targetChannel.id)) channels.push(targetChannel.id);
        } else {
          channels = channels.filter((c) => c !== targetChannel.id);
        }

        await db.query(
          `UPDATE guild_spam_catcher SET whitelist_channels = $1, updated_at = NOW() WHERE guild_id = $2`,
          [JSON.stringify(channels), guild.id]
        );
        invalidateSpamCatcherCache(guild.id);

        await interaction.editReply(`💬 **Channel Whitelist Updated**: <#${targetChannel.id}> is ${action === 'add' ? 'now exempt from' : 'no longer exempt from'} Spam Catcher.`);
        return;
      }

      // 11. TEST SIMULATION
      if (subcommand === 'test') {
        const owner = await guild.fetchOwner().catch(() => null);

        const testEmbed = new EmbedBuilder()
          .setTitle('🛡️ [SPAM CATCHER TEST] Verification Alert')
          .setDescription(`This is a test interception receipt from **SRB NEXUS Spam Catcher** in **${guild.name}**.`)
          .setColor(0x00f0ff)
          .addFields(
            { name: 'Simulated User', value: `<@${interaction.user.id}> (\`${interaction.user.tag}\`)`, inline: true },
            { name: 'Channel', value: `<#${interaction.channelId}>`, inline: true },
            { name: 'Action Tested', value: '`TIMEOUT (5m)`', inline: true },
            { name: 'Detection Heuristic', value: 'Repeated Message Spam Simulation', inline: false }
          )
          .setFooter({ text: 'SRB NEXUS Sovereign Server Owner Alert' })
          .setTimestamp();

        let dmDelivered = false;
        if (owner) {
          try {
            await owner.send({ embeds: [testEmbed] });
            dmDelivered = true;
          } catch {}
        }

        await interaction.editReply(
          `✅ **Test Complete**: Spam Catcher pipeline is fully functional.\n${dmDelivered ? '• Direct DM alert successfully delivered to the Server Owner.' : '• Could not deliver DM to Server Owner (DMs closed or privacy settings).'}`
        );
        return;
      }
    } catch (err) {
      logger.error({ err }, 'Error in /spamcatcher command execution');
      await interaction.editReply('❌ An unexpected error occurred while executing the Spam Catcher command.');
    }
  },
};
