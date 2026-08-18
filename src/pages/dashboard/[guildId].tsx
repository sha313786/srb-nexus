// Path: src/pages/dashboard/[guildId].tsx
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

// Custom Dashboard Panels and Layout
import NexusDashboard from '../../components/dashboard/NexusDashboard';
import { OverviewPanel } from '../../components/dashboard/panels/OverviewPanel';
import ModerationPanel from '../../components/dashboard/panels/ModerationPanel';
import NotificationsPanel from '../../components/dashboard/panels/NotificationsPanel';
import LevelsPanel from '../../components/dashboard/panels/LevelsPanel';

export default function GuildDashboardPage() {
  const router = useRouter();
  const { guildId } = router.query;

  const [activeTab, setActiveTab] = useState<string>('overview');
  const [channels, setChannels] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!guildId) return;

    async function fetchGuildData() {
      try {
        const res = await fetch(`/api/guilds/${guildId}/data`);
        if (res.ok) {
          const data = await res.json();
          setChannels(data.channels || []);
          setRoles(data.roles || []);
        }
      } catch (err) {
        console.error('Failed to fetch guild channels/roles:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchGuildData();
  }, [guildId]);

  if (loading || !guildId) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#0d0d12] text-purple-400">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold tracking-wider">LOADING NEXUS...</span>
        </div>
      </div>
    );
  }

  const currentGuildId = Array.isArray(guildId) ? guildId[0] : guildId;

  return (
    <NexusDashboard activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'overview' && <OverviewPanel guildId={currentGuildId} />}

      {activeTab === 'moderation' && (
        <ModerationPanel guildId={currentGuildId} channels={channels} />
      )}

      {activeTab === 'notifications' && (
        <NotificationsPanel guildId={currentGuildId} channels={channels} />
      )}

      {activeTab === 'levels' && (
        <LevelsPanel guildId={currentGuildId} channels={channels} roles={roles} />
      )}
    </NexusDashboard>
  );
}