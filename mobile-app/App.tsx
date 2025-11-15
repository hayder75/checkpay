import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import BottomNavigation, { Tab } from './src/components/BottomNavigation';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import VerifyOTPScreen from './src/screens/VerifyOTPScreen';
import HomeScreen from './src/screens/HomeScreen';
import BanksScreen from './src/screens/BanksScreen';
import TransactionsScreen from './src/screens/TransactionsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import SampleSMSScreen from './src/screens/SampleSMSScreen';
import { storage } from './src/services/storage';
import { authAPI, fetchPatterns } from './src/services/api';
import { smsService } from './src/services/smsService';
import { Pattern } from './src/types';
import 'react-native-url-polyfill/auto';

function AppContent() {
  const { colors } = useTheme();
  const [user, setUser] = useState<any>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSampleSMS, setShowSampleSMS] = useState(false);
  const [sampleSMSInstitution, setSampleSMSInstitution] = useState<string>('');
  const [sampleSMSCountry, setSampleSMSCountry] = useState<string>('');
  const [currentTab, setCurrentTab] = useState<Tab>('home');
  const [authScreen, setAuthScreen] = useState<'login' | 'register' | 'verify-otp' | null>(null);
  const [registerPhone, setRegisterPhone] = useState<string>('');

  useEffect(() => {
    initializeApp();
    
    // Start SMS monitoring after app initializes
    const startMonitoring = async () => {
      try {
        const onboardingCompleted = await storage.getOnboardingCompleted();
        if (onboardingCompleted) {
          await smsService.startMonitoring();
        }
      } catch (error) {
        console.error('Error starting SMS monitoring:', error);
      }
    };
    
    // Start monitoring after a short delay to ensure app is ready
    const timer = setTimeout(startMonitoring, 2000);
    
    // Cleanup on unmount
    return () => {
      clearTimeout(timer);
      smsService.stopMonitoring();
    };
  }, []);

  const initializeApp = async () => {
    try {
      // First, check for stored credentials
      const token = await storage.getToken();
      const apiKey = await storage.getApiKey();
      
      if (token || apiKey) {
        // User has credentials - authenticate automatically
        console.log('Found stored credentials, authenticating automatically');
        await checkAuth();
        
        // After checkAuth, verify if authentication was successful
        // If not, show sign-in screen
        const finalToken = await storage.getToken();
        const finalApiKey = await storage.getApiKey();
        if (!finalToken && !finalApiKey) {
          // Authentication failed (token invalid/expired) - show sign-in screen
          console.log('Authentication failed, showing sign-in screen');
          setAuthScreen('login');
        }
      } else {
        // No stored credentials - show login screen first
        // User can sign in with existing account or register new account
        // Onboarding will be shown only if needed after authentication
        console.log('No stored credentials found, showing login screen');
        setAuthScreen('login');
        setLoading(false);
      }
    } catch (error) {
      console.error('Error initializing app:', error);
      // On error, show login screen
      setAuthScreen('login');
      setLoading(false);
    }
  };

  const checkOnboarding = async () => {
    try {
      const completed = await storage.getOnboardingCompleted();
      return completed;
    } catch (error) {
      console.error('Error checking onboarding:', error);
      return false;
    }
  };

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
                console.log(`✅ Loaded ${loadedPatterns.length} user patterns from backend`);
              } else {
                const storedPatterns = await storage.getPatterns();
                setPatterns(storedPatterns);
                console.log(`✅ Loaded ${storedPatterns.length} patterns from local storage`);
              }
              
              // Also download institution patterns for the country
              const countryCode = await storage.getCountryCode();
              if (countryCode) {
                const { downloadCountryPatterns } = await import('./src/utils/patternVerifier');
                const institutionPatterns = await downloadCountryPatterns(countryCode);
                console.log(`✅ Downloaded ${institutionPatterns.length} institution patterns for country ${countryCode}`);
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
    setAuthScreen(null); // Clear auth screen after successful login
    
    // Ensure patterns are saved locally
    if (userPatterns && userPatterns.length > 0) {
      await storage.setPatterns(userPatterns);
      console.log(`✅ Saved ${userPatterns.length} user patterns to local storage`);
    }
    
    // Check if onboarding is needed
    const onboardingCompleted = await storage.getOnboardingCompleted();
    const countryCode = await storage.getCountryCode();
    const hasPatterns = (userPatterns && userPatterns.length > 0) || (await storage.getPatterns()).length > 0;
    
    if (!onboardingCompleted || !countryCode || !hasPatterns) {
      // User needs onboarding - show onboarding screen
      console.log('User needs onboarding, showing onboarding screen');
      setShowOnboarding(true);
      return;
    }
    
    // Download and save institution patterns for the user's country
    try {
      if (countryCode) {
        const { downloadCountryPatterns } = await import('./src/utils/patternVerifier');
        const institutionPatterns = await downloadCountryPatterns(countryCode);
        console.log(`✅ Downloaded and saved ${institutionPatterns.length} institution patterns for country ${countryCode}`);
      }
    } catch (error) {
      console.error('Error downloading institution patterns:', error);
    }
    
    // Start SMS monitoring after successful authentication
    try {
      if (onboardingCompleted) {
        console.log('🔄 Starting SMS monitoring after login...');
        await smsService.startMonitoring();
        console.log('✅ SMS monitoring started');
      }
    } catch (error) {
      console.error('Error starting SMS monitoring after login:', error);
    }
    
    // Sync any unsynced transactions after login
    try {
      await smsService.syncAllUnsyncedTransactions();
    } catch (error) {
      console.error('Error syncing transactions after login:', error);
    }
  };

  const handleLogout = async () => {
    await storage.clearAll();
    setUser(null);
    setApiKey(null);
    setPatterns([]);
    setCurrentTab('home');
  };

  const renderScreen = () => {
    switch (currentTab) {
      case 'home':
        return <HomeScreen apiKey={apiKey} />;
      case 'banks':
        return <BanksScreen apiKey={apiKey} />;
      case 'transactions':
        return <TransactionsScreen apiKey={apiKey} />;
      case 'profile':
        return <ProfileScreen apiKey={apiKey} onLogout={handleLogout} />;
      default:
        return <HomeScreen apiKey={apiKey} />;
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

  const handleVerificationSuccess = async (userData: any, userApiKey: string, userPatterns: Pattern[]) => {
    setUser(userData);
    setApiKey(userApiKey);
    setPatterns(userPatterns);
    setAuthScreen(null); // Clear auth screen after successful verification
    
    // Ensure patterns are saved locally
    if (userPatterns && userPatterns.length > 0) {
      await storage.setPatterns(userPatterns);
      console.log(`✅ Saved ${userPatterns.length} user patterns to local storage`);
    }
    
    // Check if onboarding is needed
    const onboardingCompleted = await storage.getOnboardingCompleted();
    const countryCode = await storage.getCountryCode();
    const hasPatterns = (userPatterns && userPatterns.length > 0) || (await storage.getPatterns()).length > 0;
    
    if (!onboardingCompleted || !countryCode || !hasPatterns) {
      // User needs onboarding - show onboarding screen
      console.log('User needs onboarding, showing onboarding screen');
      setShowOnboarding(true);
      return;
    }
    
    // Download and save institution patterns for the user's country
    try {
      if (countryCode) {
        const { downloadCountryPatterns } = await import('./src/utils/patternVerifier');
        const institutionPatterns = await downloadCountryPatterns(countryCode);
        console.log(`✅ Downloaded and saved ${institutionPatterns.length} institution patterns for country ${countryCode}`);
      }
    } catch (error) {
      console.error('Error downloading institution patterns:', error);
    }
    
    // Start SMS monitoring after successful authentication
    try {
      if (onboardingCompleted) {
        console.log('🔄 Starting SMS monitoring after authentication...');
        await smsService.startMonitoring();
        console.log('✅ SMS monitoring started');
      }
    } catch (error) {
      console.error('Error starting SMS monitoring after auth:', error);
    }
    
    // Sync any unsynced transactions after login
    try {
      await smsService.syncAllUnsyncedTransactions();
    } catch (error) {
      console.error('Error syncing transactions after login:', error);
    }
  };

  const handleOnboardingComplete = async (countryCode: string, selectedBanks: string[]) => {
    try {
      await storage.setOnboardingCompleted(true);
      await storage.setUserCountry(countryCode);
      await storage.setSelectedBanks(selectedBanks);
      setShowOnboarding(false);
      
      // After onboarding, check if user is authenticated
      // If not, show sign-in screen
      const token = await storage.getToken();
      const apiKey = await storage.getApiKey();
      if (!token && !apiKey) {
        // First time install - require sign-in
        console.log('First time install - showing sign-in screen');
        setAuthScreen('register');
      } else {
        // User already authenticated, proceed normally
        await checkAuth();
      }
    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
  };

  const handleNavigateToRegistration = () => {
    setShowOnboarding(false);
    setAuthScreen('register');
  };

  const handleNavigateToSampleSMS = (institution: string, countryCode: string) => {
    setShowOnboarding(false);
    setSampleSMSInstitution(institution);
    setSampleSMSCountry(countryCode);
    setShowSampleSMS(true);
  };

  const handleSampleSMSPatternCreated = async () => {
    setShowSampleSMS(false);
    
    // Ensure patterns are saved and verified
    try {
      const savedPatterns = await storage.getInstitutionPatterns();
      console.log(`✅ [SampleSMS] Verified ${savedPatterns.length} patterns are saved before proceeding`);
      
      if (savedPatterns.length === 0) {
        console.warn('⚠️ [SampleSMS] No patterns saved! SMS monitoring may not work.');
      }
    } catch (error) {
      console.error('Error verifying patterns:', error);
    }
    
    // Navigate to registration - SMS monitoring will start after sign-in
    setAuthScreen('register');
  };

  const handleSampleSMSCancel = () => {
    setShowSampleSMS(false);
    setShowOnboarding(true);
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

  // Don't show auth screen by default - only when user explicitly requests it

  return (
    <>
      <StatusBar style={colors.background === '#1a1a1a' ? 'light' : 'dark'} />
      {showOnboarding ? (
        <OnboardingScreen
          onComplete={handleOnboardingComplete}
          onNavigateToRegistration={handleNavigateToRegistration}
          onNavigateToSampleSMS={handleNavigateToSampleSMS}
        />
      ) : showSampleSMS ? (
        <SampleSMSScreen
          institution={sampleSMSInstitution}
          countryCode={sampleSMSCountry}
          onPatternCreated={handleSampleSMSPatternCreated}
          onCancel={handleSampleSMSCancel}
        />
      ) : authScreen ? (
        renderAuthScreen()
      ) : (
        <>
          {/* Main Content with Bottom Navigation */}
          <View style={{ flex: 1 }}>
            {renderScreen()}
          </View>
          <BottomNavigation currentTab={currentTab} onTabChange={setCurrentTab} />
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
