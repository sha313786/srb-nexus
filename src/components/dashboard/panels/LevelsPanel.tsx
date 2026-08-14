import React, { useState, useEffect } from 'react';
import { Award, Zap, Bell, Plus, Trash2, Save, CheckCircle2, AlertCircle } from 'lucide-react';

interface ChannelOption {
  id: string;
  name: string;
}

interface RoleOption {
  id: string;
  name: string;
}

interface RoleReward {
  level: number;
  roleId: string;
}

interface LevelsPanelProps {
  guildId: string;
  channels?: ChannelOption[];
  roles?: RoleOption[];
}

export const LevelsPanel: React.FC<LevelsPanelProps> = ({
  guildId,
  channels = [],
  roles = [],
}) => {
  const [levelUpChannelId, setLevelUpChannelId] = useState<string>('current');
  const [levelMessage, setLevelMessage] = useState<string>('GG {user}, you have reached **Level {level}**! 🎉');
  const [xpRate, setXpRate] = useState<number>(1.0);
  const [roleRewards, setRoleRewards] = useState<RoleReward[]>([]);
  
  // New reward inputs
  const [newRewardLevel, setNewRewardLevel] = useState<number>(5);
  const [newRewardRoleId, setNewRewardRoleId] = useState<string>('');

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch existing level settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch(`/api/guilds/${guildId}/modules/levels`);
        if (res.ok) {
          const data = await res.json();
          const s = data.settings || {};
          setLevelUpChannelId(s.levelup_channel_id || 'current');
          setLevelMessage(s.level_message || 'GG {user}, you have reached **Level {level}**! 🎉');
          setXpRate(s.xp_rate || 1.0);
          setRoleRewards(s.role_rewards || []);
        }
      } catch (err) {
        console.error('Failed to load levels settings', err);
      }
    }
    if (guildId) loadSettings();
  }, [guildId]);

  const handleAddReward = () => {
    if (!newRewardRoleId || newRewardLevel < 1) return;
    
    // Prevent duplicates for the same level
    if (roleRewards.some((r) => r.level === newRewardLevel)) {
      setStatusMessage({ type: 'error', text: `A role reward for Level ${newRewardLevel} already exists.` });
      return;
    }

    setRoleRewards([...roleRewards, { level: newRewardLevel, roleId: newRewardRoleId }].sort((a, b) => a.level - b.level));
    setNewRewardRoleId('');
    setStatusMessage(null);
  };

  const handleRemoveReward = (level: number) => {
    setRoleRewards(roleRewards.filter((r) => r.level !== level));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setStatusMessage(null);

    try {
      const res = await fetch(`/api/guilds/${guildId}/modules/levels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          levelup_channel_id: levelUpChannelId,
          level_message: levelMessage,
          xp_rate: xpRate,
          role_rewards: roleRewards,
        }),
      });

      if (res.ok) {
        setStatusMessage({ type: 'success', text: 'Leveling settings saved successfully!' });
      } else {
        setStatusMessage({ type: 'error', text: 'Failed to save leveling settings.' });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Server error while saving settings.' });
    } finally {
      setIsSaving(false);
    }
  };

  const insertVariable = (variable: string) => {
    setLevelMessage((prev) => `${prev} ${variable}`);
  };

  return (
    <div className="space-y-6 max-w-5xl animate-fadeIn">
      {/* HEADER */}
      <div className="border-b border-[#232333] pb-4 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Award className="text-purple-400" size={22} />
            Leveling & XP System
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Configure XP gain rates, level-up notifications, and automated role rewards.
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
        {/* LEFT COLUMN: ANNOUNCEMENT SETTINGS & XP RATE */}
        <div className="space-y-6">
          {/* XP RATE MULTIPLIER */}
          <div className="bg-[#14141f] p-6 rounded-2xl border border-[#232333] space-y-4">
            <h3 className="text-sm font-bold text-purple-300 uppercase tracking-wider flex items-center gap-2">
              <Zap size={16} />
              XP Multiplier Rate
            </h3>

            <div className="space-y-2">
              <div className="flex justify-between text-xs text-gray-300">
                <span>XP Gain Speed</span>
                <span className="font-mono text-purple-400 font-bold">{xpRate}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="3.0"
                step="0.25"
                value={xpRate}
                onChange={(e) => setXpRate(parseFloat(e.target.value))}
                className="w-full accent-purple-600 bg-[#0d0d12] h-2 rounded-lg cursor-pointer"
              />
              <p className="text-[11px] text-gray-500">
                Adjust how fast members gain XP per text message.
              </p>
            </div>
          </div>

          {/* ANNOUNCEMENT CHANNEL & MESSAGE */}
          <div className="bg-[#14141f] p-6 rounded-2xl border border-[#232333] space-y-4">
            <h3 className="text-sm font-bold text-purple-300 uppercase tracking-wider flex items-center gap-2">
              <Bell size={16} />
              Level-Up Announcements
            </h3>

            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-300">Announcement Destination</label>
              <select
                value={levelUpChannelId}
                onChange={(e) => setLevelUpChannelId(e.target.value)}
                className="w-full bg-[#0d0d12] border border-[#2e2e42] rounded-xl px-4 py-2.5 text-xs text-gray-200 focus:outline-none focus:border-purple-500"
              >
                <option value="current">Current Channel (Where member spoke)</option>
                <option value="dm">Direct Message (DM)</option>
                <option value="disabled">Disabled (Silent Leveling)</option>
                {channels.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    #{ch.name}
                  </option>
                ))}
              </select>
            </div>

            {/* VARIABLE TAGS */}
            <div className="space-y-2 pt-2">
              <label className="text-xs font-medium text-gray-300">Level-Up Message</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {[
                  { tag: '{user}', desc: 'User mention' },
                  { tag: '{level}', desc: 'New Level' },
                  { tag: '{xp}', desc: 'Total XP' },
                ].map((item) => (
                  <button
                    key={item.tag}
                    type="button"
                    onClick={() => insertVariable(item.tag)}
                    className="bg-[#1c1c2b] hover:bg-purple-600/30 border border-[#2e2e42] hover:border-purple-500/50 text-purple-300 px-2 py-0.5 rounded-lg text-[10px] font-mono transition-all cursor-pointer"
                  >
                    {item.tag}
                  </button>
                ))}
              </div>

              <textarea
                rows={3}
                value={levelMessage}
                onChange={(e) => setLevelMessage(e.target.value)}
                className="w-full bg-[#0d0d12] border border-[#2e2e42] rounded-xl p-3 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: ROLE REWARDS */}
        <div className="bg-[#14141f] p-6 rounded-2xl border border-[#232333] space-y-6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-purple-300 uppercase tracking-wider flex items-center gap-2 mb-4">
              <Award size={16} />
              Role Rewards
            </h3>

            {/* ADD NEW REWARD ROW */}
            <div className="p-3 bg-[#0d0d12] rounded-xl border border-[#232333] space-y-3 mb-4">
              <p className="text-[11px] font-semibold text-gray-400">Add Level Reward</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  placeholder="Lvl"
                  value={newRewardLevel}
                  onChange={(e) => setNewRewardLevel(parseInt(e.target.value) || 1)}
                  className="w-16 bg-[#14141f] border border-[#2e2e42] rounded-lg px-2 py-1.5 text-xs text-white text-center focus:outline-none focus:border-purple-500"
                />
                <select
                  value={newRewardRoleId}
                  onChange={(e) => setNewRewardRoleId(e.target.value)}
                  className="flex-1 bg-[#14141f] border border-[#2e2e42] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="">Select Role...</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      @{r.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddReward}
                  className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer shrink-0"
                >
                  <Plus size={14} /> Add
                </button>
              </div>
            </div>

            {/* REWARDS LIST */}
            <div className="space-y-2 max-h-[260px] overflow-y-auto custom-scrollbar pr-1">
              {roleRewards.length === 0 ? (
                <div className="text-center py-8 text-xs text-gray-500 border border-dashed border-[#232333] rounded-xl">
                  No role rewards configured yet.
                </div>
              ) : (
                roleRewards.map((reward) => {
                  const roleObj = roles.find((r) => r.id === reward.roleId);
                  return (
                    <div
                      key={reward.level}
                      className="flex items-center justify-between p-3 bg-[#0d0d12] rounded-xl border border-[#232333]"
                    >
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 bg-purple-600/20 text-purple-400 border border-purple-500/30 font-bold text-[11px] rounded-md font-mono">
                          Lvl {reward.level}
                        </span>
                        <span className="text-xs font-semibold text-gray-200">
                          @{roleObj ? roleObj.name : reward.roleId}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveReward(reward.level)}
                        className="text-gray-500 hover:text-red-400 p-1 transition-colors"
                        title="Remove Reward"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LevelsPanel;