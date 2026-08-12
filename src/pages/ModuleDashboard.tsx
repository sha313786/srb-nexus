import React, { useState, useEffect, ChangeEvent } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

type ActiveTab = 'welcome' | 'moderation' | 'levels' | 'music' | 'economy' | 'tickets';

interface Channel {
  id: string;
  name: string;
}

interface Role {
  id: string;
  name: string;
}

export const ModuleDashboard: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const [activeTab, setActiveTab] = useState<ActiveTab>('welcome');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<Record<string, any>>({});

  // 1. Fetch Server Channels & Roles
 useEffect(() => {
  async function fetchServerData() {
    try {
      // Add type arguments to axios.get
      const res = await axios.get<{ channels?: Channel[]; roles?: Role[] }>(
        `/api/guilds/${guildId}/data`,
        { withCredentials: true }
      );
      setChannels(res.data.channels || []);
      setRoles(res.data.roles || []);
    } catch (err) {
      console.error('Failed to load channels and roles', err);
    }
  }
  if (guildId) fetchServerData();
}, [guildId]);

  // 2. Fetch Module Settings when Switching Tabs
  useEffect(() => {
  async function fetchModuleSettings() {
    setLoading(true);
    setStatusMsg(null);
    try {
      // Add type arguments to axios.get
      const res = await axios.get<{ settings?: Record<string, any> }>(
        `/api/guilds/${guildId}/modules/${activeTab}`,
        { withCredentials: true }
      );
      setFormData(res.data.settings || {});
    } catch (err) {
      console.error(`Failed to load ${activeTab} settings`, err);
      setFormData({});
    } finally {
      setLoading(false);
    }
  }
  if (guildId) fetchModuleSettings();
}, [guildId, activeTab]);
  // Handle Field Updates
  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Handle Save
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg(null);
    try {
      await axios.post(`/api/guilds/${guildId}/modules/${activeTab}`, formData, {
        withCredentials: true,
      });
      setStatusMsg('Settings saved successfully!');
    } catch (err) {
      console.error('Failed to save settings', err);
      setStatusMsg('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dashboard-container" style={{ padding: '20px', maxWidth: '900px', margin: '0 auto', color: '#fff' }}>
      <h1>Server Management</h1>

      {/* Module Tabs Navigation */}
      <div className="tab-bar" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        {(['welcome', 'moderation', 'levels', 'music', 'economy', 'tickets'] as ActiveTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 15px',
              textTransform: 'capitalize',
              backgroundColor: activeTab === tab ? '#5865F2' : '#2f3136',
              color: '#fff',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {statusMsg && (
        <div style={{ padding: '10px', marginBottom: '15px', borderRadius: '4px', backgroundColor: statusMsg.includes('success') ? '#2e7d32' : '#c62828' }}>
          {statusMsg}
        </div>
      )}

      {loading ? (
        <p>Loading module settings...</p>
      ) : (
        <form onSubmit={handleSubmit} style={{ backgroundColor: '#2f3136', padding: '20px', borderRadius: '8px' }}>
          
          {/* WELCOME / LEAVE MODULE */}
          {activeTab === 'welcome' && (
            <div>
              <h2>Welcome & Leave Configuration</h2>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px' }}>Welcome Channel:</label>
                <select
                  value={formData.welcome_channel_id || ''}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => handleChange('welcome_channel_id', e.target.value || null)}
                  style={{ width: '100%', padding: '8px' }}
                >
                  <option value="">-- None --</option>
                  {channels.map((c: Channel) => (
                    <option key={c.id} value={c.id}>#{c.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px' }}>Welcome Message:</label>
                <textarea
                  value={formData.welcome_message || ''}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => handleChange('welcome_message', e.target.value)}
                  style={{ width: '100%', height: '80px', padding: '8px' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px' }}>Leave Channel:</label>
                <select
                  value={formData.leave_channel_id || ''}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => handleChange('leave_channel_id', e.target.value || null)}
                  style={{ width: '100%', padding: '8px' }}
                >
                  <option value="">-- None --</option>
                  {channels.map((c: Channel) => (
                    <option key={c.id} value={c.id}>#{c.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px' }}>Auto-Role:</label>
                <select
                  value={formData.autorole_id || ''}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => handleChange('autorole_id', e.target.value || null)}
                  style={{ width: '100%', padding: '8px' }}
                >
                  <option value="">-- None --</option>
                  {roles.map((r: Role) => (
                    <option key={r.id} value={r.id}>@{r.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* MODERATION MODULE */}
          {activeTab === 'moderation' && (
            <div>
              <h2>Moderation Settings</h2>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px' }}>Audit Log Channel:</label>
                <select
                  value={formData.log_channel_id || ''}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => handleChange('log_channel_id', e.target.value || null)}
                  style={{ width: '100%', padding: '8px' }}
                >
                  <option value="">-- None --</option>
                  {channels.map((c: Channel) => (
                    <option key={c.id} value={c.id}>#{c.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ margin: '12px 0' }}>
                <label>
                  <input
                    type="checkbox"
                    checked={formData.anti_links || false}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('anti_links', e.target.checked)}
                  /> Block Unauthorized Links
                </label>
              </div>

              <div style={{ margin: '12px 0 16px' }}>
                <label>
                  <input
                    type="checkbox"
                    checked={formData.anti_spam || false}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('anti_spam', e.target.checked)}
                  /> Anti-Spam Auto-Mute
                </label>
              </div>
            </div>
          )}

          {/* LEVELS MODULE */}
          {activeTab === 'levels' && (
            <div>
              <h2>Leveling & XP</h2>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px' }}>Level-up Announcement Channel:</label>
                <select
                  value={formData.level_channel_id || ''}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => handleChange('level_channel_id', e.target.value || null)}
                  style={{ width: '100%', padding: '8px' }}
                >
                  <option value="">Send in same channel</option>
                  {channels.map((c: Channel) => (
                    <option key={c.id} value={c.id}>#{c.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px' }}>XP Rate Multiplier:</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="5.0"
                  value={formData.xp_rate ?? 1.0}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('xp_rate', parseFloat(e.target.value))}
                  style={{ width: '100%', padding: '8px' }}
                />
              </div>
            </div>
          )}

          {/* MUSIC MODULE */}
          {activeTab === 'music' && (
            <div>
              <h2>Music Settings</h2>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px' }}>DJ Role:</label>
                <select
                  value={formData.dj_role_id || ''}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => handleChange('dj_role_id', e.target.value || null)}
                  style={{ width: '100%', padding: '8px' }}
                >
                  <option value="">Everyone can use player controls</option>
                  {roles.map((r: Role) => (
                    <option key={r.id} value={r.id}>@{r.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px' }}>Default Volume (%):</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={formData.default_volume ?? 80}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('default_volume', parseInt(e.target.value, 10))}
                  style={{ width: '100%', padding: '8px' }}
                />
              </div>
            </div>
          )}

          {/* ECONOMY MODULE */}
          {activeTab === 'economy' && (
            <div>
              <h2>Economy System</h2>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px' }}>Currency Symbol / Emoji:</label>
                <input
                  type="text"
                  value={formData.currency_symbol || '🪙'}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('currency_symbol', e.target.value)}
                  style={{ width: '100%', padding: '8px' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px' }}>Daily Reward Amount:</label>
                <input
                  type="number"
                  value={formData.daily_reward ?? 100}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('daily_reward', parseInt(e.target.value, 10))}
                  style={{ width: '100%', padding: '8px' }}
                />
              </div>
            </div>
          )}

          {/* TICKETS MODULE */}
          {activeTab === 'tickets' && (
            <div>
              <h2>Support Ticket System</h2>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px' }}>Transcript Channel:</label>
                <select
                  value={formData.transcript_channel_id || ''}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => handleChange('transcript_channel_id', e.target.value || null)}
                  style={{ width: '100%', padding: '8px' }}
                >
                  <option value="">-- None --</option>
                  {channels.map((c: Channel) => (
                    <option key={c.id} value={c.id}>#{c.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px' }}>Support Staff Role:</label>
                <select
                  value={formData.support_role_id || ''}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => handleChange('support_role_id', e.target.value || null)}
                  style={{ width: '100%', padding: '8px' }}
                >
                  <option value="">-- None --</option>
                  {roles.map((r: Role) => (
                    <option key={r.id} value={r.id}>@{r.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '12px 24px',
              backgroundColor: '#5865F2',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
            }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      )}
    </div>
  );
};