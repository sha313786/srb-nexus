import {
  Guild,
  TextChannel,
  User,
  EmbedBuilder,
  AttachmentBuilder,
  ChannelType,
} from 'discord.js';
import { db } from '../core/database';
import { logger } from '../core/logger';
import { broadcastLiveNotification } from './liveNotifications';

export async function archiveAndSendTicketTranscript(
  guild: Guild,
  channel: TextChannel,
  closedBy: User
): Promise<{ success: boolean; messageCount: number; transcriptChannelName?: string }> {
  try {
    // 1. Fetch ticket details from DB
    const ticketRes = await db.query(
      `SELECT user_id, ticket_type, project_type, timeline, budget, details, created_at 
       FROM guild_tickets 
       WHERE channel_id = $1 
       LIMIT 1`,
      [channel.id]
    ).catch(() => null);

    const ticketData = ticketRes?.rows?.[0];
    const ticketUserId = ticketData?.user_id;

    // 2. Fetch messages in the ticket channel (up to 100 messages)
    const fetchedMessages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
    const messages = fetchedMessages ? Array.from(fetchedMessages.values()).reverse() : [];

    // 3. Generate clean formatted text transcript
    let transcriptText = `================================================================================\n`;
    transcriptText += `                       SRB NEXUS OFFICIAL TICKET TRANSCRIPT                     \n`;
    transcriptText += `================================================================================\n`;
    transcriptText += `Server:         ${guild.name} (${guild.id})\n`;
    transcriptText += `Channel:        #${channel.name} (${channel.id})\n`;
    transcriptText += `Ticket Type:    ${ticketData?.ticket_type || 'SUPPORT_TICKET'}\n`;
    if (ticketData?.project_type) transcriptText += `Project/Subject: ${ticketData.project_type}\n`;
    if (ticketData?.budget) transcriptText += `Budget:         ${ticketData.budget}\n`;
    if (ticketData?.timeline) transcriptText += `Timeline:       ${ticketData.timeline}\n`;
    transcriptText += `Client ID:      ${ticketUserId || 'Unknown'}\n`;
    transcriptText += `Closed By:      ${closedBy.tag} (${closedBy.id})\n`;
    transcriptText += `Created At:     ${ticketData?.created_at ? new Date(ticketData.created_at).toUTCString() : 'Unknown'}\n`;
    transcriptText += `Closed At:      ${new Date().toUTCString()}\n`;
    transcriptText += `Total Messages: ${messages.length}\n`;
    transcriptText += `================================================================================\n\n`;

    for (const msg of messages) {
      const timeStr = msg.createdAt ? msg.createdAt.toISOString().replace('T', ' ').substring(0, 19) : '';
      const authorStr = `${msg.author?.tag || 'Unknown'} [${msg.author?.id || '0'}]`;
      transcriptText += `[${timeStr}] ${authorStr}:\n`;
      if (msg.content) {
        transcriptText += `${msg.content}\n`;
      }
      if (msg.embeds && msg.embeds.length > 0) {
        for (const emb of msg.embeds) {
          transcriptText += `  [EMBED] ${emb.title || ''} - ${emb.description || ''}\n`;
        }
      }
      if (msg.attachments && msg.attachments.size > 0) {
        for (const [_, att] of msg.attachments) {
          transcriptText += `  [ATTACHMENT] ${att.url} (${att.name})\n`;
        }
      }
      transcriptText += `\n--------------------------------------------------------------------------------\n\n`;
    }

    const transcriptBuffer = Buffer.from(transcriptText, 'utf-8');
    const fileName = `transcript-${channel.name}-${Date.now()}.txt`;
    const attachment = new AttachmentBuilder(transcriptBuffer, { name: fileName });

    // 4. Resolve transcript channel from DB or search guild
    const settingsRes = await db.query(
      `SELECT transcript_channel_id FROM guild_settings WHERE guild_id = $1`,
      [guild.id]
    ).catch(() => null);

    const configuredTranscriptId = settingsRes?.rows?.[0]?.transcript_channel_id;

    let transcriptChannel: TextChannel | null = null;
    if (configuredTranscriptId && guild.channels.cache.has(configuredTranscriptId)) {
      transcriptChannel = guild.channels.cache.get(configuredTranscriptId) as TextChannel;
    } else {
      transcriptChannel = guild.channels.cache.find(
        (c) => c.isTextBased() && (c.name.includes('ticket-transcripts') || c.name.includes('transcript'))
      ) as TextChannel | null;

      if (transcriptChannel) {
        // Cache in DB for future requests
        await db.query(
          `UPDATE guild_settings SET transcript_channel_id = $1 WHERE guild_id = $2`,
          [transcriptChannel.id, guild.id]
        ).catch(() => {});
      }
    }

    // 5. Send transcript to staff transcripts channel
    if (transcriptChannel && 'send' in transcriptChannel) {
      const transcriptEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`📄 Ticket Transcript Archive — #${channel.name}`)
        .setDescription(
          `A support ticket in **${guild.name}** was closed and archived.\n\n` +
          `• **Ticket Channel:** \`#${channel.name}\`\n` +
          `• **Ticket Type:** \`${ticketData?.ticket_type || 'SUPPORT'}\`\n` +
          (ticketData?.project_type ? `• **Subject / Topic:** \`${ticketData.project_type}\`\n` : '') +
          `• **Client:** ${ticketUserId ? `<@${ticketUserId}>` : '*Unknown*'}\n` +
          `• **Closed By:** <@${closedBy.id}> (${closedBy.tag})\n` +
          `• **Messages Recorded:** \`${messages.length}\``
        )
        .setFooter({ text: 'SRB NEXUS Automated Transcript Archive' })
        .setTimestamp();

      await transcriptChannel.send({
        embeds: [transcriptEmbed],
        files: [attachment],
      });
      logger.info(`[TRANSCRIPT] Successfully archived #${channel.name} to #${transcriptChannel.name}`);
    } else {
      logger.warn(`[TRANSCRIPT] No valid transcript channel found for guild ${guild.id}`);
    }

    // 6. Direct Message (DM) the Client their transcript copy
    if (ticketUserId) {
      const clientUser = await guild.client.users.fetch(ticketUserId).catch(() => null);
      if (clientUser) {
        const dmAttachment = new AttachmentBuilder(transcriptBuffer, { name: fileName });
        const dmEmbed = new EmbedBuilder()
          .setColor('#10B981')
          .setTitle(`📄 Your Ticket Transcript — #${channel.name}`)
          .setDescription(
            `Hello <@${ticketUserId}>! Your support ticket in **${guild.name}** has been closed.\n\n` +
            `Attached is your complete official transcript archive for your records.`
          )
          .setFooter({ text: `${guild.name} Support Team` })
          .setTimestamp();

        await clientUser.send({
          embeds: [dmEmbed],
          files: [dmAttachment],
        }).catch(() => {});
      }
    }

    // 7. Update database record
    await db.query(
      `UPDATE guild_tickets SET status = 'CLOSED', closed_at = NOW() WHERE channel_id = $1`,
      [channel.id]
    ).catch(() => {});

    // 8. Broadcast live alert to dashboard
    broadcastLiveNotification(guild.client, guild.id, {
      type: 'ticket',
      title: 'Support Ticket Closed & Archived',
      description: `Ticket **#${channel.name}** closed by <@${closedBy.id}>. Transcript saved (${messages.length} messages).`,
      severity: 'info',
      fields: [
        { name: 'Channel', value: `#${channel.name}`, inline: true },
        { name: 'Messages', value: `${messages.length}`, inline: true },
      ],
    }).catch(() => {});

    return {
      success: true,
      messageCount: messages.length,
      transcriptChannelName: transcriptChannel?.name,
    };
  } catch (err) {
    logger.error({ err }, 'Error in archiveAndSendTicketTranscript');
    return { success: false, messageCount: 0 };
  }
}
