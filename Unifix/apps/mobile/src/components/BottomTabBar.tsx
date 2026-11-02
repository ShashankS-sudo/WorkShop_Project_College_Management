import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { styles } from '../styles/theme';

export type TabKey = 'report' | 'browse' | 'myTickets' | 'notifications';

interface BottomTabBarProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  unreadNotificationsCount: number;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  activeTab,
  onTabChange,
  unreadNotificationsCount,
}) => {
  return (
    <View style={styles.tabBar}>
      <TouchableOpacity style={styles.tabItem} onPress={() => onTabChange('report')}>
        <Text style={[styles.tabText, activeTab === 'report' && styles.tabTextActive]}>
          Report Issue
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.tabItem} onPress={() => onTabChange('browse')}>
        <Text style={[styles.tabText, activeTab === 'browse' && styles.tabTextActive]}>
          Browse Feed
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.tabItem} onPress={() => onTabChange('myTickets')}>
        <Text style={[styles.tabText, activeTab === 'myTickets' && styles.tabTextActive]}>
          My Reports
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.tabItem} onPress={() => onTabChange('notifications')}>
        <View>
          <Text style={[styles.tabText, activeTab === 'notifications' && styles.tabTextActive]}>
            Alerts
          </Text>
          {unreadNotificationsCount > 0 && <View style={styles.badgeIndicator} />}
        </View>
      </TouchableOpacity>
    </View>
  );
};
