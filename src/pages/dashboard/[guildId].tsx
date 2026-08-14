import React, { useState, useEffect } from 'react';
import { useRouter } from 'nextrouter';
import NexusDashboardLayout from '@componentsdashboardNexusDashboardLayout';
import OverviewPanel from '@componentsdashboardpanelsOverviewPanel';
import WelcomePanel from '@componentsdashboardpanelsWelcomePanel';
import ModerationPanel from '@componentsdashboardpanelsModerationPanel';
import NotificationsPanel from '@componentsdashboardpanelsNotificationsPanel';
import LevelsPanel from '@componentsdashboardpanelsLevelsPanel';

export default function GuildDashboardPage() {
  const router = useRouter();
  const { guildId } = router.query;

  const [activeTab, setActiveTab] = useState('overview');
  const [channels, setChannels] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() = {
    if (!guildId) return;

    async function fetchGuildData() {
      try {
        const res = await fetch(`apiguilds${guildId}data`);
        if (res.ok) {
          const data = await res.json();
          setChannels(data.channels  []);
          setRoles(data.roles  []);
        }
      } catch (err) {
        console.error('Failed to load server metadata', err);
      } finally {
        setLoading(false);
      }
    }

    fetchGuildData();
  }, [guildId]);

  if (loading  !guildId) {
    return (
      div className=flex h-screen w-full items-center justify-center bg-[#0d0d12] text-purple-400
        div className=flex items-center gap-3
          div className=w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin 
          span className=text-sm font-semibold tracking-widerLOADING NEXUS...span
        div
      div
    );
  }

  const currentGuildId = Array.isArray(guildId)  guildId[0]  guildId;

  return (
    NexusDashboardLayout activeTab={activeTab} setActiveTab={setActiveTab}
      {activeTab === 'overview' && OverviewPanel guildId={currentGuildId} }
      {activeTab === 'welcome' && (
        WelcomePanel guildId={currentGuildId} channels={channels} roles={roles} 
      )}
      {activeTab === 'moderation' && (
        ModerationPanel guildId={currentGuildId} channels={channels} 
      )}
      {activeTab === 'notifications' && (
        NotificationsPanel guildId={currentGuildId} channels={channels} 
      )}
      {activeTab === 'levels' && (
        LevelsPanel guildId={currentGuildId} channels={channels} roles={roles} 
      )}
    NexusDashboardLayout
  );
}