import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { styles, colors } from '../styles/theme';
import { Ticket } from '../types';

interface BrowseScreenProps {
  tickets: Ticket[];
  isLoading: boolean;
  onRefresh: () => void;
  onSelectTicket: (ticketId: string) => void;
  onEndorse: (ticketId: string) => Promise<void>;
}

export const BrowseScreen: React.FC<BrowseScreenProps> = ({
  tickets,
  isLoading,
  onRefresh,
  onSelectTicket,
  onEndorse,
}) => {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeader}>Campus Issues Feed ({tickets.length})</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
          <Text style={styles.refreshBtnText}>↻ Refresh</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />
      ) : tickets.length === 0 ? (
        <Text style={styles.emptyText}>No tickets reported yet on this campus.</Text>
      ) : (
        tickets.map((t) => (
          <TouchableOpacity
            key={t.id}
            activeOpacity={0.8}
            onPress={() => onSelectTicket(t.id)}
            style={styles.ticketCard}
          >
            <View style={styles.ticketCardHeader}>
              <Text style={styles.ticketCategory}>{t.category?.name || 'General'}</Text>
              <View style={styles.statusPillBadge}>
                <Text style={styles.ticketStatus}>{t.status}</Text>
              </View>
            </View>
            <Text style={styles.ticketTitle}>{t.title}</Text>
            <Text style={styles.ticketDesc} numberOfLines={2}>
              {t.description}
            </Text>
            <View style={styles.ticketFooter}>
              <Text style={styles.ticketLocation}>📍 {t.location?.name || 'Campus'}</Text>
              <TouchableOpacity
                onPress={() => onEndorse(t.id)}
                style={styles.smallEndorseBtn}
              >
                <Text style={styles.smallEndorseText}>
                  👍 {t._count?.endorsements || 0} Affected
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
};
