import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { styles } from '../styles/theme';
import { Campus } from '../types';
import { MobileApiClient } from '../api/mobileClient';

interface AuthScreenProps {
  campuses: Campus[];
  selectedCampus: Campus | null;
  onSelectCampus: (campus: Campus) => void;
  onAuthSuccess: (user: any) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  campuses,
  selectedCampus,
  onSelectCampus,
  onAuthSuccess,
}) => {
  const [authStep, setAuthStep] = useState<'campus' | 'otp'>('campus');
  const [identifier, setIdentifier] = useState<string>('student.alex@pstc.test');
  const [otpCode, setOtpCode] = useState<string>('123456');
  const [isAnonymousMode, setIsAnonymousMode] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  const handleRequestOtp = async () => {
    if (!selectedCampus) {
      Alert.alert('Error', 'Please select a campus.');
      return;
    }
    if (!identifier.trim()) {
      Alert.alert('Error', 'Please enter your email or phone number.');
      return;
    }

    setAuthLoading(true);
    try {
      await MobileApiClient.requestOTP(identifier.trim(), selectedCampus.id, isAnonymousMode);
      setAuthStep('otp');
    } catch (err: any) {
      Alert.alert('Authentication Failed', err.message || 'Could not verify campus identity.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!selectedCampus || !otpCode.trim()) {
      Alert.alert('Error', 'Please enter the verification code.');
      return;
    }

    setAuthLoading(true);
    try {
      const res: any = await MobileApiClient.verifyOTP(
        identifier.trim(),
        otpCode.trim(),
        selectedCampus.id,
        isAnonymousMode
      );
      if (res.data?.user) {
        onAuthSuccess(res.data.user);
      }
    } catch (err: any) {
      Alert.alert('Verification Failed', err.message || 'Invalid or expired verification code.');
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.authContainer}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.authScroll}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoText}>U</Text>
        </View>
        <Text style={styles.appTitle}>Unifix Campus</Text>
        <Text style={styles.appSubtitle}>Facility issues, safety reports, and rapid stage resolution</Text>

        <View style={styles.authCard}>
          {authStep === 'campus' ? (
            <View>
              <Text style={styles.fieldLabel}>Select Campus</Text>
              <View style={styles.campusPickerContainer}>
                {campuses.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => onSelectCampus(c)}
                    style={[
                      styles.campusOption,
                      selectedCampus?.id === c.id && styles.campusOptionSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.campusOptionText,
                        selectedCampus?.id === c.id && styles.campusOptionTextSelected,
                      ]}
                    >
                      {c.name} ({c.code})
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Campus Email or Phone</Text>
              <TextInput
                style={styles.input}
                value={identifier}
                onChangeText={setIdentifier}
                placeholder="e.g. student.alex@pstc.test"
                autoCapitalize="none"
              />

              <TouchableOpacity
                onPress={() => setIsAnonymousMode(!isAnonymousMode)}
                style={styles.anonToggle}
              >
                <View style={[styles.checkbox, isAnonymousMode && styles.checkboxActive]} />
                <Text style={styles.anonText}>Report Anonymously as Guest</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleRequestOtp}
                disabled={authLoading}
                style={styles.primaryButton}
              >
                {authLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Continue to Verification</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <View style={styles.infoBanner}>
                <Text style={styles.infoBannerText}>
                  Simulated verification code for {identifier}: 123456
                </Text>
              </View>

              <Text style={styles.fieldLabel}>Enter 6-Digit Code</Text>
              <TextInput
                style={[styles.input, styles.otpInput]}
                value={otpCode}
                onChangeText={setOtpCode}
                maxLength={6}
                keyboardType="number-pad"
                placeholder="123456"
              />

              <TouchableOpacity
                onPress={handleVerifyOtp}
                disabled={authLoading}
                style={styles.primaryButton}
              >
                {authLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Sign In & Open Campus Portal</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setAuthStep('campus')}
                style={{ marginTop: 12, alignItems: 'center' }}
              >
                <Text style={styles.linkText}>Back to campus selection</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
