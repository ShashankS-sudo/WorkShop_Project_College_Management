// Unifix Mobile Application - React Native (Expo)
import React, { useState, useEffect } from 'react';
import { SafeAreaView, StatusBar, View, Alert } from 'react-native';
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

export default function App() {
  // Session State
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

  // Navigation & Data
  const [activeTab, setActiveTab] = useState<TabKey>('report');
  const [campusTickets, setCampusTickets] = useState<Ticket[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isDataLoading, setIsDataLoading] = useState<boolean>(false);

  // Selected Ticket Modal State
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState<boolean>(false);

  // 1. Initial Load: Fetch Campuses
  useEffect(() => {
    async function loadCampuses() {
      try {
        const res: any = await MobileApiClient.getCampuses();
        if (res.data && res.data.length > 0) {
          setCampuses(res.data);
          setSelectedCampus(res.data[0]);
        }
      } catch (err: any) {
        console.error('Failed to load campuses', err);
      }
    }
    loadCampuses();
  }, []);

  // 2. Fetch Tickets & Notifications when Authenticated
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
    if (isAuthenticated && selectedCampus) {
      loadTickets();
      loadNotifications();
    }
  }, [isAuthenticated, selectedCampus, activeTab]);

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

  const handleLogout = () => {
    MobileApiClient.clearAuth();
    setIsAuthenticated(false);
    setCurrentUser(null);
    setCampusTickets([]);
    setNotifications([]);
  };

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

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Top Header */}
      <Header campus={selectedCampus} onLogout={handleLogout} />

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
