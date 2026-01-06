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
import { QrCode, Key, CheckCircle2, RefreshCcw } from 'lucide-react-native';
import QRCodeScanner from '../components/QRCodeScanner';
import PhoneInput from '../components/PhoneInput';

interface Props {
  onRegistrationSuccess: () => void;
  onCancel?: () => void;
}

export default function EmployeeRegisterScreen({ onRegistrationSuccess, onCancel }: Props) {
  const { colors } = useTheme();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [useQR, setUseQR] = useState(false);
  const [qrData, setQrData] = useState('');
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check if user is authenticated
  useEffect(() => {
    const checkAuth = async () => {
      const token = await storage.getToken();
      setIsAuthenticated(!!token);
    };
    checkAuth();
  }, []);

  const handleRegister = async () => {
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

    setLoading(true);
    try {
      const registerData: any = {
        code: useQR ? undefined : code.trim(),
        qrData: useQR ? qrData.trim() : undefined,
      };

      // If not authenticated, we might need to handle account creation differently.
      // For now, we assume this flow is primarily for existing users or a simplified flow.
      // If the backend requires username/password for new users, this might fail for unauthenticated users
      // unless the backend handles "implicit" account creation or we change the flow.
      // Given the requirement "only scan qr code or type the code and name only", we will proceed with this.

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
          <Text style={[styles.title, { color: colors.text }]}>Employee Access</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Enter the access code or scan QR code provided by your employer
          </Text>
        </View>

        <View style={styles.form}>

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
              <Text style={[styles.label, { color: colors.text }]}>QR Code Status</Text>
              {qrData ? (
                <View style={[styles.qrStatusCard, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
                  <View style={styles.qrStatusLeft}>
                    <CheckCircle2 size={24} color={colors.primary} />
                    <View style={styles.qrStatusTextContainer}>
                      <Text style={[styles.qrStatusTitle, { color: colors.text }]}>QR Code Scanned</Text>
                      <Text style={[styles.qrStatusSub, { color: colors.textSecondary }]}>Ready for registration</Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    style={[styles.rescanButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={handleQRScan}
                    disabled={loading}
                  >
                    <RefreshCcw size={16} color={colors.textSecondary} />
                    <Text style={[styles.rescanText, { color: colors.textSecondary }]}>Rescan</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.scanButton, { backgroundColor: colors.primary }]}
                  onPress={handleQRScan}
                  disabled={loading}
                >
                  <QrCode size={20} color="#fff" />
                  <Text style={styles.scanButtonText}>Scan QR Code</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: colors.primary }]}
            onPress={handleRegister}
            disabled={
              loading || 
              (!useQR && !code.trim()) || 
              (useQR && !qrData.trim())
            }
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Access Account</Text>
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
  qrStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 8,
  },
  qrStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  qrStatusTextContainer: {
    flex: 1,
  },
  qrStatusTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  qrStatusSub: {
    fontSize: 12,
    marginTop: 1,
  },
  rescanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  rescanText: {
    fontSize: 12,
    fontWeight: '600',
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
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
    marginTop: 16,
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

