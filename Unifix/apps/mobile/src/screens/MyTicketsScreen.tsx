import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { styles, getStageCountdown } from '../styles/theme';
import { Ticket, User } from '../types';

interface MyTicketsScreenProps {
  tickets: Ticket[];
  currentUser: User | null;
  onSelectTicket: (ticketId: string) => void;
}

export const MyTicketsScreen: React.FC<MyTicketsScreenProps> = ({
  tickets,
  currentUser,
  onSelectTicket,
}) => {
  const myTickets = tickets.filter(
    (t: any) => t.reporterId === currentUser?.id || t.reporter?.id === currentUser?.id
  );

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Text style={styles.sectionHeader}>My Reported Issues & 3-Week Stage Tracking</Text>
      {myTickets.length === 0 ? (
        <Text style={styles.emptyText}>You haven't submitted any issues yet.</Text>
      ) : (
        myTickets.map((t) => (
          <TouchableOpacity
            key={t.id}
            activeOpacity={0.8}
            onPress={() => onSelectTicket(t.id)}
            style={styles.ticketCard}
          >
            <View style={styles.ticketCardHeader}>
              <Text style={styles.stageBadge}>Stage: {t.currentStage}</Text>
              <View style={styles.statusPillBadge}>
                <Text style={styles.ticketStatus}>{t.status}</Text>
              </View>
            </View>
            <Text style={styles.ticketTitle}>{t.title}</Text>
            <View style={styles.countdownBanner}>
              <Text style={styles.countdownText}>
                ⏱️ {getStageCountdown(t.stageStartTime, t.isCritical)}
              </Text>
            </View>
            {t.resolvedAt && (
              <Text style={styles.resolutionNotice}>
                ✓ Resolved: {t.resolutionSummary || 'Resolution complete'}
              </Text>
            )}
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
};
