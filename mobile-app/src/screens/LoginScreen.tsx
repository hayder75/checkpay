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
  Image,
  Linking,
  Modal,
} from 'react-native';
import { storage } from '../services/storage';
import { useTheme } from '../contexts/ThemeContext';
import { Pattern } from '../types';
import { authAPI, otpAuthAPI, telegramAuthAPI } from '../services/api';
import { patternsAPI } from '../services/api';
import PhoneInput from '../components/PhoneInput';
import { validatePhoneNumber } from '../utils/phoneCodes';
import { signInWithGoogle, completeGoogleAuth } from '../services/googleAuth';
import Svg, { Path, Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

interface Props {
  onLoginSuccess: (user: any, apiKey: string, patterns: Pattern[]) => void;
  onSwitchToRegister?: () => void;
  onSwitchToEmployeeRegister?: () => void;
}

const PENDING_TELEGRAM_AUTH_TOKEN_KEY = 'pending_telegram_auth_token';

export default function LoginScreen({ onLoginSuccess, onSwitchToRegister, onSwitchToEmployeeRegister }: Props) {
  const { theme, colors } = useTheme();
  const { t } = useTranslation();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [telegramLoading, setTelegramLoading] = useState(false);
  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetOtpSent, setResetOtpSent] = useState(false);
  const [resetOtpCode, setResetOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
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

  // Complete login with user data
  const completeLogin = async (token: string, user: any) => {
    await storage.removeItem(PENDING_TELEGRAM_AUTH_TOKEN_KEY);
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
        onLoginSuccess(user, apiKey, patterns);
      } catch (error) {
        onLoginSuccess(user, apiKey, []);
      }
    } else {
      Alert.alert(t('common.error'), t('auth.noApiKeyFound'));
    }
  };

  // Handle Telegram deep link login
  const handleTelegramLogin = async () => {
    if (!botUsername) {
      Alert.alert(t('common.error'), t('login.telegramNotConfigured'));
      return;
    }

    setTelegramLoading(true);
    try {
      // Get auth token from backend
      const initResponse = await telegramAuthAPI.init();
      if (!initResponse?.success || !initResponse?.data?.token) {
        Alert.alert(t('common.error'), t('login.telegramInitFailed'));
        return;
      }

      const { token, deepLink } = initResponse.data;
      await storage.setItem(PENDING_TELEGRAM_AUTH_TOKEN_KEY, token);

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
            
            await completeLogin(statusResponse.data.token, statusResponse.data.user);
            setTelegramLoading(false);
          } else if (statusResponse?.status === 'EXPIRED' || attempts >= maxAttempts) {
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
            }
            await storage.removeItem(PENDING_TELEGRAM_AUTH_TOKEN_KEY);
            setTelegramLoading(false);
            if (attempts >= maxAttempts) {
              Alert.alert(
                t('login.timeoutTitle'),
                t('login.telegramAuthTimeout')
              );
            }
          }
        } catch (error) {
          // Continue polling on error
        }
      }, 5000);

    } catch (error: any) {
      await storage.removeItem(PENDING_TELEGRAM_AUTH_TOKEN_KEY);
      setTelegramLoading(false);
      Alert.alert(t('common.error'), error.message || t('login.telegramStartFailed'));
    }
  };

  // Request password reset OTP
  const handleRequestPasswordReset = async () => {
    if (!phone.trim()) {
      Alert.alert(t('common.error'), t('auth.enterPhoneNumber'));
      return;
    }

    if (!validatePhoneNumber(phone.trim())) {
      Alert.alert(t('common.error'), t('login.enterValidPhoneWithCountryCode'));
      return;
    }

    setResetLoading(true);
    try {
      const response = await otpAuthAPI.requestPasswordReset({ phone: phone.trim() });
      
      if (response.success) {
        setResetOtpSent(true);
        Alert.alert(
          t('login.otpSentTitle'),
          response.message || t('login.passwordResetOtpSent')
        );
      } else {
        Alert.alert(t('common.error'), response.message || t('login.failedToSendOtp'));
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || '';
      if (errorMessage.includes('Link Telegram') || errorMessage.includes('link your Telegram')) {
        Alert.alert(
          t('login.telegramNotLinkedTitle'),
          t('login.telegramNotLinkedMessage'),
        );
      } else {
        Alert.alert(t('common.error'), errorMessage || t('login.failedToSendOtp'));
      }
    } finally {
      setResetLoading(false);
    }
  };

  // Verify OTP and reset password
  const handleResetPassword = async () => {
    if (!resetOtpCode.trim()) {
      Alert.alert(t('common.error'), t('login.enterOtpCode'));
      return;
    }
    if (!newPassword.trim()) {
      Alert.alert(t('common.error'), t('login.enterNewPassword'));
      return;
    }
    if (newPassword !== confirmNewPassword) {
      Alert.alert(t('common.error'), t('login.passwordsDoNotMatch'));
      return;
    }

    setResetLoading(true);
    try {
      const response = await otpAuthAPI.verifyPasswordReset({
        phone: phone.trim(),
        code: resetOtpCode.trim(),
        newPassword: newPassword.trim(),
      });

      if (response.success) {
        Alert.alert(
          t('common.success'),
          t('login.passwordResetSuccess')
        );
        setShowForgotPassword(false);
        setResetOtpSent(false);
        setResetOtpCode('');
        setNewPassword('');
        setConfirmNewPassword('');
      } else {
        Alert.alert(t('common.error'), response.message || t('login.failedToResetPassword'));
      }
    } catch (error: any) {
      Alert.alert(t('common.error'), error.response?.data?.error || t('login.failedToResetPassword'));
    } finally {
      setResetLoading(false);
    }
  };


  const handleLogin = async () => {
    if (!phone.trim()) {
      Alert.alert(t('common.error'), t('auth.enterPhoneNumber'));
      return;
    }

    // Validate phone number format
    if (!validatePhoneNumber(phone.trim())) {
      Alert.alert(
        t('common.error'),
        t('login.enterValidPhoneWithExample')
      );
      return;
    }

    if (!password.trim()) {
      Alert.alert(t('common.error'), t('auth.enterPassword'));
      return;
    }

    setLoading(true);
    try {
      // Use real API authentication - phone only
      const response = await authAPI.login({
        phone: phone.trim(),
        password: password.trim(),
      });

      if (response.success) {
        const { token, user } = response.data;
        
        if (!token) {
          Alert.alert(t('common.error'), t('login.noTokenReceived'));
          return;
        }
        
        // Store token and user
        console.log('💾 [Login] Saving authentication data...');
        await storage.setToken(token);
        await storage.setUser(user);
        
        // Verify token was saved
        const savedToken = await storage.getToken();
        if (!savedToken || savedToken !== token) {
          console.error('❌ [Login] Token was not saved correctly');
          Alert.alert(t('common.error'), t('login.failedSaveAuthToken'));
          return;
        }
        
        // Get API key from user
        const apiKey = user.apiKey;
        if (apiKey) {
          await storage.setApiKey(apiKey);
          
          // Verify API key was saved
          const savedApiKey = await storage.getApiKey();
          if (!savedApiKey || savedApiKey !== apiKey) {
            console.error('❌ [Login] API key was not saved correctly');
            Alert.alert(t('common.error'), t('login.failedSaveApiKey'));
            return;
          }
          
          console.log('✅ [Login] Authentication data saved successfully (token + API key)');
          
          // Fetch patterns from real API
          try {
            const patternsResponse = await patternsAPI.getAll();
            if (patternsResponse.success && patternsResponse.data) {
              const patterns = Array.isArray(patternsResponse.data) 
                ? patternsResponse.data 
                : [];
              // Patterns are now always fetched from backend, no local storage
              onLoginSuccess(user, apiKey, patterns);
            } else {
              onLoginSuccess(user, apiKey, []);
            }
          } catch (error) {
            console.error('Error fetching patterns:', error);
            onLoginSuccess(user, apiKey, []);
          }
        } else {
          console.error('❌ [Login] No API key in user object:', user);
          Alert.alert(t('common.error'), t('login.noApiKeySupport'));
        }
      } else {
        Alert.alert(t('common.error'), response.message || t('auth.loginFailed'));
      }
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Check if user needs to set a password first
      const errorMessage = error.response?.data?.error || error.message || '';
      if (errorMessage.includes('Please set a password first') || errorMessage.includes('set a password')) {
        Alert.alert(
          t('login.passwordNotSetTitle'),
          t('login.passwordNotSetMessage'),
          [
            {
              text: t('common.done'),
              onPress: () => {
                if (onSwitchToRegister) {
                  onSwitchToRegister();
                }
              },
            },
          ]
        );
      } else {
        Alert.alert(t('common.error'), errorMessage || t('auth.loginFailed'));
      }
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
        await completeGoogleAuth(result.token, result.user, onLoginSuccess);
      } else {
        Alert.alert(t('common.error'), result.error || t('login.googleSignInFailed'));
      }
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      Alert.alert(t('common.error'), error.message || t('login.googleSignInFailed'));
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
          <Image 
            source={require('../../assets/logo/logo - Asset 10.png')} 
            style={styles.logo} 
            resizeMode="contain"
          />
          <Text style={[styles.title, { color: colors.text }]}>{t('login.title')}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('login.subtitle')}</Text>
          {onSwitchToEmployeeRegister && (
            <TouchableOpacity
              style={styles.switchButton}
              onPress={onSwitchToEmployeeRegister}
            >
              <Text style={[styles.switchText, { color: colors.textSecondary }]}>{t('login.devMode')}</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>{t('login.phoneNumber')}</Text>
            <PhoneInput
              value={phone}
              onChangeText={setPhone}
              placeholder={t('login.phonePlaceholder')}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>{t('login.password')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder={t('login.passwordPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={styles.forgotPasswordLink}
            onPress={() => setShowForgotPassword(true)}
          >
            <Text style={[styles.forgotPasswordText, { color: colors.primary }]}>
              {t('login.forgotPassword')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading || !phone || !password}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <Text style={[styles.buttonText, { color: colors.primaryText }]}>
                {t('login.login')}
              </Text>
            )}
          </TouchableOpacity>


          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.textSecondary }]}>{t('login.or')}</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          <View style={{
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 20,
            marginTop: 15,
            marginBottom: 10,
          }}>
            {/* Google Icon Button */}
            <TouchableOpacity
              style={{
                width: 54,
                height: 54,
                borderRadius: 27,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                justifyContent: 'center',
                alignItems: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 2,
              }}
              onPress={handleGoogleSignIn}
              disabled={googleLoading || loading || telegramLoading}
              activeOpacity={0.7}
            >
              {googleLoading ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Svg width="24" height="24" viewBox="0 0 24 24">
                  <Path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <Path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.28 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <Path
                    d="M5.84 14.09c-.22-.67-.35-1.39-.35-2.09s.13-1.42.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                    fill="#FBBC05"
                  />
                  <Path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </Svg>
              )}
            </TouchableOpacity>

            {/* Telegram Icon Button */}
            {botUsername && (
              <TouchableOpacity
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 27,
                  backgroundColor: '#0088cc',
                  justifyContent: 'center',
                  alignItems: 'center',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 2,
                }}
                onPress={handleTelegramLogin}
                disabled={telegramLoading || loading || googleLoading}
                activeOpacity={0.7}
              >
                {telegramLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Svg width="24" height="24" viewBox="0 0 24 24">
                    <Path
                      d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"
                      fill="#FFFFFF"
                    />
                  </Svg>
                )}
              </TouchableOpacity>
            )}
          </View>

          {onSwitchToRegister && (
            <TouchableOpacity
              style={styles.switchButton}
              onPress={onSwitchToRegister}
            >
              <Text style={[styles.switchText, { color: colors.primary }]}>
                {t('login.noAccountSignUp')}
              </Text>
            </TouchableOpacity>
          )}

          {onSwitchToEmployeeRegister && (
            <TouchableOpacity
              style={styles.switchButton}
              onPress={onSwitchToEmployeeRegister}
            >
              <Text style={[styles.switchText, { color: colors.textSecondary }]}>
                {t('login.employeeAccessCodeQr')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Forgot Password Modal */}
      <Modal
        visible={showForgotPassword}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowForgotPassword(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t('login.resetPassword')}</Text>
              <TouchableOpacity onPress={() => {
                setShowForgotPassword(false);
                setResetOtpSent(false);
                setResetOtpCode('');
                setNewPassword('');
                setConfirmNewPassword('');
              }}>
                <Text style={{ color: colors.textSecondary, fontSize: 24 }}>×</Text>
              </TouchableOpacity>
            </View>

            {!resetOtpSent ? (
              <>
                <Text style={[styles.modalDescription, { color: colors.textSecondary }]}>
                  {t('login.resetPasswordIntro')}
                </Text>
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.text }]}>{t('login.phoneNumber')}</Text>
                  <PhoneInput
                    value={phone}
                    onChangeText={setPhone}
                    placeholder={t('login.phonePlaceholder')}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: colors.primary }, resetLoading && styles.buttonDisabled]}
                  onPress={handleRequestPasswordReset}
                  disabled={resetLoading || !phone}
                >
                  {resetLoading ? (
                    <ActivityIndicator color={colors.primaryText} />
                  ) : (
                    <Text style={[styles.buttonText, { color: colors.primaryText }]}>{t('login.sendResetCode')}</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={[styles.modalDescription, { color: colors.textSecondary }]}>
                  {t('login.enterCodeAndPassword')}
                </Text>
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.text }]}>{t('login.resetCode')}</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                    placeholder={t('login.enterCode')}
                    placeholderTextColor={colors.textSecondary}
                    value={resetOtpCode}
                    onChangeText={setResetOtpCode}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.text }]}>{t('login.newPassword')}</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                    placeholder={t('login.newPasswordPlaceholder')}
                    placeholderTextColor={colors.textSecondary}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.text }]}>{t('login.confirmPassword')}</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                    placeholder={t('login.confirmPasswordPlaceholder')}
                    placeholderTextColor={colors.textSecondary}
                    value={confirmNewPassword}
                    onChangeText={setConfirmNewPassword}
                    secureTextEntry
                  />
                </View>
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: colors.primary }, resetLoading && styles.buttonDisabled]}
                  onPress={handleResetPassword}
                  disabled={resetLoading || !resetOtpCode || !newPassword || !confirmNewPassword}
                >
                  {resetLoading ? (
                    <ActivityIndicator color={colors.primaryText} />
                  ) : (
                    <Text style={[styles.buttonText, { color: colors.primaryText }]}>{t('login.resetPassword')}</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.linkButton}
                  onPress={() => setResetOtpSent(false)}
                >
                  <Text style={[styles.linkText, { color: colors.textSecondary }]}>{t('login.back')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
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
    justifyContent: 'flex-start',
    paddingTop: 32,
    paddingBottom: Platform.OS === 'android' ? 96 : 48,
  },
  header: {
    marginBottom: 40,
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
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
    marginBottom: 24,
    textAlign: 'center',
  },
  button: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: 12,
  },
  googleIcon: {
    marginRight: 12,
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
  modeToggle: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 8,
  },
  modeButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  otpInput: {
    textAlign: 'center',
    fontSize: 20,
    letterSpacing: 8,
  },
  infoBox: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 18,
  },
  linkButton: {
    marginTop: 12,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 14,
  },
  forgotPasswordLink: {
    alignSelf: 'flex-end',
    marginBottom: 16,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalDescription: {
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
});

