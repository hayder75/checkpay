import React, { useState } from 'react';
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
import PhoneInput from '../components/PhoneInput';
import { validatePhoneNumber } from '../utils/phoneCodes';
import { signInWithGoogle, completeGoogleAuth } from '../services/googleAuth';

interface Props {
  onLoginSuccess: (user: any, apiKey: string, patterns: Pattern[]) => void;
  onSwitchToRegister?: () => void;
}

export default function LoginScreen({ onLoginSuccess, onSwitchToRegister }: Props) {
  const { colors } = useTheme();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleLogin = async () => {
    if (!phone.trim()) {
      Alert.alert('Error', 'Please enter your phone number');
      return;
    }

    // Validate phone number format
    if (!validatePhoneNumber(phone.trim())) {
      Alert.alert('Error', 'Please enter a valid phone number with country code (e.g., +254712345678)');
      return;
    }

    if (!password.trim()) {
      Alert.alert('Error', 'Please enter your password');
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
          Alert.alert('Error', 'No token received from server');
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
            console.error('❌ [Login] API key was not saved correctly');
            Alert.alert('Error', 'Failed to save API key');
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
          Alert.alert('Error', 'No API key found for this account. Please contact support.');
        }
      } else {
        Alert.alert('Error', response.message || 'Login failed');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Check if user needs to set a password first
      const errorMessage = error.response?.data?.error || error.message || '';
      if (errorMessage.includes('Please set a password first') || errorMessage.includes('set a password')) {
        Alert.alert(
          'Password Not Set',
          'Your account exists but you haven\'t set a password yet. Please register again with a password or contact support.',
          [
            {
              text: 'OK',
              onPress: () => {
                if (onSwitchToRegister) {
                  onSwitchToRegister();
                }
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', errorMessage || 'Login failed');
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
            Sign in to your account
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Phone Number</Text>
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
              placeholder="Enter password"
              placeholderTextColor={colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading || !phone || !password}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <Text style={[styles.buttonText, { color: colors.primaryText }]}>
                Login
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
            disabled={googleLoading || loading}
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

          {onSwitchToRegister && (
            <TouchableOpacity
              style={styles.switchButton}
              onPress={onSwitchToRegister}
            >
              <Text style={[styles.switchText, { color: colors.primary }]}>
                Don't have an account? Sign up
              </Text>
            </TouchableOpacity>
          )}
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
});

