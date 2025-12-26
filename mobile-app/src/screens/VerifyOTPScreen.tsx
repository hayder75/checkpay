import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { storage } from '../services/storage';
import { useTheme } from '../contexts/ThemeContext';
import { Pattern } from '../types';
import { authAPI } from '../services/api';
import { patternsAPI } from '../services/api';

interface Props {
  phone: string;
  onVerificationSuccess: (user: any, apiKey: string, patterns: Pattern[]) => void;
  onResendOTP: () => void;
}

export default function VerifyOTPScreen({ phone, onVerificationSuccess, onResendOTP }: Props) {
  const { colors } = useTheme();
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleVerify = async () => {
    if (!code.trim()) {
      Alert.alert('Error', 'Please enter the OTP code');
      return;
    }

    if (password.trim() && password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      // Use real API authentication
      const response = await authAPI.verifyOTP({
        phone: phone.trim(),
        code: code.trim(),
        password: password.trim() || undefined,
      });

      if (response.success) {
        const { token, user } = response.data;
        
        if (!token) {
          Alert.alert('Error', 'No token received from server');
          return;
        }
        
        // Store token and user
        console.log('💾 [VerifyOTP] Saving authentication data...');
        await storage.setToken(token);
        await storage.setUser(user);
        
        // Verify token was saved
        const savedToken = await storage.getToken();
        if (!savedToken || savedToken !== token) {
          console.error('❌ [VerifyOTP] Token was not saved correctly');
          Alert.alert('Error', 'Failed to save authentication token');
          return;
        }
        
        // Get API key from user
        const apiKey = user.apiKey;
        if (apiKey) {
          await storage.setApiKey(apiKey);
          
          // Verify API key was saved
          const savedApiKey = await storage.getApiKey();
          if (!savedApiKey || savedApiKey !== apiKey) {
            console.error('❌ [VerifyOTP] API key was not saved correctly');
            Alert.alert('Error', 'Failed to save API key');
            return;
          }
          
          console.log('✅ [VerifyOTP] Authentication data saved successfully (token + API key)');
          
          // Fetch patterns from real API
          try {
            const patternsResponse = await patternsAPI.getAll();
            if (patternsResponse.success && patternsResponse.data) {
              const patterns = Array.isArray(patternsResponse.data) 
                ? patternsResponse.data 
                : [];
              // Patterns are now always fetched from backend, no local storage
              onVerificationSuccess(user, apiKey, patterns);
            } else {
              onVerificationSuccess(user, apiKey, []);
            }
          } catch (error) {
            console.error('Error fetching patterns:', error);
            onVerificationSuccess(user, apiKey, []);
          }
        } else {
          console.error('❌ [VerifyOTP] No API key in user object:', user);
          Alert.alert('Error', 'No API key found for this account. Please contact support.');
        }
      } else {
        Alert.alert('Error', response.message || 'OTP verification failed');
      }
    } catch (error: any) {
      console.error('Verify OTP error:', error);
      Alert.alert('Error', error.message || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      // Use real API authentication
      const response = await authAPI.resendOTP({ phone: phone.trim() });
      if (response.success) {
        // Show OTP code if in debug mode
        const otpCode = response.data?.debug?.otp;
        if (otpCode) {
          Alert.alert('Success', `OTP resent! Check console for OTP code: ${otpCode}`);
        } else {
          Alert.alert('Success', 'OTP resent! Please check your phone or email.');
        }
        setCountdown(60);
      } else {
        Alert.alert('Error', response.message || 'Failed to resend OTP');
      }
    } catch (error: any) {
      console.error('Resend OTP error:', error);
      Alert.alert('Error', error.message || 'Failed to resend OTP');
    } finally {
      setResending(false);
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
          <Text style={[styles.title, { color: colors.text }]}>Verify OTP</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Enter the code sent to {phone}
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>OTP Code</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="123456"
              placeholderTextColor={colors.textSecondary}
              value={code}
              onChangeText={(text) => setCode(text.replace(/[^0-9]/g, '').substring(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
            />
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              Check console (F12) for OTP code
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Password (Optional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="Set a password for future logins"
              placeholderTextColor={colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          {password.trim() && (
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
          )}

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }, (loading || !code) && styles.buttonDisabled]}
            onPress={handleVerify}
            disabled={loading || !code}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <Text style={[styles.buttonText, { color: colors.primaryText }]}>
                Verify OTP
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.resendButton, countdown > 0 && styles.buttonDisabled]}
            onPress={handleResend}
            disabled={resending || countdown > 0}
          >
            {resending ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={[styles.resendText, { color: colors.primary }]}>
                {countdown > 0 ? `Resend OTP (${countdown}s)` : 'Resend OTP'}
              </Text>
            )}
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
  resendButton: {
    marginTop: 16,
    alignItems: 'center',
    padding: 12,
  },
  resendText: {
    fontSize: 14,
    fontWeight: '500',
  },
});



