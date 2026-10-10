import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';
import { db } from '../../core/database';

const ROB_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
const robCooldowns = new Map<string, number>();

export const robCommand = {
  data: new SlashCommandBuilder()
    .setName('nexus-rob')
    .setDescription('Attempt a risky heist on another member’s wallet balance')
    .addUserOption((opt) =>
      opt.setName('target').setDescription('Member you want to rob').setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const targetUser = interaction.options.getUser('target', true);

    if (targetUser.id === interaction.user.id) {
      return interaction.reply({ content: '❌ You cannot rob yourself!', ephemeral: true });
    }

    if (targetUser.bot) {
      return interaction.reply({ content: '❌ Discord bots are protected by federal cybersecurity vaults!', ephemeral: true });
    }

    // Cooldown check
    const lastRob = robCooldowns.get(interaction.user.id) || 0;
    const now = Date.now();
    if (now - lastRob < ROB_COOLDOWN_MS) {
      const remainingSec = Math.ceil((ROB_COOLDOWN_MS - (now - lastRob)) / 1000);
      const remainingMin = Math.ceil(remainingSec / 60);
      return interaction.reply({
        content: `⏳ Police are actively patrolling your area! You can attempt another heist in **${remainingMin} minutes**.`,
        ephemeral: true,
      });
    }

    const [robberRes, targetRes] = await Promise.all([
      db.query(`SELECT balance FROM user_economy WHERE guild_id = $1 AND user_id = $2`, [interaction.guild.id, interaction.user.id]),
      db.query(`SELECT balance FROM user_economy WHERE guild_id = $1 AND user_id = $2`, [interaction.guild.id, targetUser.id]),
    ]);

    const robberBal = Number(robberRes.rows[0]?.balance || 0);
    const targetBal = Number(targetRes.rows[0]?.balance || 0);

    if (targetBal < 100) {
      return interaction.reply({
        content: `❌ <@${targetUser.id}> only has **${targetBal}** coins! They are protected by poverty immunity (requires at least 100 coins).`,
        ephemeral: true,
      });
    }

    if (robberBal < 250) {
      return interaction.reply({
        content: `❌ You must have at least **250** coins in your wallet to cover potential police fines before attempting a robbery!`,
        ephemeral: true,
      });
    }

    robCooldowns.set(interaction.user.id, now);

    const success = Math.random() < 0.45; // 45% success rate

    if (success) {
      const stealPercentage = (Math.floor(Math.random() * 25) + 10) / 100; // 10% to 35%
      const stolen = Math.max(50, Math.floor(targetBal * stealPercentage));

      await Promise.all([
        db.query(`UPDATE user_economy SET balance = balance + $1 WHERE guild_id = $2 AND user_id = $3`, [stolen, interaction.guild.id, interaction.user.id]),
        db.query(`UPDATE user_economy SET balance = GREATEST(0, balance - $1) WHERE guild_id = $2 AND user_id = $3`, [stolen, interaction.guild.id, targetUser.id]),
      ]);

      const embed = new EmbedBuilder()
        .setColor('#10B981')
        .setTitle('🥷 HEIST SUCCESSFUL!')
        .setDescription(`You silently pickpocketed <@${targetUser.id}> and got away with **${stolen.toLocaleString()}** coins! 💰`)
        .setFooter({ text: 'SRB NEXUS Virtual Economy' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    } else {
      const fine = Math.min(robberBal, Math.floor(Math.random() * 200) + 200); // 200-400 coins fine

      await Promise.all([
        db.query(`UPDATE user_economy SET balance = GREATEST(0, balance - $1) WHERE guild_id = $2 AND user_id = $3`, [fine, interaction.guild.id, interaction.user.id]),
        db.query(`UPDATE user_economy SET balance = balance + $1 WHERE guild_id = $2 AND user_id = $3`, [fine, interaction.guild.id, targetUser.id]),
      ]);

      const embed = new EmbedBuilder()
        .setColor('#EF4444')
        .setTitle('🚨 BUSTED BY THE POLICE!')
        .setDescription(`You tripped an alarm while trying to rob <@${targetUser.id}>! You were fined **${fine.toLocaleString()}** coins and paid it directly to the victim as compensation! 🚔`)
        .setFooter({ text: 'SRB NEXUS Virtual Economy' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }
  },
};
