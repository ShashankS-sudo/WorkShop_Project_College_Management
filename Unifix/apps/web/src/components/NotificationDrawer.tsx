import React from 'react';
import { X, CheckCheck, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { ApiClient } from '../api/client';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onRefresh: () => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onRefresh,
}) => {
  if (!isOpen) return null;

  const handleMarkRead = async (id: string) => {
    try {
      await ApiClient.markNotificationRead(id);
      onRefresh();
    } catch (err) {
      console.error('Failed to mark read', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await ApiClient.markAllNotificationsRead();
      onRefresh();
    } catch (err) {
      console.error('Failed to mark all read', err);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'STAGE_OVERDUE':
      case 'TICKET_ESCALATED':
        return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      case 'TICKET_RESOLVED':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      default:
        return <Clock className="w-4 h-4 text-blue-600" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-xl flex flex-col">
          {/* Drawer Header */}
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Notifications</h2>
              <p className="text-xs text-gray-500">Lifecycle escalations & triage alerts</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleMarkAllRead}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 p-1"
                title="Mark all as read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
              <button onClick={onClose} className="p-1 rounded-md text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {notifications.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">No notifications right now</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => !n.isRead && handleMarkRead(n.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    n.isRead
                      ? 'bg-gray-50/60 border-gray-100 opacity-75'
                      : 'bg-white border-blue-100 shadow-sm hover:border-blue-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 p-1.5 rounded-lg bg-gray-50">{getIcon(n.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-semibold text-gray-900 truncate">{n.title}</h4>
                        {!n.isRead && <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">{n.message}</p>
                      <span className="text-[10px] text-gray-400 mt-2 block">
                        {new Date(n.createdAt).toLocaleDateString()} at{' '}
                        {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
