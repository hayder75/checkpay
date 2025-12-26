import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import BottomNavigation, { Tab } from './src/components/BottomNavigation';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';
import BanksScreen from './src/screens/BanksScreen';
import TransactionsScreen from './src/screens/TransactionsScreen';
import VerifyPaymentsScreen from './src/screens/VerifyPaymentsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import OCRScreen from './src/screens/OCRScreen';
import InstitutionBuilderScreen from './src/screens/InstitutionBuilderScreen';
import { storage } from './src/services/storage';
import { smsService } from './src/services/smsService';
import { Pattern } from './src/types';
import { authAPI } from './src/services/api';
import { patternsAPI } from './src/services/api';
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
  const [authScreen, setAuthScreen] = useState<'login' | 'register' | null>(null);
  const [showInstitutionBuilder, setShowInstitutionBuilder] = useState(false);
  const [cameFromOnboarding, setCameFromOnboarding] = useState(false);

  // Check if user is employee (only OCR access)
  const isEmployee = user?.role === 'EMPLOYEE';

  // For employees, force OCR tab and prevent access to other features
  useEffect(() => {
    if (isEmployee) {
      if (currentTab !== 'ocr') {
        setCurrentTab('ocr');
      }
      if (showInstitutionBuilder) {
        setShowInstitutionBuilder(false);
      }
    }
  }, [isEmployee, currentTab, showInstitutionBuilder]);

  useEffect(() => {
    initializeApp();
    
    // Start SMS monitoring after app initializes (with longer delay to not block UI)
    const startMonitoring = async () => {
      try {
        const onboardingCompleted = await storage.getOnboardingCompleted();
        if (onboardingCompleted) {
          // Delay SMS monitoring to not block app startup
          await smsService.startMonitoring();
        }
      } catch (error) {
        console.error('Error starting SMS monitoring:', error);
      }
    };
    
    // Start monitoring after app is fully loaded (longer delay for better UX)
    const timer = setTimeout(startMonitoring, 3000);
    
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

  // Helper to safely set onboarding - prevents showing if user has patterns
  const setShowOnboardingSafe = async (value: boolean) => {
    if (value && user && patterns.length > 0) {
      console.log('⚠️ [App] Preventing onboarding - user is authenticated and has patterns');
      return;
    }
    setShowOnboarding(value);
  };

  const checkAuth = async () => {
    try {
      // Check for stored token
      const token = await storage.getToken();
      const storedUser = await storage.getUser();
      const storedApiKey = await storage.getApiKey();

      console.log('🔍 [App] Checking authentication:', {
        hasToken: !!token,
        hasUser: !!storedUser,
        hasApiKey: !!storedApiKey,
      });

      if (token && storedUser && storedApiKey) {
        // Verify token is still valid with real API
        try {
          console.log('🔄 [App] Validating token with backend...');
          const response = await authAPI.getMe();
          if (response.success && response.data) {
            // Token valid, load user and patterns in parallel for faster startup
            console.log('✅ [App] Token is valid, loading user data');
            setUser(response.data);
            setApiKey(storedApiKey);
            
            // Set loading to false immediately so UI appears faster
            setLoading(false);
            
            // Load patterns and country patterns in parallel (non-blocking)
            Promise.all([
              // Load user patterns
              (async () => {
                try {
                  const patternsResponse = await patternsAPI.getAll();
                  if (patternsResponse.success && patternsResponse.data) {
                    const loadedPatterns = Array.isArray(patternsResponse.data) 
                      ? patternsResponse.data 
                      : [];
                    setPatterns(loadedPatterns);
                    console.log(`✅ [App] Loaded ${loadedPatterns.length} user patterns from API`);
                  } else {
                    setPatterns([]);
                  }
                } catch (error) {
                  console.error('❌ [App] Error loading patterns:', error);
                  setPatterns([]);
                }
              })(),
              // Set country code and download institution patterns (background)
              (async () => {
                try {
                  await storage.setOnboardingCompleted(true);
                  
                  // Set country code from user's country field if available
                  let countryCode = await storage.getCountryCode();
                  if (!countryCode && response.data?.country) {
                    countryCode = response.data.country;
                    await storage.setCountryCode(countryCode);
                    console.log(`✅ [App] Set country code from user profile: ${countryCode}`);
                  }
                  
                  // Download institution patterns in background (non-blocking)
                  if (countryCode) {
                    // Delay download to not block UI
                    setTimeout(async () => {
                      try {
                        const { downloadCountryPatterns } = await import('./src/utils/patternVerifier');
                        const institutionPatterns = await downloadCountryPatterns(countryCode);
                        console.log(`✅ Downloaded and saved ${institutionPatterns.length} institution patterns for country ${countryCode}`);
                      } catch (error) {
                        console.error('Error downloading institution patterns:', error);
                      }
                    }, 1000);
                  } else {
                    console.warn('⚠️ [App] No country code available - SMS monitoring may not work properly');
                  }
                } catch (error) {
                  console.error('Error setting up country patterns:', error);
                }
              })()
            ]).catch(error => {
              console.error('Error in parallel initialization:', error);
            });
          } else {
            // Token invalid response
            console.warn('⚠️ [App] Token validation returned unsuccessful response');
            await storage.removeToken();
            await storage.removeUser();
            setLoading(false);
            // Keep API key in case user wants to use it
          }
        } catch (error: any) {
          // Token invalid or expired
          console.error('❌ [App] Token validation failed:', error.message || error);
          const errorStatus = error.response?.status;
          
          if (errorStatus === 401) {
            // Unauthorized - token expired or invalid
            console.warn('🔒 [App] Token expired or invalid (401), clearing auth data');
            await storage.removeToken();
            await storage.removeUser();
            // Keep API key as fallback
          } else {
            // Network error or other issue - don't clear token yet
            console.warn('⚠️ [App] Token validation failed due to network/other error, keeping token');
          }
          setLoading(false);
        }
      } else if (storedApiKey) {
        // Fallback: Use API key only (old method)
        console.log('⚠️ [App] No token found, using API key only');
        setApiKey(storedApiKey);
        setPatterns([]);
        setLoading(false);
      } else {
        console.log('ℹ️ [App] No authentication credentials found');
        setLoading(false);
      }
    } catch (error) {
      console.error('❌ [App] Auth check error:', error);
      setLoading(false);
    }
  };

  const handleLoginSuccess = async (userData: any, userApiKey: string, userPatterns: Pattern[]) => {
    setUser(userData);
    setApiKey(userApiKey);
    setPatterns(userPatterns);
    setAuthScreen(null); // Clear auth screen after successful login
    setCameFromOnboarding(false); // Reset flag for login (not from onboarding)
    
    // Patterns are now always fetched from backend, no local storage
    
    // Load or create business for the user (only for BUSINESS_OWNER and DEVELOPER roles)
    try {
      const userRole = userData?.role;
      const canCreateBusiness = userRole === 'BUSINESS_OWNER' || userRole === 'DEVELOPER';
      
      if (canCreateBusiness) {
        let businessId = await storage.getBusinessId();
        if (!businessId) {
          const { businessAPI } = await import('./src/services/api');
          const businessesResponse = await businessAPI.getAll();
          if (businessesResponse.success && businessesResponse.data) {
            const businesses = Array.isArray(businessesResponse.data) ? businessesResponse.data : [];
            if (businesses.length > 0) {
              businessId = businesses[0].id;
              if (businessId) {
                await storage.setBusinessId(businessId);
                console.log(`✅ Loaded business ID: ${businessId}`);
              }
            } else {
              // Create a default business for the user (only if they have permission)
              try {
                const businessName = userData?.username || userData?.phone || 'My Business';
                const createResponse = await businessAPI.create({
                  name: businessName,
                  description: 'Default business for personal transactions',
                });
                if (createResponse.success && createResponse.data?.id) {
                  businessId = createResponse.data.id;
                  if (businessId) {
                    await storage.setBusinessId(businessId);
                    console.log(`✅ Created default business: ${businessId}`);
                  }
                }
              } catch (createError: any) {
                // Handle business creation errors gracefully
                if (createError.response?.status === 403) {
                  console.log('ℹ️ [App] User role does not allow business creation, skipping');
                } else {
                  console.warn('⚠️ [App] Failed to create business:', createError.message || createError);
                }
              }
            }
          }
        }
      } else {
        console.log(`ℹ️ [App] User role (${userRole}) does not require business, skipping business setup`);
      }
    } catch (error) {
      console.warn('⚠️ [App] Error loading/creating business:', error);
      // Continue without business - will be handled when sending transactions
    }
    
    // User is now authenticated - mark onboarding as completed and go to home
    // We don't redirect to onboarding for already logged-in users
    console.log('✅ User logged in successfully, going to home screen');
    await storage.setOnboardingCompleted(true);
    
    // Set country code from user's country field if available
    let countryCode = await storage.getCountryCode();
    if (!countryCode && userData?.country) {
      // User has country in their profile, set it as country code
      countryCode = userData.country;
      await storage.setCountryCode(countryCode);
      console.log(`✅ Set country code from user profile: ${countryCode}`);
    }
    
    // Download and save institution patterns if we have country code
    if (countryCode) {
      try {
        const { downloadCountryPatterns } = await import('./src/utils/patternVerifier');
        const institutionPatterns = await downloadCountryPatterns(countryCode);
        console.log(`✅ Downloaded and saved ${institutionPatterns.length} institution patterns for country ${countryCode}`);
      } catch (error) {
        console.error('Error downloading institution patterns:', error);
      }
    } else {
      console.warn('⚠️ No country code available - SMS monitoring may not work properly');
    }
    
    // Start SMS monitoring after successful login
    try {
      console.log('🔄 Starting SMS monitoring after login...');
      await smsService.startMonitoring();
      console.log('✅ SMS monitoring started');
    } catch (error) {
      console.error('Error starting SMS monitoring after login:', error);
    }
    
    // Sync any unsynced transactions after login (non-blocking)
    smsService.syncAllUnsyncedTransactions().catch((error) => {
      const errorMsg = error?.message || 'Unknown error';
      console.warn('⚠️ [App] Some transactions failed to sync after login:', errorMsg);
    });
  };

  const refreshPatterns = async () => {
    try {
      const patternsResponse = await patternsAPI.getAll();
      if (patternsResponse.success && patternsResponse.data) {
        const loadedPatterns = Array.isArray(patternsResponse.data) 
          ? patternsResponse.data 
          : [];
        await storage.setPatterns(loadedPatterns);
        setPatterns(loadedPatterns);
        console.log(`✅ Refreshed ${loadedPatterns.length} patterns from backend`);
        return loadedPatterns;
      }
    } catch (error) {
      console.error('Error refreshing patterns:', error);
    }
    return patterns;
  };

  const handleLogout = async () => {
    try {
      console.log('🚪 [App] Starting logout process...');
      
      // Stop SMS monitoring
      try {
        smsService.stopMonitoring();
        console.log('✅ [App] SMS monitoring stopped');
      } catch (error) {
        console.error('Error stopping SMS monitoring:', error);
      }
      
      // Clear all storage
      await storage.clearAll();
      console.log('✅ [App] Storage cleared');
      
      // Reset all state
      setUser(null);
      setApiKey(null);
      setPatterns([]);
      setCurrentTab('home');
      setShowOnboarding(false);
      setAuthScreen('login'); // Show login screen after logout
      setLoading(false);
      
      console.log('✅ [App] Logout completed, showing login screen');
    } catch (error) {
      console.error('❌ [App] Error during logout:', error);
      // Even if there's an error, try to show login screen
      setAuthScreen('login');
      setLoading(false);
    }
  };

  const renderScreen = () => {
    // If showing institution builder, render it
    if (showInstitutionBuilder) {
      return (
        <InstitutionBuilderScreen
          apiKey={apiKey || ''}
          onInstitutionCreated={() => {
            setShowInstitutionBuilder(false);
            refreshPatterns();
          }}
          onInstitutionsRefreshed={(updatedPatterns) => {
            setPatterns(updatedPatterns);
          }}
        />
      );
    }

    switch (currentTab) {
      case 'home':
        return (
          <HomeScreen 
            apiKey={apiKey} 
            onNavigateToProfile={() => setCurrentTab('profile')}
          />
        );
      case 'banks':
        // Banks is now a sub-screen of Profile, but we keep it here for direct access if needed
        // or if we want to support back navigation from it
        return (
          <View style={{ flex: 1 }}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => setCurrentTab('profile')} style={styles.menuButton}>
                <Text style={{ fontSize: 24, color: colors.text }}>←</Text>
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { color: colors.text }]}>My Banks</Text>
            </View>
            <BanksScreen 
              apiKey={apiKey} 
              onNavigateToInstitutionBuilder={isEmployee ? undefined : () => setShowInstitutionBuilder(true)}
            />
          </View>
        );
      case 'transactions':
        return <TransactionsScreen apiKey={apiKey} />;
      case 'verify':
        return <VerifyPaymentsScreen apiKey={apiKey} />;
      case 'ocr':
        return <OCRScreen patterns={patterns} />;
      case 'profile':
        return (
          <ProfileScreen 
            apiKey={apiKey} 
            onLogout={handleLogout} 
            onNavigateToBanks={() => setCurrentTab('banks')}
          />
        );
      default:
        return (
          <HomeScreen 
            apiKey={apiKey} 
            onNavigateToProfile={() => setCurrentTab('profile')}
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

  const handleRegisterSuccess = async (userData: any, userApiKey: string, userPatterns: Pattern[]) => {
    setUser(userData);
    setApiKey(userApiKey);
    setPatterns(userPatterns);
    setAuthScreen(null); // Clear auth screen after successful registration
    
    // Patterns are now always fetched from backend, no local storage
    
    // If user came from onboarding, they've already completed it - don't check again
    if (cameFromOnboarding) {
      console.log('✅ User came from onboarding flow, skipping onboarding check');
      setCameFromOnboarding(false); // Reset flag
      
      // Download and save institution patterns for the user's country
      const countryCode = await storage.getCountryCode();
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
        console.log('🔄 Starting SMS monitoring after authentication...');
        await smsService.startMonitoring();
        console.log('✅ SMS monitoring started');
      } catch (error) {
        console.error('Error starting SMS monitoring after auth:', error);
      }
      
      // Sync any unsynced transactions after login (non-blocking)
      smsService.syncAllUnsyncedTransactions().catch((error) => {
        const errorMsg = error?.message || 'Unknown error';
        console.warn('⚠️ [App] Some transactions failed to sync after verification:', errorMsg);
        console.warn('⚠️ [App] Transactions are saved locally and will be synced later');
      });
      return;
    }
    
    // User is now authenticated - mark onboarding as completed and go to home
    // We don't redirect to onboarding for already registered users
    console.log('✅ User registered successfully, going to home screen');
    await storage.setOnboardingCompleted(true);
    
    // Set country code from user's country field if available
    let countryCode = await storage.getCountryCode();
    if (!countryCode && userData?.country) {
      // User has country in their profile, set it as country code
      countryCode = userData.country;
      await storage.setCountryCode(countryCode);
      console.log(`✅ Set country code from user profile: ${countryCode}`);
    }
    
    // Download and save institution patterns if we have country code
    if (countryCode) {
      try {
        const { downloadCountryPatterns } = await import('./src/utils/patternVerifier');
        const institutionPatterns = await downloadCountryPatterns(countryCode);
        console.log(`✅ Downloaded and saved ${institutionPatterns.length} institution patterns for country ${countryCode}`);
      } catch (error) {
        console.error('Error downloading institution patterns:', error);
      }
    } else {
      console.warn('⚠️ No country code available - SMS monitoring may not work properly');
    }
    
    // Start SMS monitoring after successful registration
    try {
      console.log('🔄 Starting SMS monitoring after registration...');
      await smsService.startMonitoring();
      console.log('✅ SMS monitoring started');
    } catch (error) {
      console.error('Error starting SMS monitoring after registration:', error);
    }
    
    // Sync any unsynced transactions after registration (non-blocking)
    smsService.syncAllUnsyncedTransactions().catch((error) => {
      const errorMsg = error?.message || 'Unknown error';
      console.warn('⚠️ [App] Some transactions failed to sync after registration:', errorMsg);
    });
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
        // Mark that user came from onboarding so we don't check onboarding again after auth
        console.log('First time install - showing sign-in screen');
        setCameFromOnboarding(true);
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
    setCameFromOnboarding(true); // Mark that user came from onboarding
    setAuthScreen('register');
  };

  const handleNavigateToSampleSMS = (institution: string, countryCode: string) => {
    console.log('📱 [SampleSMS] Bypassed - skipping sample SMS screen for OCR testing');
    // Bypass sample SMS screen - just complete onboarding
    setShowOnboarding(false);
    handleOnboardingComplete(countryCode, []);
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

  // Prevent showing onboarding if user is authenticated (has user and apiKey)
  // This ensures that authenticated users go directly to home screen
  const shouldShowOnboarding = showOnboarding && !user && !apiKey;

  return (
    <>
      <StatusBar style={colors.background === '#1a1a1a' ? 'light' : 'dark'} />
      {shouldShowOnboarding ? (
        <OnboardingScreen
          onComplete={handleOnboardingComplete}
          onNavigateToRegistration={handleNavigateToRegistration}
          onNavigateToSampleSMS={handleNavigateToSampleSMS}
        />
      ) : authScreen ? (
        renderAuthScreen()
      ) : (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          {/* Main Content with Bottom Navigation */}
          <View style={{ flex: 1 }}>
            {renderScreen()}
          </View>
          {!showInstitutionBuilder && (
            <BottomNavigation 
              currentTab={currentTab} 
              onTabChange={setCurrentTab}
              isEmployee={isEmployee}
            />
          )}
        </View>
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
