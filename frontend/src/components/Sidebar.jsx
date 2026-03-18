import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Hexagon, History, Bell, Thermometer, MapPin, Download, Settings, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const baseLink = 'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5';

function LinkItem({ to, icon: Icon, label }) {
  return (
    <NavLink to={to} className={({ isActive }) => `${baseLink} ${isActive ? 'bg-accent/15 text-accent' : 'text-text'}`}>
      <Icon size={18} />
      <span>{label}</span>
    </NavLink>
  );
}

export default function Sidebar() {
  const { isAdmin } = useAuth();

  return (
    <aside className="w-64 shrink-0 border-r border-border bg-surface h-full flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center text-accent text-lg">🐝</div>
          <div>
            <div className="font-semibold">Beehive Monitor</div>
            <div className="text-xs text-muted">Monitoring workspace</div>
          </div>
        </div>
      </div>

      <nav className="px-3 py-4 flex-1 space-y-1 overflow-y-auto">
        <LinkItem to="/" icon={LayoutDashboard} label="Dashboard" />
        <LinkItem to="/hives" icon={Hexagon} label="Hives" />
        <LinkItem to="/history" icon={History} label="History" />
        <LinkItem to="/alerts" icon={Bell} label="Alerts" />
        <LinkItem to="/sensors" icon={Thermometer} label="Sensors" />
        <LinkItem to="/map" icon={MapPin} label="Map" />
        <LinkItem to="/export" icon={Download} label="Export" />
        <LinkItem to="/settings" icon={Settings} label="Settings" />
        {isAdmin && (
          <div className="pt-3">
            <div className="px-2 pb-1 text-xs text-muted uppercase">Admin</div>
            <LinkItem to="/admin/devices" icon={KeyRound} label="Device Keys" />
          </div>
        )}
      </nav>

      <div className="p-4 text-xs text-muted border-t border-border">
        <div>Viewer can read-only.</div>
        <div>Admin can manage hives & devices.</div>
      </div>
    </aside>
  );
}
