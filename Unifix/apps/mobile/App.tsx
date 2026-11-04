// Unifix Mobile Application - React Native (Expo)
import React, { useState, useEffect } from 'react';
import { SafeAreaView, StatusBar, View, Text, Alert, ActivityIndicator } from 'react-native';
import { MobileApiClient } from './src/api/mobileClient';
import { styles } from './src/styles/theme';
import { Campus, User, Ticket, Notification } from './src/types';
import { Header } from './src/components/Header';
import { BottomTabBar, TabKey } from './src/components/BottomTabBar';
import { TicketDetailModal } from './src/components/TicketDetailModal';
import { AuthScreen } from './src/screens/AuthScreen';
import { ReportScreen } from './src/screens/ReportScreen';
import { BrowseScreen } from './src/screens/BrowseScreen';
import { MyTicketsScreen } from './src/screens/MyTicketsScreen';
import { NotificationsScreen } from './src/screens/NotificationsScreen';
import { SocketProvider, useSocket } from './src/context/SocketContext';
import { SocketEvent } from '@unifix/shared-types';

export default function App() {
  // Session State
  const [isSessionChecking, setIsSessionChecking] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [campuses, setCampuses] = useState<Campus[]>([
    { id: 'campus-pstc-01', name: 'Pacific Science & Tech Campus', code: 'PSTC' },
    { id: 'campus-madi-02', name: 'Metropolitan Arts & Design Institute', code: 'MADI' },
    { id: 'campus-hvu-03', name: 'Highland Valley University', code: 'HVU' },
  ]);
  const [selectedCampus, setSelectedCampus] = useState<Campus | null>({
    id: 'campus-pstc-01',
    name: 'Pacific Science & Tech Campus',
    code: 'PSTC',
  });

  // 1. Initial Load: Check Persisted Session & Fetch Campuses
  useEffect(() => {
    async function bootstrapApp() {
      try {
        const { tokens, user } = await MobileApiClient.init();
        if (tokens.accessToken || tokens.refreshToken) {
          if (user) {
            setCurrentUser(user);
            setIsAuthenticated(true);
          }
          // Verify session in background or restore full profile
          try {
            const meRes: any = await MobileApiClient.getCurrentUser();
            if (meRes?.data) {
              setCurrentUser(meRes.data);
              setIsAuthenticated(true);
            }
          } catch {
            // Token refresh failed or session invalidated
            if (!MobileApiClient.getAccessToken()) {
              setIsAuthenticated(false);
              setCurrentUser(null);
            }
          }
        }

        const res: any = await MobileApiClient.getCampuses();
        if (res.data && res.data.length > 0) {
          setCampuses(res.data);
          setSelectedCampus((prev) => {
            if (!prev || prev.id.startsWith('campus-')) {
              const pstc = res.data.find((c: any) => c.code === 'PSTC');
              return pstc || res.data[0];
            }
            return prev;
          });
        }
      } catch (err: any) {
        console.warn('App bootstrap notice:', err);
      } finally {
        setIsSessionChecking(false);
      }
    }
    bootstrapApp();
  }, []);

  const handleLogout = async () => {
    await MobileApiClient.clearAuth();
    setIsAuthenticated(false);
    setCurrentUser(null);
  };

  if (isSessionChecking) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.logoBadge}>
          <Text style={styles.logoText}>U</Text>
        </View>
        <ActivityIndicator size="large" color="#0284c7" style={{ marginTop: 20 }} />
        <Text style={[styles.appSubtitle, { marginTop: 12 }]}>Restoring session...</Text>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <AuthScreen
        campuses={campuses}
        selectedCampus={selectedCampus}
        onSelectCampus={setSelectedCampus}
        onAuthSuccess={(user) => {
          setCurrentUser(user);
          setIsAuthenticated(true);
        }}
      />
    );
  }

  return (
    <SocketProvider isAuthenticated={isAuthenticated} campusId={selectedCampus?.id}>
      <AuthenticatedMainView
        selectedCampus={selectedCampus}
        currentUser={currentUser}
        onLogout={handleLogout}
      />
    </SocketProvider>
  );
}

interface AuthenticatedMainViewProps {
  selectedCampus: Campus | null;
  currentUser: User | null;
  onLogout: () => Promise<void>;
}

function AuthenticatedMainView({ selectedCampus, currentUser, onLogout }: AuthenticatedMainViewProps) {
  const { socket, isConnected, joinRoom, leaveRoom } = useSocket();

  // Navigation & Data
  const [activeTab, setActiveTab] = useState<TabKey>('report');
  const [campusTickets, setCampusTickets] = useState<Ticket[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isDataLoading, setIsDataLoading] = useState<boolean>(false);

  // Selected Ticket Modal State
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState<boolean>(false);

  // Fetch Tickets & Notifications
  const loadTickets = async () => {
    if (!selectedCampus) return;
    setIsDataLoading(true);
    try {
      const res: any = await MobileApiClient.getTickets(selectedCampus.id);
      if (res.data) setCampusTickets(res.data);
    } catch (err: any) {
      console.error('Failed to load tickets', err);
    } finally {
      setIsDataLoading(false);
    }
  };

  const loadNotifications = async () => {
    try {
      const res: any = await MobileApiClient.getNotifications();
      if (res.data) setNotifications(res.data);
    } catch (err: any) {
      console.error('Failed to load notifications', err);
    }
  };

  useEffect(() => {
    if (selectedCampus) {
      loadTickets();
      loadNotifications();
    }
  }, [selectedCampus, activeTab]);

  // Open Ticket Details Modal
  const openTicketDetails = async (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setIsDetailLoading(true);
    try {
      const res: any = await MobileApiClient.getTicket(ticketId);
      if (res.data) setSelectedTicket(res.data);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not load ticket details.');
    } finally {
      setIsDetailLoading(false);
    }
  };

  // Real-Time Socket.io Listeners for Live Mobile Synchronization
  useEffect(() => {
    if (!socket) return;

    // 1. New ticket created on this campus
    const handleTicketCreated = (data: any) => {
      if (data.ticket && data.campusId === selectedCampus?.id) {
        setCampusTickets((prev) => {
          const exists = prev.some((t) => t.id === data.ticket.id);
          if (exists) return prev;
          return [data.ticket, ...prev];
        });
      }
    };

    // 2. Ticket updated, stage escalated, or status changed
    const handleTicketUpdated = (data: any) => {
      const updatedTicketId = data.ticketId || data.ticket?.id;
      if (!updatedTicketId) return;

      setCampusTickets((prev) =>
        prev.map((t) => {
          if (t.id === updatedTicketId) {
            return {
              ...t,
              ...(data.ticket || {}),
              status: data.ticket?.status || t.status,
              currentStage: data.ticket?.currentStage || t.currentStage,
              escalationCount: data.ticket?.escalationCount ?? t.escalationCount,
            };
          }
          return t;
        })
      );

      // If user currently viewing this ticket in the modal, refresh details
      if (selectedTicketId === updatedTicketId) {
        MobileApiClient.getTicket(updatedTicketId)
          .then((res: any) => {
            if (res?.data) setSelectedTicket(res.data);
          })
          .catch(() => {});
      }
    };

    // 3. Ticket Endorsed
    const handleTicketEndorsed = (data: any) => {
      const ticketId = data.ticketId;
      if (!ticketId) return;

      setCampusTickets((prev) =>
        prev.map((t) => {
          if (t.id === ticketId) {
            return {
              ...t,
              _count: {
                ...(t._count || {}),
                endorsements: data.totalEndorsements ?? (t._count?.endorsements || 0) + 1,
              },
            };
          }
          return t;
        })
      );

      if (selectedTicketId === ticketId) {
        setSelectedTicket((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            _count: {
              ...(prev._count || {}),
              endorsements: data.totalEndorsements ?? (prev._count?.endorsements || 0) + 1,
            },
          };
        });
      }
    };

    // 4. Comment Added
    const handleCommentAdded = (data: any) => {
      if (data.ticketId === selectedTicketId && data.comment) {
        setSelectedTicket((prev) => {
          if (!prev) return prev;
          const exists = prev.comments?.some((c) => c.id === data.comment.id);
          if (exists) return prev;
          return {
            ...prev,
            comments: [...(prev.comments || []), data.comment],
          };
        });
      }
    };

    // 5. New Notification
    const handleNotificationNew = (data: any) => {
      if (data.notification) {
        setNotifications((prev) => {
          const exists = prev.some((n) => n.id === data.notification.id);
          if (exists) return prev;
          return [data.notification, ...prev];
        });
      }
    };

    socket.on(SocketEvent.TICKET_CREATED, handleTicketCreated);
    socket.on(SocketEvent.TICKET_UPDATED, handleTicketUpdated);
    socket.on(SocketEvent.TICKET_ESCALATED, handleTicketUpdated);
    socket.on(SocketEvent.TICKET_ENDORSED, handleTicketEndorsed);
    socket.on(SocketEvent.COMMENT_ADDED, handleCommentAdded);
    socket.on(SocketEvent.NOTIFICATION_NEW, handleNotificationNew);

    return () => {
      socket.off(SocketEvent.TICKET_CREATED, handleTicketCreated);
      socket.off(SocketEvent.TICKET_UPDATED, handleTicketUpdated);
      socket.off(SocketEvent.TICKET_ESCALATED, handleTicketUpdated);
      socket.off(SocketEvent.TICKET_ENDORSED, handleTicketEndorsed);
      socket.off(SocketEvent.COMMENT_ADDED, handleCommentAdded);
      socket.off(SocketEvent.NOTIFICATION_NEW, handleNotificationNew);
    };
  }, [socket, selectedCampus?.id, selectedTicketId]);

  // Join focused ticket room when modal is open
  useEffect(() => {
    if (!socket || !selectedTicketId) return;

    joinRoom(`ticket:${selectedTicketId}`);
    return () => {
      leaveRoom(`ticket:${selectedTicketId}`);
    };
  }, [socket, selectedTicketId]);

  const handleEndorse = async (ticketId: string) => {
    try {
      await MobileApiClient.endorseTicket(ticketId);
      Alert.alert('Endorsed', 'Your endorsement has been recorded for this issue.');
      loadTickets();
      if (selectedTicketId === ticketId) {
        openTicketDetails(ticketId);
      }
    } catch (err: any) {
      Alert.alert('Endorsement Notice', err.message || 'You have already endorsed this issue.');
    }
  };

  const handleAddComment = async (content: string) => {
    if (!selectedTicketId) return;
    try {
      await MobileApiClient.addComment(selectedTicketId, content);
      openTicketDetails(selectedTicketId);
    } catch (err: any) {
      Alert.alert('Comment Error', err.message || 'Failed to post comment.');
    }
  };

  const handleReopen = async (reason: string) => {
    if (!selectedTicketId) return;
    try {
      await MobileApiClient.reopenTicket(selectedTicketId, reason);
      Alert.alert('Issue Reopened', 'The ticket has been restored to the active maintenance queue.');
      openTicketDetails(selectedTicketId);
      loadTickets();
    } catch (err: any) {
      Alert.alert('Reopen Error', err.message || 'Failed to reopen ticket.');
    }
  };

  const handleMarkNotificationRead = async (notifId: string) => {
    try {
      await MobileApiClient.markNotificationRead(notifId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, isRead: true } : n))
      );
    } catch {
      // Non-fatal
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await MobileApiClient.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not mark notifications read.');
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Top Header with Live Real-Time Status */}
      <Header campus={selectedCampus} onLogout={onLogout} isLive={isConnected} />

      {/* Tab Screen Content */}
      <View style={styles.mainContent}>
        {activeTab === 'report' && (
          <ReportScreen
            campus={selectedCampus}
            onTicketCreated={() => {
              setActiveTab('myTickets');
              loadTickets();
            }}
            onEndorseExisting={handleEndorse}
          />
        )}

        {activeTab === 'browse' && (
          <BrowseScreen
            tickets={campusTickets}
            isLoading={isDataLoading}
            onRefresh={loadTickets}
            onSelectTicket={openTicketDetails}
            onEndorse={handleEndorse}
          />
        )}

        {activeTab === 'myTickets' && (
          <MyTicketsScreen
            tickets={campusTickets}
            currentUser={currentUser}
            onSelectTicket={openTicketDetails}
          />
        )}

        {activeTab === 'notifications' && (
          <NotificationsScreen
            notifications={notifications}
            onMarkRead={handleMarkNotificationRead}
            onMarkAllRead={handleMarkAllNotificationsRead}
            onSelectTicket={openTicketDetails}
          />
        )}
      </View>

      {/* Ticket Details & Reopen Modal */}
      <TicketDetailModal
        visible={Boolean(selectedTicketId)}
        ticket={selectedTicket}
        currentUser={currentUser}
        isLoading={isDetailLoading}
        onClose={() => setSelectedTicketId(null)}
        onEndorse={handleEndorse}
        onAddComment={handleAddComment}
        onReopen={handleReopen}
      />

      {/* Bottom Tab Bar */}
      <BottomTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        unreadNotificationsCount={unreadCount}
      />
    </SafeAreaView>
  );
}
