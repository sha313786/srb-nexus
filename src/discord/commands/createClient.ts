import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} from 'discord.js';

const ROLES = {
  EVERYONE: '1525065834572021851',
  VERIFIED_MEMBER: '1525076439748182087',
  CLIENT: '1525076385192874024',
  VIP_CLIENT: '1525076410467614770',
  FOUNDER: '1525076160990543892',
  ADMINISTRATOR: '1525076232247705711',
  PROJECT_MANAGER: '1525111469056987268',
  DEVELOPER: '1525095643972894730',
  DESIGNER: '1525076321854685305',
  SUPPORT_TEAM: '1525111410651041973',
};

const staffRoleIds = [
  ROLES.FOUNDER,
  ROLES.ADMINISTRATOR,
  ROLES.PROJECT_MANAGER,
  ROLES.DEVELOPER,
  ROLES.DESIGNER,
  ROLES.SUPPORT_TEAM,
];

export const createClientCommand = {
  data: new SlashCommandBuilder()
    .setName('create-client')
    .setDescription('Create a dedicated private workspace channel & voice room for a client')
    .addStringOption((opt) =>
      opt
        .setName('name')
        .setDescription('Name of the client or project (e.g. Jesse Bridals)')
        .setRequired(true)
    )
    .addUserOption((opt) =>
      opt
        .setName('client')
        .setDescription('Discord user of the client to grant direct private access')
        .setRequired(false)
    )
    .addBooleanOption((opt) =>
      opt
        .setName('voice')
        .setDescription('Whether to create a private voice channel for meetings (Default: true)')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    if (interaction.guildId !== '1525065834572021851') {
      await interaction.reply({
        content: '❌ The `/create-client` command is an exclusive client workspace tool configured for **SRB Studio**.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const clientName = interaction.options.getString('name', true).trim();
    const targetUser = interaction.options.getUser('client');
    const withVoice = interaction.options.getBoolean('voice') ?? true;

    const guild = interaction.guild;
    await guild.roles.fetch();
    await guild.channels.fetch();

    // 1. Locate or create 📁 ACTIVE CLIENTS category
    let catActiveClients = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildCategory && c.name.includes('ACTIVE CLIENTS')
    ) as any;

    if (!catActiveClients) {
      catActiveClients = await guild.channels.create({
        name: '📁 ACTIVE CLIENTS',
        type: ChannelType.GuildCategory,
        position: 3,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: ROLES.VERIFIED_MEMBER, deny: [PermissionFlagsBits.ViewChannel] },
          ...staffRoleIds.map((id) => ({
            id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.EmbedLinks,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.ManageMessages,
            ],
          })),
        ],
        reason: 'Automated category for private client workspaces',
      });
    }

    const slug = clientName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const channelName = `🔒・${slug}`;

    // Permissions: hidden from everyone, other clients, visible only to staff and this client
    const overwrites: any[] = [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: ROLES.VERIFIED_MEMBER, deny: [PermissionFlagsBits.ViewChannel] },
      { id: ROLES.CLIENT, deny: [PermissionFlagsBits.ViewChannel] },
      ...staffRoleIds.map((id) => ({
        id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.AddReactions,
          PermissionFlagsBits.ManageMessages,
        ],
      })),
    ];

    if (targetUser) {
      overwrites.push({
        id: targetUser.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.AddReactions,
        ],
      });

      // Auto-assign @Client role if member doesn't have it
      try {
        const member = await guild.members.fetch(targetUser.id);
        if (member && !member.roles.cache.has(ROLES.CLIENT)) {
          await member.roles.add(ROLES.CLIENT, 'Granted client access via /create-client');
        }
      } catch (err) {
        console.warn('Could not auto-add client role:', err);
      }
    }

    // Create Text Channel
    let textChan = guild.channels.cache.find(
      (c) => c.parentId === catActiveClients.id && c.name === channelName
    ) as any;

    if (!textChan) {
      textChan = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: catActiveClients.id,
        permissionOverwrites: overwrites,
        reason: `Client workspace created by ${interaction.user.tag} for ${clientName}`,
      });
    }

    // Voice Channel if requested
    let voiceChan: any = null;
    if (withVoice) {
      const vcName = `🎙 ${clientName} Room`;
      voiceChan = guild.channels.cache.find(
        (c) => c.parentId === catActiveClients.id && c.name === vcName
      ) as any;

      if (!voiceChan) {
        voiceChan = await guild.channels.create({
          name: vcName,
          type: ChannelType.GuildVoice,
          parent: catActiveClients.id,
          permissionOverwrites: overwrites,
          reason: `Client voice workspace created by ${interaction.user.tag} for ${clientName}`,
        });
      }
    }

    // Send Welcome Embed
    const mentionText = targetUser ? `<@${targetUser.id}>` : `**${clientName} Team**`;

    const welcomeEmbed = new EmbedBuilder()
      .setTitle(`🤝 PRIVATE WORKSPACE ・ ${clientName.toUpperCase()}`)
      .setDescription(
        `Welcome ${mentionText} to your dedicated private workspace with **SRB Studio**!\n\n` +
        `This channel is private between you and our core engineering and design team.\n\n` +
        `─────────────────────────────────────\n` +
        `### 📌 Project Workspace Details\n` +
        `• **Client / Project:** ${clientName}\n` +
        `• **Dedicated PM:** <@&${ROLES.PROJECT_MANAGER}>\n` +
        `• **Engineering Leads:** <@&${ROLES.DEVELOPER}>\n` +
        `• **Design Lead:** <@&${ROLES.DESIGNER}>\n\n` +
        `### 🎯 Collaboration Flow & No-DM Policy\n` +
        `1. **Dedicated Channel:** All updates, questions, and revision notes must stay inside this channel.\n` +
        `2. **No Personal DMs:** Team members do not conduct project discussions in personal direct messages.\n` +
        `3. **Deliverables:** Staging URLs, previews, and asset links will be dropped here.\n` +
        `4. **Reviews:** We can jump into our private voice room ${voiceChan ? `<#${voiceChan.id}>` : ''} for screen sharing anytime.\n\n` +
        `*Let's build something exceptional together!*`
      )
      .setColor(0x00E5FF)
      .setFooter({ text: 'SRB Studio Private Client Workspace' })
      .setTimestamp();

    await textChan.send({ embeds: [welcomeEmbed] });

    // Respond to interaction
    const responseEmbed = new EmbedBuilder()
      .setTitle('✅ Client Workspace Created')
      .setDescription(
        `Successfully initialized private workspace for **${clientName}**!\n\n` +
        `• **Text Channel:** <#${textChan.id}>\n` +
        (voiceChan ? `• **Voice Room:** <#${voiceChan.id}>\n` : '') +
        (targetUser ? `• **Client Assigned:** <@${targetUser.id}> (Added to @Client)\n` : '• **Client:** No specific user tagged\n') +
        `• **Category:** \`📁 ACTIVE CLIENTS\``
      )
      .setColor(0x57F287);

    await interaction.editReply({ embeds: [responseEmbed] });
  },
};
