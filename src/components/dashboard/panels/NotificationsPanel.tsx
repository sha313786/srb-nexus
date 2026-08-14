import React, { useState, useEffect } from 'react';
import { Bell, Gamepad2, Tag, Save, CheckCircle2, AlertCircle } from 'lucide-react';

interface ChannelOption {
  id: string;
  name: string;
}

interface NotificationsPanelProps {
  guildId: string;
  channels?: ChannelOption[];
}

export const NotificationsPanel: React.FC<NotificationsPanelProps> = ({
  guildId,
  channels = [],
}) => {
  const [freeGamesEnabled, setFreeGamesEnabled] = useState<boolean>(false);
  const [discountsEnabled, setDiscountsEnabled] = useState<boolean>(false);
  const [notificationsChannelId, setNotificationsChannelId] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch existing notification settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch(`/api/guilds/${guildId}/modules/notifications`);
        if (res.ok) {
          const data = await res.json();
          const s = data.settings || {};
          setFreeGamesEnabled(Boolean(s.free_games_enabled));
          setDiscountsEnabled(Boolean(s.discounts_enabled));
          setNotificationsChannelId(s.notifications_channel_id || '');
        }
      } catch (err) {
        console.error('Failed to load notification settings', err);
      }
    }
    if (guildId) loadSettings();
  }, [guildId]);

  const handleSave = async () => {
    setIsSaving(true);
    setStatusMessage(null);

    try {
      const res = await fetch(`/api/guilds/${guildId}/modules/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          free_games_enabled: freeGamesEnabled,
          discounts_enabled: discountsEnabled,
          notifications_channel_id: notificationsChannelId || null,
        }),
      });

      if (res.ok) {
        setStatusMessage({ type: 'success', text: 'Notification settings saved successfully!' });
      } else {
        setStatusMessage({ type: 'error', text: 'Failed to save notification settings.' });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Server error while saving settings.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl animate-fadeIn">
      {/* HEADER */}
      <div className="border-b border-[#232333] pb-4 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Bell className="text-purple-400" size={22} />
            Notifications & Game Alerts
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Configure automated free game announcements and deal notifications powered by NEXUS.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-lg shadow-purple-600/20 cursor-pointer"
        >
          <Save size={16} />
          {isSaving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>

      {/* STATUS BANNER */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 text-xs font-medium ${
            statusMessage.type === 'success'
              ? 'bg-purple-950/40 border-purple-500/40 text-purple-300'
              : 'bg-red-950/40 border-red-500/40 text-red-300'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 size={18} className="text-purple-400 shrink-0" />
          ) : (
            <AlertCircle size={18} className="text-red-400 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* TOGGLES PANEL */}
        <div className="bg-[#14141f] p-6 rounded-2xl border border-[#232333] space-y-6">
          <h3 className="text-sm font-bold text-purple-300 uppercase tracking-wider flex items-center gap-2">
            <Gamepad2 size={16} />
            Alert Subscriptions
          </h3>

          {/* FREE GAMES TOGGLE */}
          <div className="flex items-center justify-between p-4 bg-[#0d0d12] rounded-xl border border-[#232333]">
            <div className="space-y-1">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Gamepad2 size={14} className="text-purple-400" />
                100% Free Games Alerts
              </span>
              <p className="text-[11px] text-gray-400">
                Notify your server when Steam, Epic Games, or GOG release free-to-keep games.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={freeGamesEnabled}
                onChange={(e) => setFreeGamesEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#1c1c2b] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          {/* DISCOUNTS TOGGLE */}
          <div className="flex items-center justify-between p-4 bg-[#0d0d12] rounded-xl border border-[#232333]">
            <div className="space-y-1">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Tag size={14} className="text-purple-400" />
                Major Discounts & Deals
              </span>
              <p className="text-[11px] text-gray-400">
                Post notifications whenever massive seasonal sales or price drops go live.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={discountsEnabled}
                onChange={(e) => setDiscountsEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#1c1c2b] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>
        </div>

        {/* TARGET CHANNEL SELECTOR */}
        <div className="bg-[#14141f] p-6 rounded-2xl border border-[#232333] space-y-4">
          <h3 className="text-sm font-bold text-purple-300 uppercase tracking-wider flex items-center gap-2">
            <Bell size={16} />
            Target Channel
          </h3>

          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-300">Announcement Channel</label>
            <select
              value={notificationsChannelId}
              onChange={(e) => setNotificationsChannelId(e.target.value)}
              className="w-full bg-[#0d0d12] border border-[#2e2e42] rounded-xl px-4 py-2.5 text-xs text-gray-200 focus:outline-none focus:border-purple-500"
            >
              <option value="">Disabled (Select a Channel)</option>
              {channels.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  #{ch.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-500 mt-1">
              Select where NEXUS will send automated notifications when deal updates are discovered.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationsPanel;