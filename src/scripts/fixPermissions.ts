import {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
} from 'discord.js';
import * as dotenv from 'dotenv';
dotenv.config();

const GUILD_ID = '1525065834572021851';

async function main() {
  console.log('🔧 Starting Permissions Fix to Hide No-Access Channels...');

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(process.env.DISCORD_TOKEN);

  const guild = await client.guilds.fetch(GUILD_ID);
  const channels = await guild.channels.fetch();
  const roles = await guild.roles.fetch();

  const verifiedRole = roles.get('1525076439748182087'); // ✅ Verified Member
  if (!verifiedRole) throw new Error('Verified role not found');

  const staffRoleIds = [
    '1525076160990543892', // Founder
    '1525076232247705711', // Administrator
    '1525111469056987268', // Project Manager
    '1525111410651041973', // Support Team
    '1525095643972894730', // Developer
    '1525076321854685305', // Designer
  ];
  const clientRoleIds = [
    '1525076385192874024', // Client
    '1525076410467614770', // VIP Client
  ];

  const staffAllows = staffRoleIds.map((id) => ({
    id,
    allow: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.AddReactions,
      PermissionFlagsBits.Connect,
      PermissionFlagsBits.Speak,
    ],
  }));

  // 1. FIX CATEGORY: 🔒 STAFF HQ (MUST BE COMPLETELY HIDDEN)
  const catStaff = channels.get('1525072335185645589') as any;
  if (catStaff) {
    const staffCategoryOverwrites = [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: verifiedRole.id, deny: [PermissionFlagsBits.ViewChannel] },
      ...clientRoleIds.map((id) => ({ id, deny: [PermissionFlagsBits.ViewChannel] })),
      ...staffAllows,
    ];
    await catStaff.permissionOverwrites.set(staffCategoryOverwrites);
    console.log('✅ Updated permissions on category: 🔒 STAFF HQ');

    // SYNC EVERY CHANNEL IN STAFF HQ
    const staffChildren = channels.filter((c: any) => c && c.parentId === catStaff.id);
    for (const ch of staffChildren.values()) {
      if (ch) {
        await (ch as any).lockPermissions();
        console.log(`  🔒 Hidden & Synced Staff Channel: ${(ch as any).name}`);
      }
    }
  }

  // 2. FIX CATEGORY: 🎫 SUPPORT CENTER (MUST BE HIDDEN EXCEPT DYNAMIC TICKETS)
  const catSupport = channels.get('1525114945568768131') as any;
  if (catSupport) {
    const supportCategoryOverwrites = [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: verifiedRole.id, deny: [PermissionFlagsBits.ViewChannel] },
      ...clientRoleIds.map((id) => ({ id, deny: [PermissionFlagsBits.ViewChannel] })),
      ...staffAllows,
    ];
    await catSupport.permissionOverwrites.set(supportCategoryOverwrites);
    console.log('✅ Updated permissions on category: 🎫 SUPPORT CENTER');

    const supportChildren = channels.filter((c: any) => c && c.parentId === catSupport.id);
    for (const ch of supportChildren.values()) {
      if (!ch) continue;
      const anyCh = ch as any;
      if (anyCh.name.includes('ticket-transcripts')) {
        await anyCh.lockPermissions();
        console.log(`  🔒 Hidden & Synced Transcript Channel: ${anyCh.name}`);
      } else if (anyCh.name.includes('Support Waiting')) {
        await anyCh.permissionOverwrites.set([
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          {
            id: verifiedRole.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.Connect,
              PermissionFlagsBits.Speak,
            ],
          },
          ...staffAllows,
        ]);
        console.log(`  🎧 Allowed Voice for Waiting Room: ${anyCh.name}`);
      }
    }
  }

  // 3. FIX CATEGORY: 🎙 VOICE CHANNELS (UNLOCKED FOR VERIFIED MEMBERS - NO LOCK ICONS)
  const catVoice = channels.get('1525073203473678396') as any;
  if (catVoice) {
    const voiceCategoryOverwrites = [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: verifiedRole.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
        ],
      },
      ...clientRoleIds.map((id) => ({
        id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
        ],
      })),
      ...staffAllows,
    ];
    await catVoice.permissionOverwrites.set(voiceCategoryOverwrites);
    console.log('✅ Updated permissions on category: 🎙 VOICE CHANNELS');

    const voiceChildren = channels.filter((c: any) => c && c.parentId === catVoice.id);
    for (const ch of voiceChildren.values()) {
      if (ch) {
        await (ch as any).lockPermissions();
        console.log(`  🔊 Unlocked Voice Channel: ${(ch as any).name}`);
      }
    }
  }

  // 4. FIX CATEGORY: 💬 COMMUNITY & NETWORK (UNLOCKED CHAT FOR VERIFIED MEMBERS)
  const catCommunity = channels.get('1525072023007657994') as any;
  if (catCommunity) {
    const communityCategoryOverwrites = [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: verifiedRole.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.AddReactions,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
      ...clientRoleIds.map((id) => ({
        id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.AddReactions,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      })),
      ...staffAllows,
    ];
    await catCommunity.permissionOverwrites.set(communityCategoryOverwrites);
    console.log('✅ Updated permissions on category: 💬 COMMUNITY & NETWORK');

    const communityChildren = channels.filter((c: any) => c && c.parentId === catCommunity.id);
    for (const ch of communityChildren.values()) {
      if (ch) {
        await (ch as any).lockPermissions();
        console.log(`  💬 Unlocked Community Channel: ${(ch as any).name}`);
      }
    }
  }

  // 5. FIX CATEGORY: 🛠 DEVELOPMENT & UPDATES
  const catDev = channels.get('1525072212359381042') as any;
  if (catDev) {
    const devCategoryOverwrites = [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: verifiedRole.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
      ...clientRoleIds.map((id) => ({
        id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      })),
      ...staffAllows,
    ];
    await catDev.permissionOverwrites.set(devCategoryOverwrites);

    // project-updates is read-only announcement
    const chanUpdates = channels.get('1525072367930314883') as any;
    if (chanUpdates) {
      await chanUpdates.permissionOverwrites.set([
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: verifiedRole.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
          deny: [PermissionFlagsBits.SendMessages],
        },
        ...staffAllows,
      ]);
      console.log('  📌 Configured project-updates');
    }

    // bug-reports and feature-requests allow verified members to chat
    const chanBugs = channels.get('1525072391167017043') as any;
    if (chanBugs) {
      await chanBugs.permissionOverwrites.set([
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: verifiedRole.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
        ...staffAllows,
      ]);
      console.log('  🐞 Configured bug-reports');
    }

    const chanFeatures = channels.get('1525072419570843729') as any;
    if (chanFeatures) {
      await chanFeatures.permissionOverwrites.set([
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: verifiedRole.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
        ...staffAllows,
      ]);
      console.log('  💡 Configured feature-requests');
    }
  }

  // 6. FIX CATEGORY: 💼 CLIENT HUB
  const catClient = channels.get('1525070012887601172') as any;
  if (catClient) {
    const clientCategoryOverwrites = [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: verifiedRole.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.ReadMessageHistory,
        ],
        deny: [PermissionFlagsBits.SendMessages],
      },
      ...clientRoleIds.map((id) => ({
        id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
        deny: [PermissionFlagsBits.SendMessages],
      })),
      ...staffAllows,
    ];
    await catClient.permissionOverwrites.set(clientCategoryOverwrites);

    // Sync request-a-quote, project-inquiry, book-a-meeting
    const chanQuote = channels.get('1559108384614252666') as any;
    if (chanQuote) await chanQuote.lockPermissions();

    const chanInquiry = channels.get('1525071886214762496') as any;
    if (chanInquiry) await chanInquiry.lockPermissions();

    const chanMeeting = channels.get('1525071962437582908') as any;
    if (chanMeeting) await chanMeeting.lockPermissions();

    // client-reviews allows sending messages
    const chanReviews = channels.get('1558940011557167175') as any;
    if (chanReviews) {
      await chanReviews.permissionOverwrites.set([
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: verifiedRole.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
        ...clientRoleIds.map((id) => ({
          id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        })),
        ...staffAllows,
      ]);
    }
    console.log('✅ Updated permissions on category: 💼 CLIENT HUB');
  }

  console.log('\n🎉 ALL PERMISSIONS UPDATED AND SYNCED SUCCESSFULLY!');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Error fixing permissions:', err);
  process.exit(1);
});
