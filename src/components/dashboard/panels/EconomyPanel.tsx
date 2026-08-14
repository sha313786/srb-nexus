import React, { useState, useEffect } from 'react';
import { Coins, DollarSign, Gift, Save, CheckCircle2, AlertCircle } from 'lucide-react';

interface EconomyPanelProps {
  guildId: string;
}

export const EconomyPanel: React.FC<EconomyPanelProps> = ({ guildId }) => {
  const [currencySymbol, setCurrencySymbol] = useState<string>('🪙');
  const [dailyReward, setDailyReward] = useState<number>(100);
  const [workMinReward, setWorkMinReward] = useState<number>(20);
  const [workMaxReward, setWorkMaxReward] = useState<number>(80);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch(`/api/guilds/${guildId}/modules/economy`);
        if (res.ok) {
          const data = await res.json();
          const s = data.settings || {};
          setCurrencySymbol(s.currency_symbol || '🪙');
          setDailyReward(s.daily_reward ?? 100);
          setWorkMinReward(s.work_min_reward ?? 20);
          setWorkMaxReward(s.work_max_reward ?? 80);
        }
      } catch (err) {
        console.error('Failed to load economy settings', err);
      }
    }
    if (guildId) loadSettings();
  }, [guildId]);

  const handleSave = async () => {
    setIsSaving(true);
    setStatusMessage(null);

    try {
      const res = await fetch(`/api/guilds/${guildId}/modules/economy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currency_symbol: currencySymbol,
          daily_reward: dailyReward,
          work_min_reward: workMinReward,
          work_max_reward: workMaxReward,
        }),
      });

      if (res.ok) {
        setStatusMessage({ type: 'success', text: 'Economy settings saved successfully!' });
      } else {
        setStatusMessage({ type: 'error', text: 'Failed to save economy settings.' });
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
            <Coins className="text-purple-400" size={22} />
            Economy & Server Currency
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Customize server currency symbols, daily streak payouts, and min/max work income.
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
            <DollarSign size={16} /> Currency Settings
          </h3>

          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-300">Currency Symbol / Emoji</label>
            <input
              type="text"
              value={currencySymbol}
              onChange={(e) => setCurrencySymbol(e.target.value)}
              className="w-full bg-[#0d0d12] border border-[#2e2e42] rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        <div className="bg-[#14141f] p-6 rounded-2xl border border-[#232333] space-y-4">
          <h3 className="text-sm font-bold text-purple-300 uppercase tracking-wider flex items-center gap-2">
            <Gift size={16} /> Rewards & Payouts
          </h3>

          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-300">Daily Reward Payout</label>
            <input
              type="number"
              value={dailyReward}
              onChange={(e) => setDailyReward(parseInt(e.target.value) || 0)}
              className="w-full bg-[#0d0d12] border border-[#2e2e42] rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-300">Min Work Pay</label>
              <input
                type="number"
                value={workMinReward}
                onChange={(e) => setWorkMinReward(parseInt(e.target.value) || 0)}
                className="w-full bg-[#0d0d12] border border-[#2e2e42] rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-300">Max Work Pay</label>
              <input
                type="number"
                value={workMaxReward}
                onChange={(e) => setWorkMaxReward(parseInt(e.target.value) || 0)}
                className="w-full bg-[#0d0d12] border border-[#2e2e42] rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EconomyPanel;