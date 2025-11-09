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
import { authAPI } from '../services/api';
import { storage } from '../services/storage';
import { fetchPatterns } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { Pattern } from '../types';

interface Props {
  onLoginSuccess: (user: any, apiKey: string, patterns: Pattern[]) => void;
  onSwitchToRegister?: () => void;
}

export default function LoginScreen({ onLoginSuccess, onSwitchToRegister }: Props) {
  const { colors } = useTheme();
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() && !phone.trim()) {
      Alert.alert('Error', 'Please enter your username or phone number');
      return;
    }

    if (!password.trim()) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.login({
        username: username.trim() || undefined,
        phone: phone.trim() || undefined,
        password: password.trim(),
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
              onLoginSuccess(user, apiKey, patternsResponse.data.patterns);
            } else {
              onLoginSuccess(user, apiKey, []);
            }
          } catch (error) {
            console.error('Error fetching patterns:', error);
            onLoginSuccess(user, apiKey, []);
          }
        } else {
          Alert.alert('Error', 'No API key found for this account');
        }
      } else {
        Alert.alert('Error', response.error || 'Login failed');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Login failed';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
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
            <Text style={[styles.label, { color: colors.text }]}>Username</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="Enter username"
              placeholderTextColor={colors.textSecondary}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Phone Number</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="+254712345678"
              placeholderTextColor={colors.textSecondary}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoCapitalize="none"
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

          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Enter either username or phone number, and your password
          </Text>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading || (!username && !phone) || !password}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <Text style={[styles.buttonText, { color: colors.primaryText }]}>
                Login
              </Text>
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
});

