import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { styles } from '../styles/theme';
import { Campus } from '../types';

interface HeaderProps {
  campus: Campus | null;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ campus, onLogout }) => {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.headerTitle}>Unifix Campus Service</Text>
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
