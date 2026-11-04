import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { styles } from '../styles/theme';
import { Campus } from '../types';

interface HeaderProps {
  campus: Campus | null;
  onLogout: () => void;
  isLive?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ campus, onLogout, isLive }) => {
  return (
    <View style={styles.header}>
      <View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.headerTitle}>Unifix Campus</Text>
          {isLive && (
            <View
              style={{
                backgroundColor: '#dcfce7',
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: '#86efac',
              }}
            >
              <Text style={{ fontSize: 9, fontWeight: '700', color: '#16a34a' }}>⚡ LIVE</Text>
            </View>
          )}
        </View>
        <Text style={styles.headerSubtitle}>
          {campus ? `${campus.name} (${campus.code})` : 'Connected Campus'}
        </Text>
      </View>
      <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
};
