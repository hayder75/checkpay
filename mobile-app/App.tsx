import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import Drawer from './src/components/Drawer';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import VerifyOTPScreen from './src/screens/VerifyOTPScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import PatternsScreen from './src/screens/PatternsScreen';
import TransactionsScreen from './src/screens/TransactionsScreen';
import AnalyticsScreen from './src/screens/AnalyticsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import MainScreen from './src/screens/MainScreen';
import PatternBuilderScreen from './src/screens/PatternBuilderScreen';
import PremiumScreen from './src/screens/PremiumScreen';
import { storage } from './src/services/storage';
import { authAPI, fetchPatterns } from './src/services/api';
import { Pattern } from './src/types';
import 'react-native-url-polyfill/auto';

type Screen = 'dashboard' | 'patterns' | 'create-pattern' | 'transactions' | 'analytics' | 'settings' | 'test-sms' | 'premium';

function AppContent() {
  const { colors } = useTheme();
  const [user, setUser] = useState<any>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [authScreen, setAuthScreen] = useState<'login' | 'register' | 'verify-otp'>('login');
  const [registerPhone, setRegisterPhone] = useState<string>('');

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // Check for stored token
      const token = await storage.getToken();
      const storedUser = await storage.getUser();
      const storedApiKey = await storage.getApiKey();

      if (token && storedUser && storedApiKey) {
        // Verify token is still valid
        try {
          const response = await authAPI.getMe();
          if (response.success) {
            // Token valid, load user and patterns
            setUser(response.data);
            setApiKey(storedApiKey);
            
            // Load patterns
            try {
              const patternsResponse = await fetchPatterns(storedApiKey);
              if (patternsResponse.success && patternsResponse.data.patterns) {
                const loadedPatterns = patternsResponse.data.patterns;
                await storage.setPatterns(loadedPatterns);
                setPatterns(loadedPatterns);
              } else {
                const storedPatterns = await storage.getPatterns();
                setPatterns(storedPatterns);
              }
            } catch (error) {
              console.error('Error loading patterns:', error);
              const storedPatterns = await storage.getPatterns();
              setPatterns(storedPatterns);
            }
          } else {
            // Token invalid, clear storage
            await storage.clearAll();
          }
        } catch (error) {
          // Token invalid or expired
          console.error('Token validation failed:', error);
          await storage.clearAll();
        }
      } else if (storedApiKey) {
        // Fallback: Use API key only (old method)
        setApiKey(storedApiKey);
        const storedPatterns = await storage.getPatterns();
        setPatterns(storedPatterns);
      }
    } catch (error) {
      console.error('Auth check error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = async (userData: any, userApiKey: string, userPatterns: Pattern[]) => {
    setUser(userData);
    setApiKey(userApiKey);
    setPatterns(userPatterns);
  };

  const handleLogout = async () => {
    await storage.clearAll();
    setUser(null);
    setApiKey(null);
    setPatterns([]);
    setCurrentScreen('dashboard');
  };

  const handleNavigate = (screen: Screen) => {
    setCurrentScreen(screen);
  };

  const handleRefresh = async () => {
    if (apiKey) {
      try {
        const patternsResponse = await fetchPatterns(apiKey);
        if (patternsResponse.success && patternsResponse.data.patterns) {
          const loadedPatterns = patternsResponse.data.patterns;
          await storage.setPatterns(loadedPatterns);
          setPatterns(loadedPatterns);
        }
      } catch (error) {
        console.error('Error refreshing patterns:', error);
      }
    }
  };

  const renderScreen = () => {
    if (!apiKey) return null;

    switch (currentScreen) {
      case 'dashboard':
        return (
          <DashboardScreen
            apiKey={apiKey}
            patterns={patterns}
            onNavigate={handleNavigate}
          />
        );
      case 'patterns':
        return (
          <PatternsScreen
            apiKey={apiKey}
            patterns={patterns}
            onRefresh={handleRefresh}
            onNavigate={handleNavigate}
          />
        );
      case 'create-pattern':
        return (
          <PatternBuilderScreen
            apiKey={apiKey}
            onPatternCreated={() => {
              handleRefresh();
              setCurrentScreen('patterns');
            }}
          />
        );
      case 'transactions':
        return <TransactionsScreen apiKey={apiKey} />;
      case 'analytics':
        return <AnalyticsScreen apiKey={apiKey} />;
      case 'settings':
        return <SettingsScreen apiKey={apiKey} onLogout={handleLogout} />;
      case 'test-sms':
        return (
          <MainScreen
            apiKey={apiKey}
            patterns={patterns}
            onLogout={handleLogout}
          />
        );
      case 'premium':
        return <PremiumScreen apiKey={apiKey} />;
      default:
        return (
          <DashboardScreen
            apiKey={apiKey}
            patterns={patterns}
            onNavigate={handleNavigate}
          />
        );
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading...</Text>
      </View>
    );
  }

  const handleRegisterSuccess = (phone: string) => {
    setRegisterPhone(phone);
    setAuthScreen('verify-otp');
  };

  const handleVerificationSuccess = (userData: any, userApiKey: string, userPatterns: Pattern[]) => {
    setUser(userData);
    setApiKey(userApiKey);
    setPatterns(userPatterns);
    setAuthScreen('login');
  };

  const renderAuthScreen = () => {
    switch (authScreen) {
      case 'register':
        return (
          <RegisterScreen
            onRegisterSuccess={handleRegisterSuccess}
            onSwitchToLogin={() => setAuthScreen('login')}
          />
        );
      case 'verify-otp':
        return (
          <VerifyOTPScreen
            phone={registerPhone}
            onVerificationSuccess={handleVerificationSuccess}
            onResendOTP={() => {
              setAuthScreen('register');
              // Phone will be preserved in registerPhone state
            }}
          />
        );
      case 'login':
      default:
        return (
          <LoginScreen
            onLoginSuccess={handleLoginSuccess}
            onSwitchToRegister={() => setAuthScreen('register')}
          />
        );
    }
  };

  return (
    <>
      <StatusBar style={colors.background === '#1a1a1a' ? 'light' : 'dark'} />
      {!user && !apiKey ? (
        renderAuthScreen()
      ) : (
        <>
          {/* Header with Hamburger Menu */}
          <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => setDrawerVisible(true)}
            >
              <Text style={[styles.menuIcon, { color: colors.text }]}>☰</Text>
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>CheckPay</Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* Drawer */}
          <Drawer
            visible={drawerVisible}
            onClose={() => setDrawerVisible(false)}
            onNavigate={handleNavigate}
            currentScreen={currentScreen}
            onLogout={handleLogout}
          />

          {/* Main Content */}
          {renderScreen()}
        </>
      )}
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
    borderBottomWidth: 1,
  },
  menuButton: {
    padding: 8,
  },
  menuIcon: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  headerSpacer: {
    flex: 1,
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  placeholderText: {
    fontSize: 18,
    textAlign: 'center',
  },
});
