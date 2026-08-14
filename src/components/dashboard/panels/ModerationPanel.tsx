import React, { useState, useEffect } from 'react';
import { Shield, ShieldAlert, FileText, Save, CheckCircle2, AlertCircle, Link, Zap } from 'lucide-react';

interface ChannelOption {
  id: string;
  name: string;
}

interface ModerationPanelProps {
  guildId: string;
  channels?: ChannelOption[];
}

export const ModerationPanel: React.FC<ModerationPanelProps> = ({
  guildId,
  channels = [],
}) => {
  const [logChannelId, setLogChannelId] = useState<string>('');
  const [antiLinks, setAntiLinks] = useState<boolean>(false);
  const [antiSpam, setAntiSpam] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch existing moderation settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch(`/api/guilds/${guildId}/modules/moderation`);
        if (res.ok) {
          const data = await res.json();
          const s = data.settings || {};
          setLogChannelId(s.log_channel_id || '');
          setAntiLinks(Boolean(s.anti_links));
          setAntiSpam(Boolean(s.anti_spam));
        }
      } catch (err) {
        console.error('Failed to load moderation settings', err);
      }
    }
    if (guildId) loadSettings();
  }, [guildId]);

  const handleSave = async () => {
    setIsSaving(true);
    setStatusMessage(null);

    try {
      const res = await fetch(`/api/guilds/${guildId}/modules/moderation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          log_channel_id: logChannelId || null,
          anti_links: antiLinks,
          anti_spam: antiSpam,
        }),
      });

      if (res.ok) {
        setStatusMessage({ type: 'success', text: 'Moderation settings saved successfully!' });
      } else {
        setStatusMessage({ type: 'error', text: 'Failed to save moderation settings.' });
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
            <Shield className="text-purple-400" size={22} />
            Moderation & Auto-Mod
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Set up automated security filters, link protections, and action logging for NEXUS.
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
        {/* AUTOMOD MODULES */}
        <div className="bg-[#14141f] p-6 rounded-2xl border border-[#232333] space-y-6">
          <h3 className="text-sm font-bold text-purple-300 uppercase tracking-wider flex items-center gap-2">
            <ShieldAlert size={16} />
            Automated Protection
          </h3>

          {/* ANTI-LINKS TOGGLE */}
          <div className="flex items-center justify-between p-4 bg-[#0d0d12] rounded-xl border border-[#232333]">
            <div className="space-y-1">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Link size={14} className="text-purple-400" />
                Anti-Link Protection
              </span>
              <p className="text-[11px] text-gray-400">
                Automatically deletes unauthorized website links and invites sent by non-staff members.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={antiLinks}
                onChange={(e) => setAntiLinks(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#1c1c2b] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          {/* ANTI-SPAM TOGGLE */}
          <div className="flex items-center justify-between p-4 bg-[#0d0d12] rounded-xl border border-[#232333]">
            <div className="space-y-1">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Zap size={14} className="text-purple-400" />
                Anti-Spam Filter
              </span>
              <p className="text-[11px] text-gray-400">
                Detects and temp-mutes users sending repetitive messages or spamming mentions.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={antiSpam}
                onChange={(e) => setAntiSpam(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#1c1c2b] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>
        </div>

        {/* LOGGING CONFIGURATION */}
        <div className="bg-[#14141f] p-6 rounded-2xl border border-[#232333] space-y-4">
          <h3 className="text-sm font-bold text-purple-300 uppercase tracking-wider flex items-center gap-2">
            <FileText size={16} />
            Audit & Incident Logs
          </h3>

          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-300">Moderation Logging Channel</label>
            <select
              value={logChannelId}
              onChange={(e) => setLogChannelId(e.target.value)}
              className="w-full bg-[#0d0d12] border border-[#2e2e42] rounded-xl px-4 py-2.5 text-xs text-gray-200 focus:outline-none focus:border-purple-500"
            >
              <option value="">Disabled (No Logging)</option>
              {channels.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  #{ch.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-500 mt-1">
              NEXUS will send message deletion, kick, ban, and automod infraction reports to this channel.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModerationPanel;