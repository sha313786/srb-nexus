// Path: src/components/dashboard/NexusDashboard.tsx
import React from 'react';
import { 
  Shield, Bell, MessageSquare, Wrench, Sparkles, 
  Settings, Terminal, FileText, Music, Coins, Award,
  ChevronRight, LogOut, User
} from 'lucide-react';

interface NexusDashboardProps {
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
  children?: React.ReactNode;
}

export default function NexusDashboard({ 
  activeTab = 'overview', 
  setActiveTab, 
  children 
}: NexusDashboardProps) {

  const handleTabChange = (tab: string) => {
    if (setActiveTab) {
      setActiveTab(tab);
    }
  };

  return (
    <div className="flex h-screen bg-[#0d0d12] text-gray-100 font-sans overflow-hidden">
      
      {/* 1. LEFT SIDEBAR */}
      <aside className="w-64 bg-[#14141f] border-r border-[#232333] flex flex-col justify-between select-none shrink-0">
        <div>
          {/* BRAND HEADER */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-[#232333]">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white font-extrabold text-lg shadow-lg shadow-purple-500/25">
              ⚡
            </div>
            <div>
              <h1 className="font-extrabold text-lg tracking-wider text-white">SRB NEXUS</h1>
              <p className="text-[10px] text-purple-400 font-medium tracking-wide">CONTROL PANEL</p>
            </div>
          </div>

          {/* SIDEBAR NAVIGATION */}
          <div className="p-4 space-y-6 overflow-y-auto max-h-[calc(100vh-160px)] custom-scrollbar">
            
            {/* GENERAL SETTINGS */}
            <div>
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider px-3 mb-2">Settings</p>
              <div className="space-y-1">
                <NavItem 
                  icon={<Settings size={18} />} 
                  label="Overview" 
                  active={activeTab === 'overview'} 
                  onClick={() => handleTabChange('overview')} 
                />
                <NavItem 
                  icon={<Terminal size={18} />} 
                  label="Commands" 
                  active={activeTab === 'commands'} 
                  onClick={() => handleTabChange('commands')} 
                />
                <NavItem 
                  icon={<FileText size={18} />} 
                  label="Audit Logs" 
                  active={activeTab === 'logs'} 
                  onClick={() => handleTabChange('logs')} 
                />
              </div>
            </div>

            {/* MODULES */}
            <div>
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider px-3 mb-2">Modules</p>
              <div className="space-y-1">
                <NavItem 
                  icon={<MessageSquare size={18} />} 
                  label="Welcome & Leave" 
                  active={activeTab === 'welcome'} 
                  onClick={() => handleTabChange('welcome')} 
                />
                <NavItem 
                  icon={<Shield size={18} />} 
                  label="Moderation & Automod" 
                  active={activeTab === 'moderation'} 
                  onClick={() => handleTabChange('moderation')} 
                />
                <NavItem 
                  icon={<Bell size={18} />} 
                  label="Notifications & Alerts" 
                  active={activeTab === 'notifications'} 
                  onClick={() => handleTabChange('notifications')} 
                />
                <NavItem 
                  icon={<Award size={18} />} 
                  label="Leveling & XP" 
                  active={activeTab === 'levels'} 
                  onClick={() => handleTabChange('levels')} 
                />
                <NavItem 
                  icon={<Music size={18} />} 
                  label="Music Player" 
                  active={activeTab === 'music'} 
                  onClick={() => handleTabChange('music')} 
                />
                <NavItem 
                  icon={<Coins size={18} />} 
                  label="Economy System" 
                  active={activeTab === 'economy'} 
                  onClick={() => handleTabChange('economy')} 
                />
                <NavItem 
                  icon={<Wrench size={18} />} 
                  label="Support Tickets" 
                  active={activeTab === 'tickets'} 
                  onClick={() => handleTabChange('tickets')} 
                />
              </div>
            </div>

          </div>
        </div>

        {/* BOTTOM USER / PRIME SECTION */}
        <div className="p-4 border-t border-[#232333] space-y-3">
          {/* PRIME BADGE */}
          <div className="p-3 bg-[#1c1c2b] rounded-xl border border-purple-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Sparkles className="text-purple-400 shrink-0" size={18} />
              <div>
                <p className="text-xs font-bold text-purple-300">NEXUS Prime</p>
                <p className="text-[10px] text-gray-400">Custom Branding & Audio</p>
              </div>
            </div>
            <ChevronRight size={14} className="text-gray-500" />
          </div>

          {/* USER PROFILE INFO */}
          <div className="flex items-center justify-between px-2 pt-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-purple-900/50 border border-purple-500/40 flex items-center justify-center">
                <User size={16} className="text-purple-300" />
              </div>
              <span className="text-xs font-semibold text-gray-300">Admin</span>
            </div>
            <button className="text-gray-500 hover:text-red-400 transition-colors p-1" title="Logout">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* 2. MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* TOP HEADER BAR */}
        <header className="h-16 bg-[#14141f] border-b border-[#232333] px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-gray-400">Server Dashboard</span>
            <span className="text-gray-600">/</span>
            <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">{activeTab}</span>
          </div>

          <div className="flex items-center gap-4">
            <a 
              href="/servers" 
              className="text-xs font-semibold text-gray-400 hover:text-white bg-[#1c1c2b] px-3 py-1.5 rounded-lg border border-[#2e2e42] transition-colors"
            >
              ← Back to Servers
            </a>
          </div>
        </header>

        {/* TAB CONTENT PANEL CONTAINER */}
        <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {children ? (
            children
          ) : (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-white">Server Overview</h2>
              <p className="text-sm text-gray-400">Select a module from the left menu to customize your server settings.</p>
            </div>
          )}
        </main>

      </div>
    </div>
  );
}

{/* REUSABLE SIDEBAR NAV ITEM */}
function NavItem({ 
  icon, 
  label, 
  active, 
  onClick 
}: { 
  icon: React.ReactNode; 
  label: string; 
  active: boolean; 
  onClick: () => void 
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
        active 
          ? 'bg-purple-600/20 text-purple-300 font-semibold border border-purple-500/40 shadow-sm shadow-purple-500/10' 
          : 'text-gray-400 hover:bg-[#1c1c2b] hover:text-gray-200'
      }`}
    >
      <span className={active ? 'text-purple-400' : 'text-gray-400'}>{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}