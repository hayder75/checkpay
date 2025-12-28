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
import { useTheme } from '../contexts/ThemeContext';
import { employeeAPI } from '../services/api';
import { storage } from '../services/storage';
import { QrCode, Key } from 'lucide-react-native';
import QRCodeScanner from '../components/QRCodeScanner';

interface Props {
  onRegistrationSuccess: () => void;
  onCancel?: () => void;
}

export default function EmployeeRegisterScreen({ onRegistrationSuccess, onCancel }: Props) {
  const { colors } = useTheme();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [useQR, setUseQR] = useState(false);
  const [qrData, setQrData] = useState('');
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  // Check if user is authenticated
  useEffect(() => {
    const checkAuth = async () => {
      const token = await storage.getToken();
      setIsAuthenticated(!!token);
    };
    checkAuth();
  }, []);

  const handleRegister = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    if (!useQR && !code.trim()) {
      Alert.alert('Error', 'Please enter the 6-digit access code');
      return;
    }

    if (useQR && !qrData.trim()) {
      Alert.alert('Error', 'Please scan the QR code');
      return;
    }

    // Validate code format if using code
    if (!useQR && !/^\d{6}$/.test(code.trim())) {
      Alert.alert('Error', 'Access code must be 6 digits');
      return;
    }

    // If not authenticated, require account creation fields
    if (!isAuthenticated) {
      if (!username.trim() && !phone.trim()) {
        Alert.alert('Error', 'Please enter username or phone number to create an account');
        return;
      }
      if (!password.trim() || password.length < 6) {
        Alert.alert('Error', 'Please enter a password (minimum 6 characters)');
        return;
      }
    }

    setLoading(true);
    try {
      const registerData: any = {
        code: useQR ? undefined : code.trim(),
        qrData: useQR ? qrData.trim() : undefined,
        name: name.trim(),
      };

      // Add account creation fields if not authenticated
      if (!isAuthenticated) {
        if (username.trim()) registerData.username = username.trim();
        if (phone.trim()) registerData.phone = phone.trim();
        registerData.password = password;
      }

      const response = await employeeAPI.register(registerData);

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
              console.log('✅ [EmployeeRegister] User info saved:', {
                id: userResponse.data.id,
                role: userResponse.data.role,
                hasApiKey: !!userResponse.data.apiKey,
              });
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
      const errorMessage = error.response?.data?.error || error.message || 'Failed to register as employee';
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
    setUseQR(true);
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
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Employee Registration</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Enter the access code or scan QR code provided by your employer
          </Text>
        </View>

        <View style={styles.form}>
          {!isAuthenticated && (
            <>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Create Account</Text>
                <Text style={[styles.hint, { color: colors.textSecondary }]}>
                  You need to create an account first
                </Text>
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Username (optional)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  placeholder="Enter username"
                  placeholderTextColor={colors.textSecondary}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  editable={!loading}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Phone Number (optional)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  placeholder="Enter phone number"
                  placeholderTextColor={colors.textSecondary}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  editable={!loading}
                />
                <Text style={[styles.hint, { color: colors.textSecondary }]}>
                  Provide either username or phone number
                </Text>
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Password *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  placeholder="Enter password (min 6 characters)"
                  placeholderTextColor={colors.textSecondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  editable={!loading}
                />
              </View>
            </>
          )}

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Your Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="Enter your full name"
              placeholderTextColor={colors.textSecondary}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              editable={!loading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Access Method</Text>
            <View style={styles.methodButtons}>
              <TouchableOpacity
                style={[
                  styles.methodButton,
                  { backgroundColor: !useQR ? colors.primary : colors.surface, borderColor: colors.border },
                ]}
                onPress={() => {
                  setUseQR(false);
                  setQrData('');
                }}
                disabled={loading}
              >
                <Key size={20} color={!useQR ? '#fff' : colors.text} />
                <Text style={[styles.methodButtonText, { color: !useQR ? '#fff' : colors.text }]}>
                  Access Code
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.methodButton,
                  { backgroundColor: useQR ? colors.primary : colors.surface, borderColor: colors.border },
                ]}
                onPress={() => {
                  setUseQR(true);
                  setCode('');
                  handleQRScan();
                }}
                disabled={loading}
              >
                <QrCode size={20} color={useQR ? '#fff' : colors.text} />
                <Text style={[styles.methodButtonText, { color: useQR ? '#fff' : colors.text }]}>
                  QR Code
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {!useQR ? (
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Access Code</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                placeholder="Enter 6-digit code"
                placeholderTextColor={colors.textSecondary}
                value={code}
                onChangeText={(text) => {
                  // Only allow digits and limit to 6
                  const digitsOnly = text.replace(/[^0-9]/g, '').slice(0, 6);
                  setCode(digitsOnly);
                }}
                keyboardType="number-pad"
                maxLength={6}
                editable={!loading}
              />
              <Text style={[styles.hint, { color: colors.textSecondary }]}>
                Enter the 6-digit code provided by your employer
              </Text>
            </View>
          ) : (
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>QR Code Data</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                placeholder="QR code data will appear here after scanning"
                placeholderTextColor={colors.textSecondary}
                value={qrData}
                onChangeText={setQrData}
                editable={!loading}
                multiline
              />
              <TouchableOpacity
                style={[styles.scanButton, { backgroundColor: colors.primary }]}
                onPress={handleQRScan}
                disabled={loading}
              >
                <QrCode size={20} color="#fff" />
                <Text style={styles.scanButtonText}>Scan QR Code</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: colors.primary }]}
            onPress={handleRegister}
            disabled={
              loading || 
              !name.trim() || 
              (!useQR && !code.trim()) || 
              (useQR && !qrData.trim()) ||
              (!isAuthenticated && (!username.trim() && !phone.trim())) ||
              (!isAuthenticated && (!password.trim() || password.length < 6))
            }
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Register as Employee</Text>
            )}
          </TouchableOpacity>

          {onCancel && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              disabled={loading}
            >
              <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Cancel</Text>
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
    paddingTop: 60,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  form: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  hint: {
    fontSize: 12,
    marginTop: 4,
  },
  methodButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  methodButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  methodButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  cancelButton: {
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  cancelButtonText: {
    fontSize: 16,
  },
});

