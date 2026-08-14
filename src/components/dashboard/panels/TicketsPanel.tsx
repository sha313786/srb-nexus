import React, { useState, useEffect } from 'react';
import { Ticket, Shield, FileText, Save, CheckCircle2, AlertCircle } from 'lucide-react';

interface ChannelOption {
  id: string;
  name: string;
}

interface RoleOption {
  id: string;
  name: string;
}

interface TicketsPanelProps {
  guildId: string;
  channels?: ChannelOption[];
  roles?: RoleOption[];
}

export const TicketsPanel: React.FC<TicketsPanelProps> = ({
  guildId,
  channels = [],
  roles = [],
}) => {
  const [transcriptChannelId, setTranscriptChannelId] = useState<string>('');
  const [supportRoleId, setSupportRoleId] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch(`/api/guilds/${guildId}/modules/tickets`);
        if (res.ok) {
          const data = await res.json();
          const s = data.settings || {};
          setTranscriptChannelId(s.transcript_channel_id || '');
          setSupportRoleId(s.support_role_id || '');
        }
      } catch (err) {
        console.error('Failed to load tickets settings', err);
      }
    }
    if (guildId) loadSettings();
  }, [guildId]);

  const handleSave = async () => {
    setIsSaving(true);
    setStatusMessage(null);

    try {
      const res = await fetch(`/api/guilds/${guildId}/modules/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript_channel_id: transcriptChannelId || null,
          support_role_id: supportRoleId || null,
        }),
      });

      if (res.ok) {
        setStatusMessage({ type: 'success', text: 'Ticket settings saved successfully!' });
      } else {
        setStatusMessage({ type: 'error', text: 'Failed to save ticket settings.' });
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
            <Ticket className="text-purple-400" size={22} />
            Support Ticket System
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Configure support team access roles and automatic transcript saving channels.
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
            <Shield size={16} /> Staff Permissions
          </h3>

          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-300">Support Staff Role</label>
            <select
              value={supportRoleId}
              onChange={(e) => setSupportRoleId(e.target.value)}
              className="w-full bg-[#0d0d12] border border-[#2e2e42] rounded-xl px-4 py-2.5 text-xs text-gray-200 focus:outline-none focus:border-purple-500"
            >
              <option value="">Disabled (Admins only)</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  @{r.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-500">
              Users with this role automatically gain view/write access to created support tickets.
            </p>
          </div>
        </div>

        <div className="bg-[#14141f] p-6 rounded-2xl border border-[#232333] space-y-4">
          <h3 className="text-sm font-bold text-purple-300 uppercase tracking-wider flex items-center gap-2">
            <FileText size={16} /> Transcript Archives
          </h3>

          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-300">Transcript Log Channel</label>
            <select
              value={transcriptChannelId}
              onChange={(e) => setTranscriptChannelId(e.target.value)}
              className="w-full bg-[#0d0d12] border border-[#2e2e42] rounded-xl px-4 py-2.5 text-xs text-gray-200 focus:outline-none focus:border-purple-500"
            >
              <option value="">Disabled (No transcript saving)</option>
              {channels.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  #{ch.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-500">
              HTML/Text logs will be uploaded here whenever a ticket is closed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketsPanel;