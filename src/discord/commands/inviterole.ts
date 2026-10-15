import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Role,
} from 'discord.js';
import { db } from '../../core/database';
import { logger } from '../../core/logger';

export const inviteroleCommand = {
  data: new SlashCommandBuilder()
    .setName('inviterole')
    .setDescription('Configure auto-assigned roles based on which invite link a new member used')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Bind an invite code to automatically grant a role on member join')
        .addStringOption((opt) =>
          opt
            .setName('code')
            .setDescription('The Discord invite code or link (e.g. abcXYZ or https://discord.gg/abcXYZ)')
            .setRequired(true)
        )
        .addRoleOption((opt) =>
          opt
            .setName('role')
            .setDescription('The role to automatically grant when members join using this invite')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove an invite code role mapping')
        .addStringOption((opt) =>
          opt
            .setName('code')
            .setDescription('The invite code to remove')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('List all configured invite-to-role mappings for this server')
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      return interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
    }

    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    // -------------------------------------------------------------------------
    // SUBCOMMAND: ADD
    // -------------------------------------------------------------------------
    if (subcommand === 'add') {
      const rawCode = interaction.options.getString('code', true).trim();
      const role = interaction.options.getRole('role', true) as Role;

      // Extract raw code if full URL was provided
      const cleanCode = rawCode
        .replace(/^https?:\/\/(www\.)?(discord\.gg|discord\.com\/invite)\//i, '')
        .trim();

      const botMember = interaction.guild.members.me || (await interaction.guild.members.fetchMe().catch(() => null));
      if (!botMember || !botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return interaction.reply({
          content: '❌ I lack the **Manage Roles** permission to assign roles.',
          ephemeral: true,
        });
      }

      // Hierarchy validation
      if (botMember.roles.highest.position <= role.position) {
        return interaction.reply({
          content: `❌ I cannot assign the role **${role.name}** because it is positioned higher than or equal to my highest role in Server Settings ➔ Roles.`,
          ephemeral: true,
        });
      }

      if (role.managed) {
        return interaction.reply({
          content: `❌ The role **${role.name}** is managed by an integration/bot and cannot be assigned manually.`,
          ephemeral: true,
        });
      }

      try {
        await db.query(
          `INSERT INTO guild_invite_roles (guild_id, invite_code, role_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (guild_id, invite_code)
           DO UPDATE SET role_id = EXCLUDED.role_id, created_at = CURRENT_TIMESTAMP`,
          [guildId, cleanCode, role.id]
        );

        const embed = new EmbedBuilder()
          .setColor('#10B981')
          .setTitle('✅ Invite Role Configured')
          .setDescription(`Members joining via invite **\`${cleanCode}\`** will automatically receive <@&${role.id}>!`)
          .addFields(
            { name: 'Invite Code', value: `\`${cleanCode}\` ([discord.gg/${cleanCode}](https://discord.gg/${cleanCode}))`, inline: true },
            { name: 'Role Granted', value: `<@&${role.id}>`, inline: true }
          )
          .setFooter({ text: 'SRB NEXUS Invite Tracking Engine' })
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      } catch (err: any) {
        logger.error({ err }, `[INVITE-ROLE] Failed to add mapping for guild ${guildId}`);
        return interaction.reply({
          content: `❌ Database error while saving mapping: ${err.message}`,
          ephemeral: true,
        });
      }
    }

    // -------------------------------------------------------------------------
    // SUBCOMMAND: REMOVE
    // -------------------------------------------------------------------------
    if (subcommand === 'remove') {
      const rawCode = interaction.options.getString('code', true).trim();
      const cleanCode = rawCode
        .replace(/^https?:\/\/(www\.)?(discord\.gg|discord\.com\/invite)\//i, '')
        .trim();

      try {
        const res = await db.query(
          `DELETE FROM guild_invite_roles WHERE guild_id = $1 AND invite_code = $2 RETURNING *`,
          [guildId, cleanCode]
        );

        if (res.rowCount === 0) {
          return interaction.reply({
            content: `⚠️ No role mapping found for invite code **\`${cleanCode}\`**.`,
            ephemeral: true,
          });
        }

        return interaction.reply({
          content: `🗑️ Successfully removed role mapping for invite code **\`${cleanCode}\`**.`,
        });
      } catch (err: any) {
        logger.error({ err }, `[INVITE-ROLE] Failed to remove mapping for guild ${guildId}`);
        return interaction.reply({
          content: `❌ Database error while removing mapping: ${err.message}`,
          ephemeral: true,
        });
      }
    }

    // -------------------------------------------------------------------------
    // SUBCOMMAND: LIST
    // -------------------------------------------------------------------------
    if (subcommand === 'list') {
      try {
        const res = await db.query(
          `SELECT invite_code, role_id, created_at FROM guild_invite_roles WHERE guild_id = $1 ORDER BY created_at DESC`,
          [guildId]
        );

        if (res.rows.length === 0) {
          return interaction.reply({
            content: 'ℹ️ No invite roles configured for this server yet. Use `/inviterole add` to set one up!',
            ephemeral: true,
          });
        }

        const lines = res.rows.map((row: any, idx: number) => {
          return `**${idx + 1}.** \`${row.invite_code}\` ➔ <@&${row.role_id}> ([Link](https://discord.gg/${row.invite_code}))`;
        });

        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle(`🎟️ Configured Invite Roles — ${interaction.guild.name}`)
          .setDescription(lines.join('\n'))
          .setFooter({ text: `Total: ${res.rows.length} configured mappings` })
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      } catch (err: any) {
        logger.error({ err }, `[INVITE-ROLE] Failed to list mappings for guild ${guildId}`);
        return interaction.reply({
          content: `❌ Database error while fetching mappings: ${err.message}`,
          ephemeral: true,
        });
      }
    }
  },
};
