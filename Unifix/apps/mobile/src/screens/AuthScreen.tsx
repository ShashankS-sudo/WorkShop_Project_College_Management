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
  Platform,
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [devHint, setDevHint] = useState<string | null>(null);

  const notifyUser = (title: string, message: string) => {
    setErrorMessage(message);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Do not block UI with native alert on web, error message banner is visible
      console.warn(`[Auth] ${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleRequestOtp = async () => {
    setErrorMessage(null);
    if (!selectedCampus) {
      notifyUser('Error', 'Please select a campus.');
      return;
    }
    if (!identifier.trim()) {
      notifyUser('Error', 'Please enter your email or phone number.');
      return;
    }

    setAuthLoading(true);
    try {
      const res: any = await MobileApiClient.requestOTP(identifier.trim(), selectedCampus.id, isAnonymousMode);
      if (res?.data?.developmentOtpCode) {
        setOtpCode(res.data.developmentOtpCode);
        setDevHint(`Simulated verification code for ${identifier}: ${res.data.developmentOtpCode}`);
      }
      setAuthStep('otp');
    } catch (err: any) {
      notifyUser('Authentication Failed', err.message || 'Could not verify campus identity.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setErrorMessage(null);
    if (!selectedCampus || !otpCode.trim()) {
      notifyUser('Error', 'Please enter the verification code.');
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
      notifyUser('Verification Failed', err.message || 'Invalid or expired verification code.');
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
          {errorMessage && (
            <View style={{ backgroundColor: '#fee2e2', borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <Text style={{ color: '#b91c1c', fontSize: 13, fontWeight: '600' }}>⚠️ {errorMessage}</Text>
            </View>
          )}

          {authStep === 'campus' ? (
            <View>
              <Text style={styles.fieldLabel}>Select Campus</Text>
              <View style={styles.campusPickerContainer}>
                {campuses.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => {
                      onSelectCampus(c);
                      setErrorMessage(null);
                    }}
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
                onChangeText={(text) => {
                  setIdentifier(text);
                  setErrorMessage(null);
                }}
                placeholder="e.g. student.alex@pstc.test"
                autoCapitalize="none"
              />

              {/* 5 Students & 1 Admin Quick-Select Chips */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {[
                  { label: 'Student 1 (Alex)', email: 'student.alex@pstc.test' },
                  { label: 'Student 2 (Emma)', email: 'student2@pstc.test' },
                  { label: 'Student 3 (Liam)', email: 'student3@pstc.test' },
                  { label: 'Student 4 (Sophia)', email: 'student4@pstc.test' },
                  { label: 'Student 5 (Noah)', email: 'student5@pstc.test' },
                  { label: 'Admin (PSTC)', email: 'admin@pstc.test' },
                ].map((s) => (
                  <TouchableOpacity
                    key={s.email}
                    onPress={() => {
                      setIdentifier(s.email);
                      setErrorMessage(null);
                    }}
                    style={{
                      paddingHorizontal: 9,
                      paddingVertical: 5,
                      borderRadius: 12,
                      backgroundColor: identifier === s.email ? '#0284c7' : '#f1f5f9',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '600',
                        color: identifier === s.email ? '#ffffff' : '#475569',
                      }}
                    >
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

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
                  {devHint || `Simulated verification code for ${identifier}: 123456`}
                </Text>
              </View>

              <Text style={styles.fieldLabel}>Enter 6-Digit Code</Text>
              <TextInput
                style={[styles.input, styles.otpInput]}
                value={otpCode}
                onChangeText={(text) => {
                  setOtpCode(text);
                  setErrorMessage(null);
                }}
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
                onPress={() => {
                  setAuthStep('campus');
                  setErrorMessage(null);
                }}
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
