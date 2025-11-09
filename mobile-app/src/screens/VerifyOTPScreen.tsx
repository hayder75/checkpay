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
import { authAPI } from '../services/api';
import { storage } from '../services/storage';
import { fetchPatterns } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { Pattern } from '../types';

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
      const response = await authAPI.verifyOTP({
        phone: phone.trim(),
        code: code.trim(),
        password: password.trim() || undefined,
      });

      if (response.success) {
        const { token, user } = response.data;
        
        // Store token and user
        await storage.setToken(token);
        await storage.setUser(user);
        
        // Get API key from user
        const apiKey = user.apiKey;
        if (apiKey) {
          await storage.setApiKey(apiKey);
          
          // Fetch patterns
          try {
            const patternsResponse = await fetchPatterns(apiKey);
            if (patternsResponse.success && patternsResponse.data.patterns) {
              await storage.setPatterns(patternsResponse.data.patterns);
              onVerificationSuccess(user, apiKey, patternsResponse.data.patterns);
            } else {
              onVerificationSuccess(user, apiKey, []);
            }
          } catch (error) {
            console.error('Error fetching patterns:', error);
            onVerificationSuccess(user, apiKey, []);
          }
        } else {
          Alert.alert('Error', 'No API key found for this account');
        }
      } else {
        Alert.alert('Error', response.error || 'OTP verification failed');
      }
    } catch (error: any) {
      console.error('Verify OTP error:', error);
      const errorMessage = error.response?.data?.error || error.message || 'OTP verification failed';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const response = await authAPI.resendOTP({ phone: phone.trim() });
      if (response.success) {
        // Log OTP to console for testing
        if (response.data?.debug?.otp) {
          console.log(`\n🔐 ==========================================`);
          console.log(`📱 OTP Code: ${response.data.debug.otp}`);
          console.log(`⏰ Use this code to verify your account`);
          console.log(`🔐 ==========================================\n`);
        }
        Alert.alert('Success', 'OTP resent! Check console (F12) for OTP code.');
        setCountdown(60);
      } else {
        Alert.alert('Error', response.error || 'Failed to resend OTP');
      }
    } catch (error: any) {
      console.error('Resend OTP error:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to resend OTP');
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



