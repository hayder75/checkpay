import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { employeeAPI } from '../services/api';
import { storage } from '../services/storage';
import { QrCode, Key, CheckCircle2, RefreshCcw, ArrowRight, UserRound } from 'lucide-react-native';
import QRCodeScanner from '../components/QRCodeScanner';

interface Props {
  onRegistrationSuccess: () => void;
  onCancel?: () => void;
}

type InviteMethod = 'code' | 'qr';
type InviteFlow = 'existing' | 'new';

export default function EmployeeRegisterScreen({ onRegistrationSuccess, onCancel }: Props) {
  const { colors } = useTheme();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [hasAuthToken, setHasAuthToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inviteMethod, setInviteMethod] = useState<InviteMethod>('code');
  const [inviteFlow, setInviteFlow] = useState<InviteFlow | null>(null);
  const [currentStep, setCurrentStep] = useState<0 | 1>(0);
  const [qrData, setQrData] = useState('');
  const [showQRScanner, setShowQRScanner] = useState(false);
  
  // Animation values
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const hasInvite = useMemo(() => {
    if (inviteMethod === 'code') {
      return code.trim().length === 6;
    }

    return !!qrData.trim();
  }, [code, inviteMethod, qrData]);

  const qrPreview = useMemo(() => {
    if (!qrData.trim()) {
      return null;
    }

    try {
      const parsed = JSON.parse(qrData);
      return {
        businessName: parsed.businessName || parsed.business || null,
        code: parsed.code || parsed.otp || null,
      };
    } catch (error) {
      return null;
    }
  }, [qrData]);

  useEffect(() => {
    let mounted = true;

    const loadAuthState = async () => {
      const token = await storage.getToken();
      const normalizedToken = typeof token === 'string' ? token.trim() : '';
      const hasValidToken = !!normalizedToken && normalizedToken !== 'null' && normalizedToken !== 'undefined';
      if (mounted) {
        setHasAuthToken(hasValidToken);
      }
    };

    loadAuthState();

    return () => {
      mounted = false;
    };
  }, []);

  const getInviteCode = () => {
    if (inviteMethod === 'code') return code.trim();

    if (!qrData.trim()) return '';

    try {
      const parsed = JSON.parse(qrData);
      return (parsed.code || parsed.otp || '').toString().trim();
    } catch {
      return '';
    }
  };

  const buildUsernameFromName = (fullName: string) => {
    const base = fullName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s_]/g, '')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/^[^a-z]+/g, '');

    const fallback = base || 'employee';
    const compactBase = fallback.slice(0, 16);
    const suffix = Date.now().toString().slice(-4);
    const username = `${compactBase}_${suffix}`;

    return username.length >= 3 ? username : `emp_${suffix}`;
  };

  const extractErrorMessage = (error: any): string => {
    const payload = error?.response?.data;

    if (typeof payload === 'string' && payload.trim()) {
      return payload;
    }

    if (typeof payload?.error === 'string' && payload.error.trim()) {
      return payload.error;
    }

    if (typeof payload?.message === 'string' && payload.message.trim()) {
      return payload.message;
    }

    if (Array.isArray(payload?.message) && payload.message.length > 0) {
      return payload.message.join(', ');
    }

    return error?.message || 'Failed to register as employee';
  };

  const extractValidationDetails = (error: any): string => {
    const details = error?.response?.data?.details;

    if (!Array.isArray(details) || details.length === 0) {
      return '';
    }

    return details
      .map((detail: any) => detail?.message || detail?.path?.join?.('.'))
      .filter(Boolean)
      .join(', ');
  };

  const needsUsernameFallback = (error: any): boolean => {
    const message = `${extractErrorMessage(error)} ${extractValidationDetails(error)}`.toLowerCase();
    return /username/.test(message);
  };

  const getCurrentAuthState = async (): Promise<boolean> => {
    const token = await storage.getToken();
    const normalizedToken = typeof token === 'string' ? token.trim() : '';
    return !!normalizedToken && normalizedToken !== 'null' && normalizedToken !== 'undefined';
  };

  const detectInviteFlow = (validation: any, parsedQR?: any): InviteFlow => {
    const data = validation?.data || validation || {};
    const qrType = String(parsedQR?.type || '').toLowerCase();
    const backendType = String(data?.type || data?.codeType || data?.accessType || '').toLowerCase();
    const backendPurpose = String(data?.purpose || data?.action || '').toLowerCase();

    const explicitExisting =
      data?.isExistingEmployee === true ||
      data?.existingEmployee === true ||
      data?.flow === 'existing' ||
      backendPurpose === 'login' ||
      backendType.includes('login') ||
      qrType === 'employee_login';

    if (explicitExisting) return 'existing';

    const explicitNew =
      data?.isNewEmployee === true ||
      data?.requiresRegistration === true ||
      data?.flow === 'new' ||
      backendPurpose === 'register' ||
      backendType.includes('register') ||
      backendType.includes('invite') ||
      qrType === 'employee_registration' ||
      qrType === 'employee_invite';

    if (explicitNew) return 'new';

    // Safe default: unknown codes should go through new registration
    // so we provide username/name instead of failing backend validation.
    return 'new';
  };

  const switchMethod = (method: InviteMethod) => {
    if (inviteMethod === method) return;
    
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: method === 'qr' ? 20 : -20,
        duration: 150,
        useNativeDriver: true,
      })
    ]).start(() => {
      setInviteMethod(method);
      slideAnim.setValue(method === 'qr' ? -20 : 20);
      
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        })
      ]).start();
    });
  };

  const handleContinue = async () => {
    if (!hasInvite) {
      Alert.alert('Error', inviteMethod === 'code' ? 'Please enter the 6-digit access code' : 'Please scan the QR code');
      return;
    }

    const inviteCode = getInviteCode();
    if (!/^\d{6}$/.test(inviteCode)) {
      Alert.alert('Error', 'Access code must be 6 digits');
      return;
    }

    setLoading(true);
    try {
      const authenticatedNow = await getCurrentAuthState();
      if (hasAuthToken !== authenticatedNow) {
        setHasAuthToken(authenticatedNow);
      }

      const validation = await employeeAPI.validateAccessCode(inviteCode);
      const parsedQR = inviteMethod === 'qr' && qrData ? JSON.parse(qrData) : null;
      const flow = detectInviteFlow(validation, parsedQR);
      // If not authenticated, always route through account setup.
      // Backend requires username/phone + password to create an account.
      const resolvedFlow: InviteFlow = authenticatedNow ? flow : 'new';
      setInviteFlow(resolvedFlow);

      if (resolvedFlow === 'existing') {
        await handleRegister('existing');
        return;
      }

      setCurrentStep(1);
    } catch (error: any) {
      const message = error?.response?.data?.error || error?.message || 'Invalid or expired code';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (overrideFlow?: InviteFlow) => {
    const authenticatedNow = await getCurrentAuthState();
    if (hasAuthToken !== authenticatedNow) {
      setHasAuthToken(authenticatedNow);
    }

    const requestedFlow = overrideFlow || inviteFlow || 'new';
    const flow: InviteFlow = authenticatedNow ? requestedFlow : 'new';

    if (!hasInvite) {
      Alert.alert('Error', inviteMethod === 'code' ? 'Please enter the 6-digit access code' : 'Please scan the QR code');
      return;
    }

    const inviteCode = getInviteCode();
    if (!/^\d{6}$/.test(inviteCode)) {
      Alert.alert('Error', 'Access code must be 6 digits');
      return;
    }

    if (flow === 'new' && !name.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    if (flow === 'new' && !authenticatedNow && !password.trim()) {
      Alert.alert('Error', 'Password is required to create your employee account');
      return;
    }

    if (flow === 'new' && !authenticatedNow && password.trim().length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const normalizedName = name.trim();
      const generatedUsername = buildUsernameFromName(normalizedName || `employee_${inviteCode}`);

      const registerData: any = {
        code: inviteMethod === 'code' ? inviteCode : undefined,
        qrData: inviteMethod === 'qr' ? qrData.trim() : undefined,
        name: flow === 'new' ? normalizedName : undefined,
        username: !authenticatedNow ? generatedUsername : flow === 'new' ? generatedUsername : undefined,
        password: !authenticatedNow ? password.trim() : undefined,
      };

      console.log('🔍 [EmployeeRegister] register payload', {
        flow,
        hasAuthToken: authenticatedNow,
        hasCode: !!registerData.code,
        hasQrData: !!registerData.qrData,
        hasName: !!registerData.name,
        hasUsername: !!registerData.username,
        hasPassword: !!registerData.password,
      });

      let response: any;
      try {
        response = await employeeAPI.register(registerData);
      } catch (firstError: any) {
        if (flow === 'new' && needsUsernameFallback(firstError)) {
          // Keep username short and predictable for stricter backend validators.
          const fallbackData = {
            ...registerData,
            username: `emp_${Date.now().toString().slice(-6)}`,
          };
          response = await employeeAPI.register(fallbackData);
        } else {
          throw firstError;
        }
      }

      if (response.success) {
        // If new account was created, save token and fetch user info
        if (response.data.token) {
          await storage.setToken(response.data.token);
          console.log('✅ [EmployeeRegister] Token saved');
          
          // Fetch user info and save (this includes API key)
          try {
            const { authAPI } = await import('../services/api');
            const userResponse = await authAPI.getMe();
            if (userResponse.success && userResponse.data) {
              await storage.setUser(userResponse.data);
              // Also save API key if available
              if (userResponse.data.apiKey) {
                await storage.setApiKey(userResponse.data.apiKey);
                console.log('✅ [EmployeeRegister] API key saved');
              }
            }
          } catch (error) {
            console.error('❌ [EmployeeRegister] Error fetching user info:', error);
          }
        } else {
          // If already authenticated, just refresh user info
          try {
            const { authAPI } = await import('../services/api');
            const userResponse = await authAPI.getMe();
            if (userResponse.success && userResponse.data) {
              await storage.setUser(userResponse.data);
              if (userResponse.data.apiKey) {
                await storage.setApiKey(userResponse.data.apiKey);
              }
            }
          } catch (error) {
            console.error('Error refreshing user info:', error);
          }
        }

        Alert.alert('Success', response.data.message || 'Employee registration successful!', [
          {
            text: 'OK',
            onPress: () => {
              onRegistrationSuccess();
            },
          },
        ]);
      } else {
        Alert.alert('Error', response.error || 'Failed to register as employee');
      }
    } catch (error: any) {
      console.error('Employee registration error:', error);
      const rawErrorMessage = extractErrorMessage(error);
      const validationDetails = extractValidationDetails(error);
      const errorMessage = validationDetails ? `${rawErrorMessage}: ${validationDetails}` : rawErrorMessage;

      if (
        flow === 'existing' &&
        typeof errorMessage === 'string' &&
        /username|phone/i.test(errorMessage)
      ) {
        setInviteFlow('new');
        setCurrentStep(1);
        Alert.alert('Complete Setup', 'This invite requires creating employee details. Please enter your name to continue.');
        return;
      }

      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleQRScan = () => {
    setShowQRScanner(true);
  };

  const handleQRScanned = (data: string) => {
    setQrData(data);
    setShowQRScanner(false);
    setInviteMethod('qr');
  };

  if (showQRScanner) {
    return (
      <QRCodeScanner
        onScan={handleQRScanned}
        onClose={() => setShowQRScanner(false)}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Employee Access</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Use the admin invite code or QR to sign in or create employee access
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.stepper}>
            {[1, 2].map((step) => {
              const isActive = currentStep === step - 1;
              const isCompleted = currentStep > step - 1;

              return (
                <View key={step} style={styles.stepperItem}>
                  <View
                    style={[
                      styles.stepBadge,
                      {
                        backgroundColor: isActive || isCompleted ? colors.primary : colors.background,
                        borderColor: isActive || isCompleted ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.stepBadgeText, { color: isActive || isCompleted ? '#fff' : colors.textSecondary }]}>
                      {step}
                    </Text>
                  </View>
                  <Text style={[styles.stepperLabel, { color: isActive ? colors.text : colors.textSecondary }]}>
                    {step === 1 ? 'Invite' : 'Access'}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Segmented Control */}
          <View style={[styles.segmentedControl, { backgroundColor: colors.background }]}>
            <TouchableOpacity
              style={[
                styles.segmentButton,
                inviteMethod === 'code' && { backgroundColor: colors.surface, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 }
              ]}
              onPress={() => switchMethod('code')}
              disabled={loading}
            >
              <Key size={18} color={inviteMethod === 'code' ? colors.primary : colors.textSecondary} />
              <Text style={[
                styles.segmentText,
                { color: inviteMethod === 'code' ? colors.primary : colors.textSecondary, fontWeight: inviteMethod === 'code' ? '600' : '500' }
              ]}>
                Access Code
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.segmentButton,
                inviteMethod === 'qr' && { backgroundColor: colors.surface, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 }
              ]}
              onPress={() => switchMethod('qr')}
              disabled={loading}
            >
              <QrCode size={18} color={inviteMethod === 'qr' ? colors.primary : colors.textSecondary} />
              <Text style={[
                styles.segmentText,
                { color: inviteMethod === 'qr' ? colors.primary : colors.textSecondary, fontWeight: inviteMethod === 'qr' ? '600' : '500' }
              ]}>
                Scan QR
              </Text>
            </TouchableOpacity>
          </View>

          <Animated.View style={[
            styles.contentContainer, 
            { 
              opacity: fadeAnim,
              transform: [{ translateX: slideAnim }]
            }
          ]}>
            {currentStep === 0 ? inviteMethod === 'code' ? (
              <View style={styles.inputSection}>
                <Text style={[styles.label, { color: colors.text }]}>Enter 6-Digit Code</Text>
                <TextInput
                  style={[
                    styles.input, 
                    { 
                      backgroundColor: colors.background, 
                      color: colors.text, 
                      borderColor: code.length === 6 ? colors.primary : colors.border 
                    }
                  ]}
                  placeholder="000000"
                  placeholderTextColor={colors.textSecondary}
                  value={code}
                  onChangeText={(text) => {
                    const digitsOnly = text.replace(/[^0-9]/g, '').slice(0, 6);
                    setCode(digitsOnly);
                  }}
                  keyboardType="number-pad"
                  maxLength={6}
                  editable={!loading}
                  textAlign="center"
                />
                <Text style={[styles.hint, { color: colors.textSecondary }]}>
                  Ask your employer for the access code
                </Text>
              </View>
            ) : (
              <View style={styles.inputSection}>
                <Text style={[styles.label, { color: colors.text }]}>Scan Invitation QR</Text>
                
                {qrData ? (
                  <View style={[styles.qrStatusCard, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
                    <View style={styles.qrStatusContent}>
                      <CheckCircle2 size={32} color={colors.primary} />
                      <Text style={[styles.qrStatusTitle, { color: colors.text }]}>QR Code Scanned</Text>
                      <Text style={[styles.qrStatusSub, { color: colors.textSecondary }]}>Ready to connect</Text>
                    </View>
                    <TouchableOpacity 
                      style={[styles.rescanButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      onPress={handleQRScan}
                      disabled={loading}
                    >
                      <RefreshCcw size={14} color={colors.textSecondary} />
                      <Text style={[styles.rescanText, { color: colors.textSecondary }]}>Scan Again</Text>
                    </TouchableOpacity>
                    {qrPreview?.businessName && (
                      <Text style={[styles.qrPreviewText, { color: colors.textSecondary }]}>Business: {qrPreview.businessName}</Text>
                    )}
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.scanPlaceholder, { borderColor: colors.border, backgroundColor: colors.background }]}
                    onPress={handleQRScan}
                    disabled={loading}
                  >
                    <View style={[styles.scanIconCircle, { backgroundColor: colors.primary + '15' }]}>
                      <QrCode size={32} color={colors.primary} />
                    </View>
                    <Text style={[styles.scanPlaceholderText, { color: colors.primary }]}>Tap to Scan QR Code</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.accessSection}>
                <Text style={[styles.label, { color: colors.text }]}>New Employee Details</Text>
                <Text style={[styles.hint, { color: colors.textSecondary, marginBottom: 14 }]}>Enter your name to finish account creation.</Text>

                {inviteFlow === 'new' && (
                  <View style={styles.nameSection}>
                    <View style={[styles.nameIconWrap, { backgroundColor: colors.primary + '15' }]}>
                      <UserRound size={22} color={colors.primary} />
                    </View>
                    <Text style={[styles.nameLabel, { color: colors.text }]}>Your Name</Text>
                    <TextInput
                      style={[styles.nameInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                      placeholder="Enter your full name"
                      placeholderTextColor={colors.textSecondary}
                      value={name}
                      onChangeText={setName}
                      editable={!loading}
                      autoCapitalize="words"
                    />
                    <Text style={[styles.hint, { color: colors.textSecondary }]}>This name is used on the employee profile.</Text>

                    {!hasAuthToken && (
                      <>
                        <Text style={[styles.nameLabel, { color: colors.text, marginTop: 16 }]}>Create Password</Text>
                        <TextInput
                          style={[styles.nameInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                          placeholder="At least 6 characters"
                          placeholderTextColor={colors.textSecondary}
                          value={password}
                          onChangeText={setPassword}
                          editable={!loading}
                          secureTextEntry
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                        <Text style={[styles.hint, { color: colors.textSecondary }]}>Used to log into your employee account later.</Text>
                      </>
                    )}
                  </View>
                )}
              </View>
            )}
          </Animated.View>

          <View style={styles.actionRow}>
            {currentStep === 1 ? (
              <TouchableOpacity
                style={[styles.backButton, { borderColor: colors.border, backgroundColor: colors.background }]}
                onPress={() => setCurrentStep(0)}
                disabled={loading}
              >
                <Text style={[styles.backButtonText, { color: colors.text }]}>Back</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.actionSpacer} />
            )}

            <TouchableOpacity
              style={[
                styles.submitButton,
                currentStep === 1 && styles.submitButtonCompact,
                {
                  backgroundColor: colors.primary,
                  opacity: loading || (currentStep === 0 ? !hasInvite : inviteFlow === 'new' && (!name.trim() || (!hasAuthToken && password.trim().length < 6))) ? 0.6 : 1,
                }
              ]}
              onPress={currentStep === 0 ? handleContinue : handleRegister}
              disabled={loading || (currentStep === 0 ? !hasInvite : inviteFlow === 'new' && (!name.trim() || (!hasAuthToken && password.trim().length < 6)))}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.submitButtonText}>{currentStep === 0 ? 'Continue' : 'Use Invite'}</Text>
                  <ArrowRight size={20} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {onCancel && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onCancel}
            disabled={loading}
          >
            <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 40,
    alignItems: 'center',
  },
  stepper: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 28,
    marginBottom: 20,
  },
  stepperItem: {
    alignItems: 'center',
    gap: 8,
  },
  stepBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  stepperLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    maxWidth: '80%',
    lineHeight: 24,
  },
  card: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 5,
  },
  segmentedControl: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 16,
    marginBottom: 32,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  segmentText: {
    fontSize: 14,
  },
  contentContainer: {
    minHeight: 180,
  },
  accessSection: {
    width: '100%',
  },
  inputSection: {
    alignItems: 'center',
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
    opacity: 0.7,
  },
  input: {
    width: '100%',
    borderWidth: 2,
    borderRadius: 16,
    padding: 20,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 8,
    textAlign: 'center',
    marginBottom: 12,
  },
  hint: {
    fontSize: 13,
    textAlign: 'center',
  },
  nameSection: {
    marginTop: 4,
    alignItems: 'center',
    width: '100%',
  },
  nameIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  nameLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  nameInput: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 8,
  },
  scanPlaceholder: {
    width: '100%',
    height: 160,
    borderRadius: 20,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  scanIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanPlaceholderText: {
    fontSize: 16,
    fontWeight: '600',
  },
  qrStatusCard: {
    width: '100%',
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    gap: 16,
  },
  qrStatusContent: {
    alignItems: 'center',
    gap: 8,
  },
  qrStatusTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  qrStatusSub: {
    fontSize: 14,
  },
  qrPreviewText: {
    fontSize: 13,
    textAlign: 'center',
  },
  rescanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  rescanText: {
    fontSize: 13,
    fontWeight: '600',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 16,
    marginTop: 32,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  submitButtonCompact: {
    flex: 1,
    marginTop: 0,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 32,
  },
  actionSpacer: {
    flex: 1,
  },
  backButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    padding: 20,
    alignItems: 'center',
    marginTop: 12,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
});

