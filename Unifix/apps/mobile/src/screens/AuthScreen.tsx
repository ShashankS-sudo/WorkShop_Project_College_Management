import React, { useState, useEffect } from 'react';
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
  Modal,
} from 'react-native';
import { styles, colors } from '../styles/theme';
import { Campus } from '../types';
import { MobileApiClient } from '../api/mobileClient';
import { SavedGoogleAccount } from '../api/tokenStorage';

interface AuthScreenProps {
  campuses: Campus[];
  selectedCampus: Campus | null;
  onSelectCampus: (campus: Campus) => void;
  onAuthSuccess: (user: any) => void;
}

const SAMPLE_CAMPUS_IDENTITIES = [
  { label: 'Student 1 (Alex)', email: 'student.alex@pstc.test', name: 'Alex Mercer', dept: 'Computer Science' },
  { label: 'Student 2 (Emma)', email: 'student2@pstc.test', name: 'Emma Watson', dept: 'Electrical Engineering' },
  { label: 'Student 3 (Liam)', email: 'student3@pstc.test', name: 'Liam Chen', dept: 'Mechanical Engineering' },
  { label: 'Student 4 (Sophia)', email: 'student4@pstc.test', name: 'Sophia Rodriguez', dept: 'Civil Engineering' },
  { label: 'Student 5 (Noah)', email: 'student5@pstc.test', name: 'Noah Kim', dept: 'Biomedical Sciences' },
  { label: 'Admin (PSTC)', email: 'admin@pstc.test', name: 'Facilities Lead', dept: 'Facilities & Maintenance' },
];

export const AuthScreen: React.FC<AuthScreenProps> = ({
  campuses,
  selectedCampus,
  onSelectCampus,
  onAuthSuccess,
}) => {
  // 1. Standard Login Form State (Email + Password)
  const [identifier, setIdentifier] = useState<string>('student.alex@pstc.test');
  const [password, setPassword] = useState<string>('1234');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isAnonymousMode, setIsAnonymousMode] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 2. Google SSO Modal State
  const [showGoogleModal, setShowGoogleModal] = useState<boolean>(false);
  const [savedGoogleAccounts, setSavedGoogleAccounts] = useState<SavedGoogleAccount[]>([]);
  const [showAddGoogleAccount, setShowAddGoogleAccount] = useState<boolean>(false);
  const [addGoogleEmail, setAddGoogleEmail] = useState<string>('student.alex@pstc.test');
  const [addGooglePassword, setAddGooglePassword] = useState<string>('1234');
  const [addGoogleName, setAddGoogleName] = useState<string>('Alex Mercer');
  const [googleLoading, setGoogleLoading] = useState<boolean>(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  // Load device-saved Google accounts on mount
  useEffect(() => {
    loadSavedGoogleAccounts();
  }, []);

  const loadSavedGoogleAccounts = async () => {
    try {
      const accs = await MobileApiClient.getSavedGoogleAccounts();
      setSavedGoogleAccounts(accs);
    } catch {
      setSavedGoogleAccounts([]);
    }
  };

  const notifyUser = (title: string, message: string) => {
    setErrorMessage(message);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      console.warn(`[Auth] ${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  // Standard Email + Password Sign In
  const handleStandardPasswordLogin = async () => {
    setErrorMessage(null);
    if (!selectedCampus) {
      notifyUser('Error', 'Please select a campus.');
      return;
    }
    if (!isAnonymousMode && !identifier.trim()) {
      notifyUser('Error', 'Please enter your campus email or phone.');
      return;
    }
    if (!isAnonymousMode && !password.trim()) {
      notifyUser('Error', 'Please enter your password.');
      return;
    }

    setAuthLoading(true);
    try {
      const res: any = await MobileApiClient.loginWithPassword({
        campusId: selectedCampus.id,
        identifier: identifier.trim(),
        password: password.trim(),
        isAnonymous: isAnonymousMode,
      });

      if (res?.data?.user) {
        onAuthSuccess(res.data.user);
      }
    } catch (err: any) {
      notifyUser('Sign In Failed', err.message || 'Incorrect email or password.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Google SSO: 1-Tap Sign In for Saved Accounts (No password prompt needed)
  const handleOneTapGoogleSignIn = async (acc: SavedGoogleAccount) => {
    if (!selectedCampus) return;
    setGoogleLoading(true);
    setGoogleError(null);
    try {
      const res: any = await MobileApiClient.googleSignIn({
        campusId: selectedCampus.id,
        email: acc.email,
        oneTap: true,
      });

      if (res?.data?.user) {
        setShowGoogleModal(false);
        onAuthSuccess(res.data.user);
      }
    } catch (err: any) {
      setGoogleError(err.message || '1-Tap sign in failed. Please re-enter your account credentials.');
    } finally {
      setGoogleLoading(false);
    }
  };

  // Google SSO: Add New Account with Email & Password
  const handleAddAndVerifyGoogleAccount = async () => {
    if (!selectedCampus) return;
    if (!addGoogleEmail.trim()) {
      setGoogleError('Please enter a campus Google email.');
      return;
    }
    if (!addGooglePassword.trim()) {
      setGoogleError('Please enter the password for this account.');
      return;
    }

    setGoogleLoading(true);
    setGoogleError(null);
    try {
      const res: any = await MobileApiClient.googleSignIn({
        campusId: selectedCampus.id,
        email: addGoogleEmail.trim(),
        password: addGooglePassword.trim(),
        displayName: addGoogleName.trim() || undefined,
      });

      if (res?.data?.user) {
        // Save to device storage so it will appear in 1-tap list next time
        const newSavedAcc: SavedGoogleAccount = {
          email: addGoogleEmail.trim().toLowerCase(),
          displayName: `${res.data.user.firstName || ''} ${res.data.user.lastName || ''}`.trim() || addGoogleName || 'Campus Student',
          department: res.data.user.department || 'Campus Student',
          role: res.data.user.role || 'REPORTER',
          campusId: selectedCampus.id,
        };

        const updatedList = await MobileApiClient.saveGoogleAccount(newSavedAcc);
        setSavedGoogleAccounts(updatedList);
        setShowGoogleModal(false);
        setShowAddGoogleAccount(false);
        onAuthSuccess(res.data.user);
      }
    } catch (err: any) {
      setGoogleError(err.message || 'Incorrect password. (Default demo password is: 1234)');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleRemoveSavedGoogleAccount = async (email: string) => {
    const updated = await MobileApiClient.removeGoogleAccount(email);
    setSavedGoogleAccounts(updated);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <ScrollView contentContainerStyle={styles.authScroll} keyboardShouldPersistTaps="handled">
        <View style={styles.authCard}>
          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoText}>U</Text>
            </View>
            <Text style={styles.appTitle}>Unifix Campus</Text>
            <Text style={styles.appSubtitle}>
              Facility issues, safety reports, and rapid stage resolution
            </Text>
          </View>

          {errorMessage && (
            <View style={{ backgroundColor: '#fee2e2', borderRadius: 8, padding: 10, marginBottom: 12 }}>
              <Text style={{ color: '#b91c1c', fontSize: 12, fontWeight: '600' }}>⚠️ {errorMessage}</Text>
            </View>
          )}

          <View>
            {/* Campus Selector */}
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

            {/* 🌟 1-Tap Google SSO Button */}
            <TouchableOpacity
              onPress={() => {
                setShowGoogleModal(true);
                setShowAddGoogleAccount(false);
                setGoogleError(null);
                loadSavedGoogleAccounts();
              }}
              disabled={authLoading || googleLoading}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#ffffff',
                borderWidth: 1.5,
                borderColor: '#dadce0',
                borderRadius: 12,
                paddingVertical: 13,
                paddingHorizontal: 16,
                marginTop: 18,
                marginBottom: 14,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.08,
                shadowRadius: 3,
                elevation: 2,
              }}
            >
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  backgroundColor: '#f8fafc',
                  borderWidth: 1.5,
                  borderColor: '#e2e8f0',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '900', color: '#4285F4' }}>
                  G
                </Text>
              </View>
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#1f2937' }}>
                Continue with Google
              </Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 10 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: '#e2e8f0' }} />
              <Text style={{ marginHorizontal: 10, fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }}>
                or sign in with email & password
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: '#e2e8f0' }} />
            </View>

            {/* Campus Email or Username Input */}
            <Text style={[styles.fieldLabel, { marginTop: 8 }]}>Campus Email or Username</Text>
            <TextInput
              style={styles.input}
              value={identifier}
              onChangeText={(text) => {
                setIdentifier(text);
                setErrorMessage(null);
              }}
              placeholder="e.g. student.alex@pstc.test"
              autoCapitalize="none"
              editable={!isAnonymousMode}
            />

            {/* 🌟 New Required Password Field */}
            <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Password</Text>
            <View style={{ position: 'relative', justifyContent: 'center' }}>
              <TextInput
                style={[styles.input, { paddingRight: 55 }]}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setErrorMessage(null);
                }}
                placeholder="Enter account password"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                editable={!isAnonymousMode}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: 12, paddingVertical: 6, paddingHorizontal: 4 }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>
                  {showPassword ? 'HIDE' : 'SHOW'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Demo Password Helper Hint */}
            <Text style={{ fontSize: 11, color: '#0284c7', marginTop: 4, marginBottom: 8 }}>
              💡 Pre-configured demo password for all accounts: <Text style={{ fontWeight: 'bold' }}>1234</Text>
            </Text>

            {/* Quick-Select Campus Identity Chips */}
            <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '600', marginBottom: 6 }}>
              Quick Fill Demo Accounts:
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {SAMPLE_CAMPUS_IDENTITIES.map((s) => (
                <TouchableOpacity
                  key={s.email}
                  onPress={() => {
                    setIdentifier(s.email);
                    setPassword('1234');
                    setIsAnonymousMode(false);
                    setErrorMessage(null);
                  }}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 12,
                    backgroundColor: identifier === s.email && !isAnonymousMode ? '#0284c7' : '#f1f5f9',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '600',
                      color: identifier === s.email && !isAnonymousMode ? '#ffffff' : '#475569',
                    }}
                  >
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Anonymous Toggle */}
            <TouchableOpacity
              onPress={() => {
                setIsAnonymousMode(!isAnonymousMode);
                setErrorMessage(null);
              }}
              style={styles.anonToggle}
            >
              <View style={[styles.checkbox, isAnonymousMode && styles.checkboxActive]} />
              <Text style={styles.anonText}>Report Anonymously as Guest (No Password Required)</Text>
            </TouchableOpacity>

            {/* Sign In Button */}
            <TouchableOpacity
              onPress={handleStandardPasswordLogin}
              disabled={authLoading}
              style={styles.primaryButton}
            >
              {authLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>
                  {isAnonymousMode ? 'Continue as Anonymous Guest' : 'Sign In with Password'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* 🌟 Google SSO Modal (Empty Initially -> Add Account with Email + Password -> 1-Tap List) */}
      <Modal
        visible={showGoogleModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowGoogleModal(false);
          setShowAddGoogleAccount(false);
          setGoogleError(null);
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#ffffff', borderRadius: 20, padding: 22, width: '100%', maxWidth: 440, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 15, elevation: 12 }}>
            
            {/* Modal Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#4285F4' }}>G</Text>
                </View>
                <Text style={{ fontSize: 17, fontWeight: '700', color: '#1f2937' }}>
                  {showAddGoogleAccount ? 'Add Google Account' : 'Sign in with Google'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setShowGoogleModal(false);
                  setShowAddGoogleAccount(false);
                  setGoogleError(null);
                }}
                style={{ padding: 4 }}
              >
                <Text style={{ fontSize: 20, color: '#9ca3af', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Error Message inside modal */}
            {googleError && (
              <View style={{ backgroundColor: '#fee2e2', borderRadius: 8, padding: 10, marginBottom: 12 }}>
                <Text style={{ color: '#b91c1c', fontSize: 12, fontWeight: '600' }}>⚠️ {googleError}</Text>
              </View>
            )}

            {!showAddGoogleAccount ? (
              /* View 1: 1-Tap Saved Accounts (Empty initially on clean device) */
              <View>
                {savedGoogleAccounts.length === 0 ? (
                  /* Initially Empty State */
                  <View style={{ alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16 }}>
                    <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                      <Text style={{ fontSize: 26 }}>📱</Text>
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 6 }}>
                      No Google Accounts on this Device
                    </Text>
                    <Text style={{ fontSize: 12, color: '#64748b', textAlign: 'center', lineHeight: 18, marginBottom: 16 }}>
                      Link your campus Google account once using your email & password. It will be saved on this device so you can sign in anytime with just <Text style={{ fontWeight: '700', color: colors.primary }}>1 tap</Text>!
                    </Text>
                  </View>
                ) : (
                  /* 1-Tap Saved Accounts List */
                  <View>
                    <Text style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
                      Choose an account to sign in with <Text style={{ fontWeight: '700', color: '#059669' }}>1-Tap</Text>:
                    </Text>

                    <ScrollView style={{ maxHeight: 240 }}>
                      {savedGoogleAccounts.map((acc) => {
                        const initials = (acc.displayName || acc.email).substring(0, 2).toUpperCase();
                        return (
                          <View
                            key={acc.email}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              padding: 12,
                              borderRadius: 12,
                              borderWidth: 1.5,
                              borderColor: '#e2e8f0',
                              marginBottom: 8,
                              backgroundColor: '#f8fafc',
                            }}
                          >
                            <TouchableOpacity
                              onPress={() => handleOneTapGoogleSignIn(acc)}
                              disabled={googleLoading}
                              style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                            >
                              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#e0f2fe', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                                <Text style={{ fontSize: 13, fontWeight: '800', color: '#0284c7' }}>{initials}</Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 14, fontWeight: '700', color: '#1e293b' }}>
                                  {acc.displayName || acc.email}
                                </Text>
                                <Text style={{ fontSize: 12, color: '#64748b' }}>{acc.email}</Text>
                                {acc.department && (
                                  <Text style={{ fontSize: 11, color: '#059669', marginTop: 1 }}>
                                    {acc.department}
                                  </Text>
                                )}
                              </View>
                              <View style={{ backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginRight: 6 }}>
                                <Text style={{ fontSize: 11, color: '#065f46', fontWeight: '800' }}>1-Tap ➔</Text>
                              </View>
                            </TouchableOpacity>

                            {/* Remove from device button */}
                            <TouchableOpacity
                              onPress={() => handleRemoveSavedGoogleAccount(acc.email)}
                              style={{ padding: 6 }}
                              accessibilityLabel="Remove"
                            >
                              <Text style={{ fontSize: 14, color: '#94a3b8' }}>✕</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                {/* + Use another campus Google account button */}
                <TouchableOpacity
                  onPress={() => {
                    setShowAddGoogleAccount(true);
                    setGoogleError(null);
                  }}
                  disabled={googleLoading}
                  style={{
                    marginTop: 10,
                    paddingVertical: 12,
                    borderRadius: 12,
                    backgroundColor: '#f0fdf4',
                    borderWidth: 1.5,
                    borderColor: '#bbf7d0',
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 13, color: '#166534', fontWeight: '700' }}>
                    + Use another campus Google account
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* View 2: Add Account Screen (Enter Email + Password) */
              <View>
                <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
                  Enter your campus Google credentials once. It will be added to your 1-tap list.
                </Text>

                <Text style={[styles.fieldLabel, { marginBottom: 4 }]}>Campus Google Email</Text>
                <TextInput
                  style={[styles.input, { marginBottom: 8 }]}
                  value={addGoogleEmail}
                  onChangeText={(val) => {
                    setAddGoogleEmail(val);
                    setGoogleError(null);
                  }}
                  placeholder="e.g. student.alex@pstc.test"
                  autoCapitalize="none"
                />

                {/* Quick Chips for easily choosing a student to add */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {SAMPLE_CAMPUS_IDENTITIES.slice(0, 4).map((s) => (
                    <TouchableOpacity
                      key={s.email}
                      onPress={() => {
                        setAddGoogleEmail(s.email);
                        setAddGoogleName(s.name);
                        setAddGooglePassword('1234');
                      }}
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 10,
                        backgroundColor: addGoogleEmail === s.email ? '#e0f2fe' : '#f1f5f9',
                        borderWidth: 1,
                        borderColor: addGoogleEmail === s.email ? '#7dd3fc' : '#e2e8f0',
                      }}
                    >
                      <Text style={{ fontSize: 11, color: '#0369a1', fontWeight: '600' }}>{s.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.fieldLabel, { marginBottom: 4 }]}>Password for this Email</Text>
                <TextInput
                  style={[styles.input, { marginBottom: 4 }]}
                  secureTextEntry
                  value={addGooglePassword}
                  onChangeText={(val) => {
                    setAddGooglePassword(val);
                    setGoogleError(null);
                  }}
                  placeholder="Enter password (e.g. 1234)"
                />
                <Text style={{ fontSize: 11, color: '#0284c7', marginBottom: 16 }}>
                  💡 Pre-configured password for this account: <Text style={{ fontWeight: 'bold' }}>1234</Text>
                </Text>

                <TouchableOpacity
                  onPress={handleAddAndVerifyGoogleAccount}
                  disabled={googleLoading || !addGoogleEmail.trim() || !addGooglePassword.trim()}
                  style={styles.primaryButton}
                >
                  {googleLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>Verify & Add Account</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setShowAddGoogleAccount(false);
                    setGoogleError(null);
                  }}
                  style={{ marginTop: 12, alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 12, color: '#64748b', textDecorationLine: 'underline' }}>
                    ← Back to saved accounts list
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};
