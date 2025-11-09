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
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  onRegisterSuccess: (phone: string) => void;
  onSwitchToLogin: () => void;
}

export default function RegisterScreen({ onRegisterSuccess, onSwitchToLogin }: Props) {
  const { colors } = useTheme();
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!username.trim() && !phone.trim()) {
      Alert.alert('Error', 'Please enter your username or phone number');
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.register({
        username: username.trim() || undefined,
        phone: phone.trim() || undefined,
        country: country.trim() || undefined,
      });

      if (response.success) {
        // Log OTP to console for testing
        if (response.data?.debug?.otp) {
          console.log(`\n🔐 ==========================================`);
          console.log(`📱 OTP Code: ${response.data.debug.otp}`);
          console.log(`⏰ Use this code to verify your account`);
          console.log(`🔐 ==========================================\n`);
        }

        if (response.data?.exists) {
          Alert.alert(
            'Account Exists',
            response.message || 'Account already exists. Please login instead.',
            [
              { text: 'Login', onPress: onSwitchToLogin },
              { text: 'OK' },
            ]
          );
        } else if (phone) {
          Alert.alert('Success', 'OTP sent to your phone. Check console (F12) for OTP code.');
          onRegisterSuccess(phone.trim());
        }
      } else {
        Alert.alert('Error', response.error || 'Registration failed');
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Registration failed';
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
            <Text style={[styles.label, { color: colors.text }]}>Country (Optional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="ET, KE, NG, etc."
              placeholderTextColor={colors.textSecondary}
              value={country}
              onChangeText={(text) => setCountry(text.toUpperCase().substring(0, 2))}
              autoCapitalize="characters"
              maxLength={2}
            />
          </View>

          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            At least one of username or phone is required. Country helps improve pattern accuracy.
          </Text>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }, (loading || (!username && !phone)) && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading || (!username && !phone)}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <Text style={[styles.buttonText, { color: colors.primaryText }]}>
                Create Account
              </Text>
            )}
          </TouchableOpacity>

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
});



