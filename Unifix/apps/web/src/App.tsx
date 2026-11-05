import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { Header } from './components/Header';
import { DashboardPage } from './pages/DashboardPage';
import { TicketQueuePage } from './pages/TicketQueuePage';
import { TicketDetailPage } from './pages/TicketDetailPage';
import { InsightsPage } from './pages/InsightsPage';
import { SupermanagementPage } from './pages/SupermanagementPage';
import { NotificationDrawer } from './components/NotificationDrawer';
import { ApiClient } from './api/client';
import { useSocket } from './context/SocketContext';
import { SocketEvent } from '@unifix/shared-types';

export const AppContent: React.FC = () => {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const { socket } = useSocket();
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'queue' | 'insights' | 'supermanagement'>('dashboard');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [queueFilter, setQueueFilter] = useState<string | undefined>(undefined);
  const [isNotificationOpen, setIsNotificationOpen] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  const fetchNotifications = async () => {
    if (!isAuthenticated) return;
    try {
      const res = await ApiClient.getNotifications();
      if (res.data) setNotifications(res.data);
    } catch (err) {
      console.error('Failed to load notifications', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // 1-minute fallback refresh
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Live real-time notification listener
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (data: { notification: any }) => {
      if (data?.notification) {
        setNotifications((prev) => [
          data.notification,
          ...prev.filter((n) => n.id !== data.notification.id),
        ]);
      }
    };

    socket.on(SocketEvent.NOTIFICATION_NEW, handleNewNotification);

    return () => {
      socket.off(SocketEvent.NOTIFICATION_NEW, handleNewNotification);
    };
  }, [socket]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-xs text-gray-500">
        Initializing Unifix Management System...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // Guard: Strictly block ordinary student / reporter accounts from management web interface
  const hasManagementRole = Boolean(
    user?.campuses.some((c) => c.role === 'MANAGEMENT' || c.role === 'SUPERMANAGEMENT')
  );

  if (!hasManagementRole) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 max-w-md w-full text-center">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-xl">
            ✕
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-sm text-gray-600 mb-6">
            Your account ({user?.email}) has <strong>Student / Reporter</strong> privileges. The Unifix Management Web Portal is strictly restricted to Campus Facilities Staff and Administrators.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-6 text-xs text-blue-800">
            📱 Please open the <strong>Unifix Mobile App</strong> to report issues, track tickets, or endorse repairs.
          </div>
          <button
            onClick={logout}
            className="w-full py-2.5 px-4 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-xl text-sm transition"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const navigateToQueueWithFilter = (filter?: string) => {
    setQueueFilter(filter);
    setCurrentTab('queue');
  };

  return (
    <div className="min-h-screen bg-[#fbfbfd] flex flex-col">
      <Header
        currentTab={currentTab}
        setCurrentTab={(tab) => {
          setQueueFilter(undefined);
          setCurrentTab(tab);
        }}
        onOpenNotifications={() => setIsNotificationOpen(true)}
        unreadCount={unreadCount}
      />

      <main className="flex-1 pb-16">
        {currentTab === 'dashboard' && (
          <DashboardPage
            onSelectTicket={(id) => setSelectedTicketId(id)}
            onNavigateToQueue={navigateToQueueWithFilter}
          />
        )}

        {currentTab === 'queue' && (
          <TicketQueuePage
            onSelectTicket={(id) => setSelectedTicketId(id)}
            initialFilter={queueFilter}
          />
        )}

        {currentTab === 'insights' && <InsightsPage />}

        {currentTab === 'supermanagement' && <SupermanagementPage />}
      </main>

      {/* Ticket Detail Modal */}
      {selectedTicketId && (
        <TicketDetailPage
          ticketId={selectedTicketId}
          onClose={() => setSelectedTicketId(null)}
          onTicketUpdated={() => {
            fetchNotifications();
          }}
        />
      )}

      {/* In-App Notification Center Drawer */}
      <NotificationDrawer
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        notifications={notifications}
        onRefresh={fetchNotifications}
      />
    </div>
  );
};
