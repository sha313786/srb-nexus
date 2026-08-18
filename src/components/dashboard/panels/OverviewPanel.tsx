function OverviewPanel() {
    export function OverviewPanel({ guildId }: { guildId: string }) { ... }
  return (
    <div className="space-y-6 max-w-4xl">
      <h2 className="text-2xl font-bold text-white border-b border-[#272738] pb-4">Server Overview & Settings</h2>
      
      {/* BOT NICKNAME */}
      <div className="bg-[#161622] p-6 rounded-2xl border border-[#272738] space-y-4">
        <h3 className="text-lg font-semibold text-purple-300">Bot Display Name</h3>
        <p className="text-sm text-gray-400">Customize the nickname NEXUS uses inside this server.</p>
        <div className="flex gap-3">
          <input 
            type="text" 
            placeholder="SRB NEXUS" 
            className="flex-1 bg-[#0f0f17] border border-[#2e2e42] rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
          />
          <button className="bg-purple-600 hover:bg-purple-500 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-all shadow-md shadow-purple-600/20">
            Apply Name
          </button>
        </div>
      </div>

      {/* CUSTOM PREFIXES */}
      <div className="bg-[#161622] p-6 rounded-2xl border border-[#272738] space-y-4">
        <h3 className="text-lg font-semibold text-purple-300">Custom Command Prefixes</h3>
        <p className="text-sm text-gray-400">Set one or multiple prefixes for text commands.</p>
        
        <div className="flex gap-3">
          <input 
            type="text" 
            placeholder="Enter new prefix (e.g. ! or n!)" 
            className="flex-1 bg-[#0f0f17] border border-[#2e2e42] rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
          />
          <button className="bg-purple-600 hover:bg-purple-500 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-all">
            Add Prefix
          </button>
        </div>

        <div className="space-y-2 mt-4">
          {['!', 'n!', '/'].map((p) => (
            <div key={p} className="flex justify-between items-center bg-[#0f0f17] px-4 py-2 rounded-xl border border-[#272738]">
              <span className="font-mono text-purple-400 font-bold">{p}</span>
              <button className="text-red-400 hover:text-red-300 text-sm">Remove</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}