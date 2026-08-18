import React, { useState, useEffect } from 'react';
import { MessageSquare, Image, UserPlus, Save, CheckCircle2, AlertCircle } from 'lucide-react';

interface ChannelOption {
  id: string;
  name: string;
}

interface RoleOption {
  id: string;
  name: string;
}

interface WelcomePanelProps {
  guildId: string;
  channels?: ChannelOption[];
  roles?: RoleOption[];
}

export const WelcomePanel: React.FC<WelcomePanelProps> = ({
  guildId,
  channels = [],
  roles = [],
}) => {
  const [welcomeChannelId, setWelcomeChannelId] = useState<string>('');
  const [leaveChannelId, setLeaveChannelId] = useState<string>('');
  const [autoroleId, setAutoroleId] = useState<string>('');
  const [welcomeMessage, setWelcomeMessage] = useState<string>('Welcome {user} to {server}! You are member #{members}.');
  const [welcomeBgUrl, setWelcomeBgUrl] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch existing settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch(`/api/guilds/${guildId}/modules/welcome`);
        if (res.ok) {
          const data = await res.json();
          const s = data.settings || {};
          setWelcomeChannelId(s.welcome_channel_id || '');
          setLeaveChannelId(s.leave_channel_id || '');
          setAutoroleId(s.autorole_id || '');
          setWelcomeMessage(s.welcome_message || 'Welcome {user} to {server}! You are member #{members}.');
          setWelcomeBgUrl(s.welcome_bg_url || '');
        }
      } catch (err) {
        console.error('Failed to load welcome settings', err);
      }
    }
    if (guildId) loadSettings();
  }, [guildId]);

  const handleSave = async () => {
    setIsSaving(true);
    setStatusMessage(null);

    try {
      const res = await fetch(`/api/guilds/${guildId}/modules/welcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          welcome_channel_id: welcomeChannelId || null,
          leave_channel_id: leaveChannelId || null,
          autorole_id: autoroleId || null,
          welcome_message: welcomeMessage,
          welcome_bg_url: welcomeBgUrl || null,
        }),
      });

      if (res.ok) {
        setStatusMessage({ type: 'success', text: 'Welcome module settings saved successfully!' });
      } else {
        setStatusMessage({ type: 'error', text: 'Failed to save welcome settings.' });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Server error while saving settings.' });
    } finally {
      setIsSaving(false);
    }
  };

  const insertVariable = (variable: string) => {
    setWelcomeMessage((prev) => `${prev} ${variable}`);
  };

  return (
    <div className="space-y-6 max-w-5xl animate-fadeIn">
      {/* HEADER */}
      <div className="border-b border-[#232333] pb-4 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <MessageSquare className="text-purple-400" size={22} />
            Welcome & Greetings Module
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Configure join/leave messages, default roles, and greeting cards for NEXUS.
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
        {/* LEFT PANEL: CHANNELS & AUTOROLE */}
        <div className="space-y-6">
          {/* CHANNEL SELECTORS */}
          <div className="bg-[#14141f] p-6 rounded-2xl border border-[#232333] space-y-4">
            <h3 className="text-sm font-bold text-purple-300 uppercase tracking-wider">
              Target Channels
            </h3>

            {/* WELCOME CHANNEL */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-300">Welcome Channel</label>
              <select
                value={welcomeChannelId}
                onChange={(e) => setWelcomeChannelId(e.target.value)}
                className="w-full bg-[#0d0d12] border border-[#2e2e42] rounded-xl px-4 py-2.5 text-xs text-gray-200 focus:outline-none focus:border-purple-500"
              >
                <option value="">Disabled (No Welcome Message)</option>
                {channels.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    #{ch.name}
                  </option>
                ))}
              </select>
            </div>

            {/* LEAVE CHANNEL */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-300">Farewell / Leave Channel</label>
              <select
                value={leaveChannelId}
                onChange={(e) => setLeaveChannelId(e.target.value)}
                className="w-full bg-[#0d0d12] border border-[#2e2e42] rounded-xl px-4 py-2.5 text-xs text-gray-200 focus:outline-none focus:border-purple-500"
              >
                <option value="">Disabled (No Farewell Message)</option>
                {channels.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    #{ch.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* AUTOROLE & CARD IMAGE */}
          <div className="bg-[#14141f] p-6 rounded-2xl border border-[#232333] space-y-4">
            <h3 className="text-sm font-bold text-purple-300 uppercase tracking-wider flex items-center gap-2">
              <UserPlus size={16} />
              Auto Role & Greeting Card
            </h3>

            {/* AUTOROLE */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-300">Auto Assign Role on Join</label>
              <select
                value={autoroleId}
                onChange={(e) => setAutoroleId(e.target.value)}
                className="w-full bg-[#0d0d12] border border-[#2e2e42] rounded-xl px-4 py-2.5 text-xs text-gray-200 focus:outline-none focus:border-purple-500"
              >
                <option value="">None (No auto role)</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    @{role.name}
                  </option>
                ))}
              </select>
            </div>

            {/* BACKGROUND IMAGE URL */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
                <Image size={14} className="text-purple-400" />
                Custom Image Banner URL (Optional)
              </label>
              <input
                type="url"
                placeholder="https://i.imgur.com/your-image.png"
                value={welcomeBgUrl}
                onChange={(e) => setWelcomeBgUrl(e.target.value)}
                className="w-full bg-[#0d0d12] border border-[#2e2e42] rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: MESSAGE EDITOR & PREVIEW */}
        <div className="space-y-6">
          <div className="bg-[#14141f] p-6 rounded-2xl border border-[#232333] space-y-4">
            <h3 className="text-sm font-bold text-purple-300 uppercase tracking-wider">
              Welcome Message Template
            </h3>

            {/* VARIABLE BADGES */}
            <div className="flex flex-wrap gap-2">
              {[
                { tag: '{user}', desc: 'User mention' },
                { tag: '{server}', desc: 'Server name' },
                { tag: '{members}', desc: 'Member count' },
              ].map((item) => (
                <button
                  key={item.tag}
                  type="button"
                  onClick={() => insertVariable(item.tag)}
                  className="bg-[#1c1c2b] hover:bg-purple-600/30 border border-[#2e2e42] hover:border-purple-500/50 text-purple-300 px-2.5 py-1 rounded-lg text-[11px] font-mono transition-all cursor-pointer"
                  title={`Insert ${item.desc}`}
                >
                  {item.tag}
                </button>
              ))}
            </div>

            {/* TEXTAREA */}
            <textarea
              rows={6}
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              placeholder="Enter your welcome message here..."
              className="w-full bg-[#0d0d12] border border-[#2e2e42] rounded-xl p-4 text-xs text-white focus:outline-none focus:border-purple-500 font-mono leading-relaxed"
            />

            {/* LIVE PREVIEW BOX */}
            <div className="mt-4 pt-4 border-t border-[#232333]">
              <p className="text-[11px] font-bold text-gray-500 uppercase mb-2">Live Message Preview</p>
              <div className="p-4 bg-[#0d0d12] rounded-xl border border-purple-500/20 text-xs text-gray-200 leading-relaxed font-sans">
                {welcomeMessage
                  ? welcomeMessage
                      .replace(/\{user\}/g, '@NewMember')
                      .replace(/\{server\}/g, 'NEXUS Community')
                      .replace(/\{members\}/g, '1,284')
                  : 'No welcome message configured.'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomePanel;