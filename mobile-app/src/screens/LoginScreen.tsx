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
  Image,
} from 'react-native';
import { storage } from '../services/storage';
import { useTheme } from '../contexts/ThemeContext';
import { Pattern } from '../types';
import { authAPI } from '../services/api';
import { patternsAPI } from '../services/api';
import PhoneInput from '../components/PhoneInput';
import { validatePhoneNumber } from '../utils/phoneCodes';
import { signInWithGoogle, completeGoogleAuth } from '../services/googleAuth';
import Svg, { Path } from 'react-native-svg';

interface Props {
  onLoginSuccess: (user: any, apiKey: string, patterns: Pattern[]) => void;
  onSwitchToRegister?: () => void;
  onSwitchToEmployeeRegister?: () => void;
}

export default function LoginScreen({ onLoginSuccess, onSwitchToRegister, onSwitchToEmployeeRegister }: Props) {
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
          <Image 
            source={require('../../assets/logo/logo - Asset 2.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
          {/* <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Sign in to your account
          </Text> */}
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
                  <Svg width="20" height="20" viewBox="0 0 24 24">
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

          {onSwitchToEmployeeRegister && (
            <TouchableOpacity
              style={styles.switchButton}
              onPress={onSwitchToEmployeeRegister}
            >
              <Text style={[styles.switchText, { color: colors.textSecondary }]}>
                Register as Employee
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
  logo: {
    width: 200,
    height: 60,
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
    marginRight: 12,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

