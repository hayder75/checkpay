import React, { useState, useEffect, useRef } from 'react';
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
  Linking,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { authAPI, telegramAuthAPI } from '../services/api';
import { patternsAPI } from '../services/api';
import PhoneInput from '../components/PhoneInput';
import { parsePhoneNumber } from '../utils/phoneCodes';
import { Pattern } from '../types';
import { storage } from '../services/storage';
import { signInWithGoogle, completeGoogleAuth } from '../services/googleAuth';
import Svg, { Path } from 'react-native-svg';

interface Props {
  onRegisterSuccess: (user: any, apiKey: string, patterns: Pattern[]) => void;
  onSwitchToLogin: () => void;
}

type AccountType = 'BUSINESS_OWNER' | 'DEVELOPER';

export default function RegisterScreen({ onRegisterSuccess, onSwitchToLogin }: Props) {
  const { colors } = useTheme();
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [country, setCountry] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('BUSINESS_OWNER');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [botUsername, setBotUsername] = useState<string>('');
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load Telegram bot info on mount
  useEffect(() => {
    telegramAuthAPI.getBotInfo()
      .then((res) => {
        if (res?.data?.botUsername) {
          setBotUsername(res.data.botUsername);
        }
      })
      .catch(() => {
        // Telegram not configured
      });

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Complete registration/login with user data
  const completeAuth = async (token: string, user: any) => {
    await storage.setToken(token);
    await storage.setUser(user);
    
    const apiKey = user.apiKey;
    if (apiKey) {
      await storage.setApiKey(apiKey);
      
      // Fetch patterns
      try {
        const patternsResponse = await patternsAPI.getAll();
        const patterns = patternsResponse?.success && patternsResponse?.data 
          ? (Array.isArray(patternsResponse.data) ? patternsResponse.data : [])
          : [];
        onRegisterSuccess(user, apiKey, patterns);
      } catch (error) {
        onRegisterSuccess(user, apiKey, []);
      }
    } else {
      Alert.alert('Error', 'No API key found for this account.');
    }
  };

  // Handle Telegram deep link authentication
  const handleTelegramAuth = async () => {
    if (!botUsername) {
      Alert.alert('Error', 'Telegram registration is not configured');
      return;
    }

    setTelegramLoading(true);
    try {
      // Get auth token from backend
      const initResponse = await telegramAuthAPI.init();
      if (!initResponse?.success || !initResponse?.data?.token) {
        Alert.alert('Error', 'Failed to initialize Telegram authentication');
        return;
      }

      const { token, deepLink } = initResponse.data;

      // Open Telegram with deep link
      const supported = await Linking.canOpenURL(deepLink);
      if (supported) {
        await Linking.openURL(deepLink);
      } else {
        // Fallback to web link
        await Linking.openURL(`https://t.me/${botUsername}?start=${token}`);
      }

      // Start polling for auth completion
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes with 5 second intervals

      pollingIntervalRef.current = setInterval(async () => {
        attempts++;
        
        try {
          const statusResponse = await telegramAuthAPI.checkStatus(token);
          
          if (statusResponse?.status === 'COMPLETED' && statusResponse?.data) {
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
            }
            
            await completeAuth(statusResponse.data.token, statusResponse.data.user);
            setTelegramLoading(false);
          } else if (statusResponse?.status === 'EXPIRED' || attempts >= maxAttempts) {
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
            }
            setTelegramLoading(false);
            if (attempts >= maxAttempts) {
              Alert.alert('Timeout', 'Telegram authentication timed out. Please try again.');
            }
          }
        } catch (error) {
          // Continue polling on error
        }
      }, 5000);

    } catch (error: any) {
      setTelegramLoading(false);
      Alert.alert('Error', error.message || 'Failed to start Telegram authentication');
    }
  };

  const handleRegister = async () => {
    if (!username.trim() && !phone.trim()) {
      Alert.alert('Error', 'Please enter your username or phone number');
      return;
    }

    if (!password.trim()) {
      Alert.alert('Error', 'Please enter a password');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      // Prepare registration data - only include fields that have values
      const registerData: {
        username?: string;
        phone?: string;
        country?: string;
        password: string;
        role?: AccountType;
      } = {
        password: password.trim(),
        role: accountType,
      };
      
      // Add username if provided
      if (username.trim()) {
        registerData.username = username.trim();
      }
      
      // Add phone if provided (must be at least 10 characters for backend validation)
      if (phone.trim()) {
        const cleanedPhone = phone.trim();
        // Remove country code prefix if present for validation
        const phoneWithoutCode = cleanedPhone.replace(/^\+\d{1,4}/, '');
        if (phoneWithoutCode.length >= 10 || cleanedPhone.length >= 10) {
          registerData.phone = cleanedPhone;
        } else {
          Alert.alert('Error', 'Phone number must be at least 10 digits');
          setLoading(false);
          return;
        }
      }
      
      // Add country if provided (use 2-letter country code, not calling code)
      if (country.trim()) {
        registerData.country = country.trim().toUpperCase().substring(0, 2);
      }
      
      // Ensure at least username or phone is provided
      if (!registerData.username && !registerData.phone) {
        Alert.alert('Error', 'Please enter either username or phone number');
        setLoading(false);
        return;
      }
      
      // Register user with password (no OTP)
      const response = await authAPI.register(registerData);

      if (response.success) {
        // Backend register endpoint returns token and user directly
        const { token, user } = response.data;
        
        if (!token || !user) {
          Alert.alert('Error', 'Registration successful but failed to get authentication data. Please try logging in.');
          return;
        }
        
        // Store token and user
        await storage.setToken(token);
        await storage.setUser(user);
        
        // Get API key from user
        const apiKey = user.apiKey;
        if (apiKey) {
          await storage.setApiKey(apiKey);
          
          // Fetch patterns from real API
          try {
            const patternsResponse = await patternsAPI.getAll();
            if (patternsResponse.success && patternsResponse.data) {
              const patterns = Array.isArray(patternsResponse.data) 
                ? patternsResponse.data 
                : [];
              onRegisterSuccess(user, apiKey, patterns);
            } else {
              onRegisterSuccess(user, apiKey, []);
            }
          } catch (error) {
            console.error('Error fetching patterns:', error);
            onRegisterSuccess(user, apiKey, []);
          }
        } else {
          Alert.alert('Error', 'No API key found for this account. Please contact support.');
        }
      } else {
        Alert.alert('Error', response.message || 'Registration failed');
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      
      // Log validation details for debugging
      if (error.response?.data?.details) {
        console.error('Validation details:', error.response.data.details);
      }
      
      // Extract error message
      let errorMessage = error.response?.data?.error || error.message || 'Registration failed';
      
      // Add validation details if available
      if (error.response?.data?.details && Array.isArray(error.response.data.details)) {
        const details = error.response.data.details.map((d: any) => d.message || d.path?.join('.')).join(', ');
        if (details) {
          errorMessage = `${errorMessage}: ${details}`;
        }
      }
      
      Alert.alert('Registration Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      
      if (result.success && result.token && result.user) {
        // Complete authentication
        await completeGoogleAuth(result.token, result.user, onRegisterSuccess);
      } else {
        Alert.alert('Error', result.error || 'Google sign-in failed');
      }
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      Alert.alert('Error', error.message || 'Google sign-in failed');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>CheckPay</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Create an account
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Username (Optional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="johndoe"
              placeholderTextColor={colors.textSecondary}
              value={username}
              onChangeText={(text) => setUsername(text.replace(/[^a-zA-Z0-9_]/g, ''))}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={30}
            />
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              3-30 characters, letters, numbers, and underscores only
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Phone Number (Optional)</Text>
            <PhoneInput
              value={phone}
              onChangeText={setPhone}
              placeholder="712345678"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Password</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="Enter password (min 6 characters)"
              placeholderTextColor={colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Confirm Password</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="Confirm password"
              placeholderTextColor={colors.textSecondary}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Account Type</Text>
            <View style={styles.accountTypeContainer}>
              <TouchableOpacity
                style={[
                  styles.accountTypeOption,
                  { 
                    backgroundColor: accountType === 'BUSINESS_OWNER' ? colors.primary : colors.surface,
                    borderColor: accountType === 'BUSINESS_OWNER' ? colors.primary : colors.border,
                  }
                ]}
                onPress={() => setAccountType('BUSINESS_OWNER')}
              >
                <Text style={styles.accountTypeIcon}>🏢</Text>
                <View style={styles.accountTypeTextContainer}>
                  <Text style={[
                    styles.accountTypeText,
                    { color: accountType === 'BUSINESS_OWNER' ? colors.primaryText : colors.text }
                  ]}>
                    Business Owner
                  </Text>
                  <Text style={[
                    styles.accountTypeDescription,
                    { color: accountType === 'BUSINESS_OWNER' ? colors.primaryText + 'CC' : colors.textSecondary }
                  ]}>
                    Manage businesses & employees
                  </Text>
                </View>
                {accountType === 'BUSINESS_OWNER' && (
                  <Text style={styles.accountTypeCheck}>✓</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.accountTypeOption,
                  { 
                    backgroundColor: accountType === 'DEVELOPER' ? colors.primary : colors.surface,
                    borderColor: accountType === 'DEVELOPER' ? colors.primary : colors.border,
                  }
                ]}
                onPress={() => setAccountType('DEVELOPER')}
              >
                <Text style={styles.accountTypeIcon}>💻</Text>
                <View style={styles.accountTypeTextContainer}>
                  <Text style={[
                    styles.accountTypeText,
                    { color: accountType === 'DEVELOPER' ? colors.primaryText : colors.text }
                  ]}>
                    Developer
                  </Text>
                  <Text style={[
                    styles.accountTypeDescription,
                    { color: accountType === 'DEVELOPER' ? colors.primaryText + 'CC' : colors.textSecondary }
                  ]}>
                    Build projects & integrations
                  </Text>
                </View>
                {accountType === 'DEVELOPER' && (
                  <Text style={styles.accountTypeCheck}>✓</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>
              Country <Text style={{ color: colors.primary }}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: country ? colors.primary : colors.border }]}
              placeholder="ET, KE, NG, etc."
              placeholderTextColor={colors.textSecondary}
              value={country}
              onChangeText={(text) => setCountry(text.toUpperCase().substring(0, 2))}
              autoCapitalize="characters"
              maxLength={2}
            />
            <Text style={[styles.hintSmall, { color: colors.textSecondary }]}>
              2-letter country code (required for pattern matching)
            </Text>
          </View>

          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            At least one of username or phone is required. Password must be at least 8 characters.
          </Text>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }, (loading || (!username && !phone) || !password || password !== confirmPassword || !country) && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading || (!username && !phone) || !password || password !== confirmPassword || !country}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <Text style={[styles.buttonText, { color: colors.primaryText }]}>
                Create Account
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.textSecondary }]}>OR</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          <TouchableOpacity
            style={[styles.googleButton, { borderColor: colors.border }, googleLoading && styles.buttonDisabled]}
            onPress={handleGoogleSignIn}
            disabled={googleLoading || loading || telegramLoading}
          >
            {googleLoading ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <>
                <View style={styles.googleIcon}>
                  <Text style={styles.googleIconText}>G</Text>
                </View>
                <Text style={[styles.googleButtonText, { color: colors.text }]}>
                  Continue with Google
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Telegram Register Button */}
          {botUsername && (
            <TouchableOpacity
              style={[styles.telegramButton, telegramLoading && styles.buttonDisabled]}
              onPress={handleTelegramAuth}
              disabled={telegramLoading || loading || googleLoading}
            >
              {telegramLoading ? (
                <>
                  <ActivityIndicator color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.telegramButtonText}>
                    Waiting for Telegram...
                  </Text>
                </>
              ) : (
                <>
                  <View style={styles.telegramIcon}>
                    <Svg width="20" height="20" viewBox="0 0 24 24">
                      <Path
                        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"
                        fill="#FFFFFF"
                      />
                    </Svg>
                  </View>
                  <Text style={styles.telegramButtonText}>
                    Continue with Telegram
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.switchButton}
            onPress={onSwitchToLogin}
          >
            <Text style={[styles.switchText, { color: colors.primary }]}>
              Already have an account? Sign in
            </Text>
          </TouchableOpacity>
        </View>
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
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  form: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  hint: {
    fontSize: 12,
    marginTop: 4,
  },
  button: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  switchButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  switchText: {
    fontSize: 14,
    fontWeight: '500',
  },
  accountTypeContainer: {
    gap: 12,
  },
  accountTypeOption: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountTypeIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  accountTypeTextContainer: {
    flex: 1,
  },
  accountTypeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  accountTypeDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  accountTypeCheck: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  hintSmall: {
    fontSize: 11,
    marginTop: 4,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  googleButton: {
    height: 50,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  googleIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  googleIconText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  telegramButton: {
    height: 50,
    borderRadius: 8,
    backgroundColor: '#0088CC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  telegramIcon: {
    marginRight: 12,
  },
  telegramButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});



