import React, { useState, useEffect } from 'react';
import { Disc, Music, Volume2, Save, CheckCircle2, AlertCircle } from 'lucide-react';

interface RoleOption {
  id: string;
  name: string;
}

interface MusicPanelProps {
  guildId: string;
  roles?: RoleOption[];
}

export const MusicPanel: React.FC<MusicPanelProps> = ({ guildId, roles = [] }) => {
  const [djRoleId, setDjRoleId] = useState<string>('');
  const [defaultVolume, setDefaultVolume] = useState<number>(80);
  const [maxQueueLength, setMaxQueueLength] = useState<number>(100);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch(`/api/guilds/${guildId}/modules/music`);
        if (res.ok) {
          const data = await res.json();
          const s = data.settings || {};
          setDjRoleId(s.dj_role_id || '');
          setDefaultVolume(s.default_volume ?? 80);
          setMaxQueueLength(s.max_queue_length ?? 100);
        }
      } catch (err) {
        console.error('Failed to load music settings', err);
      }
    }
    if (guildId) loadSettings();
  }, [guildId]);

  const handleSave = async () => {
    setIsSaving(true);
    setStatusMessage(null);

    try {
      const res = await fetch(`/api/guilds/${guildId}/modules/music`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dj_role_id: djRoleId || null,
          default_volume: defaultVolume,
          max_queue_length: maxQueueLength,
        }),
      });

      if (res.ok) {
        setStatusMessage({ type: 'success', text: 'Music settings saved successfully!' });
      } else {
        setStatusMessage({ type: 'error', text: 'Failed to save music settings.' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Server error while saving settings.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl animate-fadeIn">
      <div className="border-b border-[#232333] pb-4 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Music className="text-purple-400" size={22} />
            Music Player Configuration
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Manage audio defaults, DJ permissions, and playback queue limits.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
        >
          <Save size={16} />
          {isSaving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 text-xs font-medium ${
            statusMessage.type === 'success'
              ? 'bg-purple-950/40 border-purple-500/40 text-purple-300'
              : 'bg-red-950/40 border-red-500/40 text-red-300'
          }`}
        >
          {statusMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#14141f] p-6 rounded-2xl border border-[#232333] space-y-4">
          <h3 className="text-sm font-bold text-purple-300 uppercase tracking-wider flex items-center gap-2">
            <Disc size={16} /> Permissions & Controls
          </h3>

          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-300">DJ Role</label>
            <select
              value={djRoleId}
              onChange={(e) => setDjRoleId(e.target.value)}
              className="w-full bg-[#0d0d12] border border-[#2e2e42] rounded-xl px-4 py-2.5 text-xs text-gray-200 focus:outline-none focus:border-purple-500"
            >
              <option value="">None (Everyone can control playback)</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  @{r.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-500">
              Members with this role bypass vote-skips and control playback queues.
            </p>
          </div>
        </div>

        <div className="bg-[#14141f] p-6 rounded-2xl border border-[#232333] space-y-6">
          <h3 className="text-sm font-bold text-purple-300 uppercase tracking-wider flex items-center gap-2">
            <Volume2 size={16} /> Audio Defaults
          </h3>

          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-300">
              <span>Default Volume Level</span>
              <span className="font-mono text-purple-400 font-bold">{defaultVolume}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={defaultVolume}
              onChange={(e) => setDefaultVolume(parseInt(e.target.value))}
              className="w-full accent-purple-600 bg-[#0d0d12] h-2 rounded-lg cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-300">Max Queue Limit (Tracks)</label>
            <input
              type="number"
              min="10"
              max="500"
              value={maxQueueLength}
              onChange={(e) => setMaxQueueLength(parseInt(e.target.value) || 50)}
              className="w-full bg-[#0d0d12] border border-[#2e2e42] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MusicPanel;