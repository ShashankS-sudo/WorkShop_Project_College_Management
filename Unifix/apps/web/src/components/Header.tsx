import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Building2, Bell, LogOut, ShieldAlert, Sparkles, ChevronDown } from 'lucide-react';

interface HeaderProps {
  currentTab: 'dashboard' | 'queue' | 'insights' | 'supermanagement';
  setCurrentTab: (tab: 'dashboard' | 'queue' | 'insights' | 'supermanagement') => void;
  onOpenNotifications: () => void;
  unreadCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  onOpenNotifications,
  unreadCount,
}) => {
  const { user, activeCampus, setActiveCampus, isSupermanagement, logout } = useAuth();

  return (
    <header className="glass-header sticky top-0 z-30 px-6 py-3.5 flex items-center justify-between">
      <div className="flex items-center gap-8">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
            U
          </div>
          <div>
            <div className="text-base font-semibold tracking-tight text-gray-900 flex items-center gap-1.5">
              Unifix <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">Admin</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1">
          <button
            onClick={() => setCurrentTab('dashboard')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              currentTab === 'dashboard'
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setCurrentTab('queue')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              currentTab === 'queue'
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            Ticket Queue
          </button>
          <button
            onClick={() => setCurrentTab('insights')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
              currentTab === 'insights'
                ? 'bg-purple-50 text-purple-700'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Sparkles className="w-4 h-4 text-purple-600" />
            AI Insights
          </button>
          {isSupermanagement && (
            <button
              onClick={() => setCurrentTab('supermanagement')}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                currentTab === 'supermanagement'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <ShieldAlert className="w-4 h-4 text-indigo-600" />
              Global Supermanagement
            </button>
          )}
        </nav>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Campus Switcher */}
        {user?.campuses && user.campuses.length > 0 && (
          <div className="relative flex items-center bg-gray-100 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-700">
            <Building2 className="w-3.5 h-3.5 text-gray-500 mr-1.5" />
            <select
              value={activeCampus?.id}
              onChange={(e) => {
                const found = user.campuses.find((c) => c.id === e.target.value);
                if (found) setActiveCampus(found);
              }}
              className="bg-transparent border-none outline-none font-semibold text-gray-900 cursor-pointer pr-4"
            >
              {user.campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-gray-500 absolute right-2 pointer-events-none" />
          </div>
        )}

        {/* Notification Bell */}
        <button
          onClick={onOpenNotifications}
          className="relative p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          title="Notifications"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* User Profile & Logout */}
        <div className="flex items-center gap-3 pl-2 border-l border-gray-200">
          <div className="text-right">
            <div className="text-xs font-semibold text-gray-900">
              {user?.firstName} {user?.lastName}
            </div>
            <div className="text-[10px] font-medium text-gray-500 uppercase">
              {activeCampus?.role || 'User'}
            </div>
          </div>
          <button
            onClick={logout}
            className="p-1.5 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
