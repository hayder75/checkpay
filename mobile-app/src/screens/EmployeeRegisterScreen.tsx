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
  Animated,
  Dimensions,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { employeeAPI } from '../services/api';
import { storage } from '../services/storage';
import { QrCode, Key, CheckCircle2, RefreshCcw, ArrowRight } from 'lucide-react-native';
import QRCodeScanner from '../components/QRCodeScanner';

interface Props {
  onRegistrationSuccess: () => void;
  onCancel?: () => void;
}

const { width } = Dimensions.get('window');

export default function EmployeeRegisterScreen({ onRegistrationSuccess, onCancel }: Props) {
  const { colors, theme } = useTheme();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [useQR, setUseQR] = useState(false);
  const [qrData, setQrData] = useState('');
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Animation values
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Check if user is authenticated
  useEffect(() => {
    const checkAuth = async () => {
      const token = await storage.getToken();
      setIsAuthenticated(!!token);
    };
    checkAuth();
  }, []);

  const switchMethod = (isQR: boolean) => {
    if (useQR === isQR) return;
    
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: isQR ? 20 : -20,
        duration: 150,
        useNativeDriver: true,
      })
    ]).start(() => {
      setUseQR(isQR);
      slideAnim.setValue(isQR ? -20 : 20);
      
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        })
      ]).start();
    });
  };

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
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Employee Access</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Connect to your employer's business account
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Segmented Control */}
          <View style={[styles.segmentedControl, { backgroundColor: colors.background }]}>
            <TouchableOpacity
              style={[
                styles.segmentButton,
                !useQR && { backgroundColor: colors.surface, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 }
              ]}
              onPress={() => switchMethod(false)}
              disabled={loading}
            >
              <Key size={18} color={!useQR ? colors.primary : colors.textSecondary} />
              <Text style={[
                styles.segmentText, 
                { color: !useQR ? colors.primary : colors.textSecondary, fontWeight: !useQR ? '600' : '500' }
              ]}>
                Access Code
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.segmentButton,
                useQR && { backgroundColor: colors.surface, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 }
              ]}
              onPress={() => switchMethod(true)}
              disabled={loading}
            >
              <QrCode size={18} color={useQR ? colors.primary : colors.textSecondary} />
              <Text style={[
                styles.segmentText, 
                { color: useQR ? colors.primary : colors.textSecondary, fontWeight: useQR ? '600' : '500' }
              ]}>
                Scan QR
              </Text>
            </TouchableOpacity>
          </View>

          <Animated.View style={[
            styles.contentContainer, 
            { 
              opacity: fadeAnim,
              transform: [{ translateX: slideAnim }]
            }
          ]}>
            {!useQR ? (
              <View style={styles.inputSection}>
                <Text style={[styles.label, { color: colors.text }]}>Enter 6-Digit Code</Text>
                <TextInput
                  style={[
                    styles.input, 
                    { 
                      backgroundColor: colors.background, 
                      color: colors.text, 
                      borderColor: code.length === 6 ? colors.primary : colors.border 
                    }
                  ]}
                  placeholder="000000"
                  placeholderTextColor={colors.textSecondary}
                  value={code}
                  onChangeText={(text) => {
                    const digitsOnly = text.replace(/[^0-9]/g, '').slice(0, 6);
                    setCode(digitsOnly);
                  }}
                  keyboardType="number-pad"
                  maxLength={6}
                  editable={!loading}
                  textAlign="center"
                />
                <Text style={[styles.hint, { color: colors.textSecondary }]}>
                  Ask your employer for the access code
                </Text>
              </View>
            ) : (
              <View style={styles.inputSection}>
                <Text style={[styles.label, { color: colors.text }]}>Scan Invitation QR</Text>
                
                {qrData ? (
                  <View style={[styles.qrStatusCard, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
                    <View style={styles.qrStatusContent}>
                      <CheckCircle2 size={32} color={colors.primary} />
                      <Text style={[styles.qrStatusTitle, { color: colors.text }]}>QR Code Scanned</Text>
                      <Text style={[styles.qrStatusSub, { color: colors.textSecondary }]}>Ready to connect</Text>
                    </View>
                    <TouchableOpacity 
                      style={[styles.rescanButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      onPress={handleQRScan}
                      disabled={loading}
                    >
                      <RefreshCcw size={14} color={colors.textSecondary} />
                      <Text style={[styles.rescanText, { color: colors.textSecondary }]}>Scan Again</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.scanPlaceholder, { borderColor: colors.border, backgroundColor: colors.background }]}
                    onPress={handleQRScan}
                    disabled={loading}
                  >
                    <View style={[styles.scanIconCircle, { backgroundColor: colors.primary + '15' }]}>
                      <QrCode size={32} color={colors.primary} />
                    </View>
                    <Text style={[styles.scanPlaceholderText, { color: colors.primary }]}>Tap to Scan QR Code</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </Animated.View>

          <TouchableOpacity
            style={[
              styles.submitButton, 
              { 
                backgroundColor: colors.primary,
                opacity: (loading || (!useQR && code.length !== 6) || (useQR && !qrData)) ? 0.6 : 1
              }
            ]}
            onPress={handleRegister}
            disabled={
              loading || 
              (!useQR && code.length !== 6) || 
              (useQR && !qrData)
            }
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.submitButtonText}>Connect Account</Text>
                <ArrowRight size={20} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </View>

        {onCancel && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onCancel}
            disabled={loading}
          >
            <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
        )}
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
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    maxWidth: '80%',
    lineHeight: 24,
  },
  card: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 5,
  },
  segmentedControl: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 16,
    marginBottom: 32,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  segmentText: {
    fontSize: 14,
  },
  contentContainer: {
    minHeight: 180,
  },
  inputSection: {
    alignItems: 'center',
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
    opacity: 0.7,
  },
  input: {
    width: '100%',
    borderWidth: 2,
    borderRadius: 16,
    padding: 20,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 8,
    textAlign: 'center',
    marginBottom: 12,
  },
  hint: {
    fontSize: 13,
    textAlign: 'center',
  },
  scanPlaceholder: {
    width: '100%',
    height: 160,
    borderRadius: 20,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  scanIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanPlaceholderText: {
    fontSize: 16,
    fontWeight: '600',
  },
  qrStatusCard: {
    width: '100%',
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    gap: 16,
  },
  qrStatusContent: {
    alignItems: 'center',
    gap: 8,
  },
  qrStatusTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  qrStatusSub: {
    fontSize: 14,
  },
  rescanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  rescanText: {
    fontSize: 13,
    fontWeight: '600',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 16,
    marginTop: 32,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  cancelButton: {
    padding: 20,
    alignItems: 'center',
    marginTop: 12,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
});

