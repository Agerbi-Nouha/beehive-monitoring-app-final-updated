import React from 'react';
import { useTheme } from '../context/ThemeContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { Sun, Moon, LogOut } from 'lucide-react';

export default function Topbar() {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center">
          <span className="text-accent font-bold">🐝</span>
        </div>
        <div className="font-semibold">Beehive Monitor</div>
      </div>

      <div className="flex items-center gap-2">
        <button className="btn btn-ghost" onClick={toggleTheme} title="Toggle theme">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <div className="text-sm text-muted hidden sm:block">
          {user?.email} <span className="ml-1 badge bg-accent/15 text-accent">{user?.role}</span>
        </div>
        <button className="btn btn-ghost" onClick={logout} title="Logout">
          <LogOut size={18} />
        </button>
      </div>
    </div>
  );
}
