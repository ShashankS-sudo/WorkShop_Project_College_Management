import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { styles } from '../styles/theme';
import { Notification } from '../types';

interface NotificationsScreenProps {
  notifications: Notification[];
  onMarkRead: (notificationId: string) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onSelectTicket: (ticketId: string) => void;
}

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({
  notifications,
  onMarkRead,
  onMarkAllRead,
  onSelectTicket,
}) => {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeader}>Alerts & Notifications</Text>
        {notifications.length > 0 && (
          <TouchableOpacity onPress={onMarkAllAllSafe(onMarkAllRead)} style={styles.refreshBtn}>
            <Text style={styles.refreshBtnText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {notifications.length === 0 ? (
        <Text style={styles.emptyText}>No notifications right now.</Text>
      ) : (
        notifications.map((n) => (
          <TouchableOpacity
            key={n.id}
            activeOpacity={0.8}
            onPress={() => {
              onMarkRead(n.id);
              if (n.relatedTicketId) {
                onSelectTicket(n.relatedTicketId);
              }
            }}
            style={[styles.notifCard, !n.isRead && styles.notifCardUnread]}
          >
            <View style={styles.notifHeaderRow}>
              <Text style={styles.notifTitle}>{n.title}</Text>
              {!n.isRead && <View style={styles.unreadDot} />}
            </View>
            <Text style={styles.notifBody}>{n.message}</Text>
            <Text style={styles.notifTime}>
              {new Date(n.createdAt).toLocaleDateString()}
            </Text>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
};

function onMarkAllAllSafe(fn: () => Promise<void>) {
  return () => {
    fn().catch(console.error);
  };
}
