import React from 'react';

export interface NavItemProps {
  /** Lucide icon element or SVG React node */
  icon: React.ReactNode;
  /** Label displayed in the navigation item */
  label: string;
  /** Whether the current item is selected */
  active: boolean;
  /** Click handler to change active tab */
  onClick: () => void;
  /** Optional badge text or counter (e.g. "NEW", "3") */
  badge?: string;
}

export const NavItem: React.FC<NavItemProps> = ({
  icon,
  label,
  active,
  onClick,
  badge,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 ease-in-out select-none cursor-pointer ${
        active
          ? 'bg-purple-600/20 text-purple-300 font-semibold border border-purple-500/40 shadow-sm shadow-purple-500/10'
          : 'text-gray-400 hover:bg-[#1c1c2b] hover:text-gray-200 border border-transparent'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span
          className={`shrink-0 transition-colors duration-150 ${
            active ? 'text-purple-400' : 'text-gray-400 group-hover:text-gray-200'
          }`}
        >
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </div>

      {badge && (
        <span
          className={`ml-2 px-1.5 py-0.5 text-[9px] font-bold rounded-md uppercase tracking-wider ${
            active
              ? 'bg-purple-500/30 text-purple-200 border border-purple-400/30'
              : 'bg-[#232333] text-gray-400 group-hover:text-gray-300'
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
};

export default NavItem;