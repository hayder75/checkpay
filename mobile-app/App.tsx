import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet, PermissionsAndroid, Platform, AppState, AppStateStatus, Modal, Linking, Image } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { PopupProvider } from './src/contexts/PopupContext';
import BottomNavigation, { Tab } from './src/components/BottomNavigation';
import ErrorBoundary from './src/components/ErrorBoundary';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import EmployeeRegisterScreen from './src/screens/EmployeeRegisterScreen';
import HomeScreen from './src/screens/HomeScreen';
import BanksScreen from './src/screens/BanksScreen';
import TransactionsScreen from './src/screens/TransactionsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import OCRScreen from './src/screens/OCRScreen';
import EmployeeScreen from './src/screens/EmployeeScreen';
import EmployeeManagementScreen from './src/screens/EmployeeManagementScreen';
import EmployeeTransactionsScreen from './src/screens/EmployeeTransactionsScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import LockScreen from './src/screens/LockScreen';
import PINSetupScreen from './src/screens/PINSetupScreen';
import ProfileCompletionScreen from './src/screens/ProfileCompletionScreen';
import { storage } from './src/services/storage';
import { smsService } from './src/services/smsService';
import { securityService } from './src/services/securityService';
import { isDefaultSMSApp, requestDefaultSMSRole } from './src/utils/smsRole';
import { Pattern } from './src/types';
import { authAPI } from './src/services/api';
import { patternsAPI, telegramAuthAPI, subscribeNetworkStatus } from './src/services/api';
import 'react-native-url-polyfill/auto';

const PENDING_TELEGRAM_AUTH_TOKEN_KEY = 'pending_telegram_auth_token';

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
  const [authScreen, setAuthScreen] = useState<'login' | 'register' | 'employee-register' | null>(null);
  const [cameFromOnboarding, setCameFromOnboarding] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<{ id: string; name: string } | null>(null);
  // Security / Lock screen state
  const [isLocked, setIsLocked] = useState(false);
  const [securityEnabled, setSecurityEnabled] = useState(false);
  const [showSecuritySetupPrompt, setShowSecuritySetupPrompt] = useState(false);
  const [showPINSetupFromPrompt, setShowPINSetupFromPrompt] = useState(false);
  const [biometricAvailableForPrompt, setBiometricAvailableForPrompt] = useState(false);
  const [showProfileCompletion, setShowProfileCompletion] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const appState = useRef(AppState.currentState);
  const backgroundTimestamp = useRef<number | null>(null);
  const smsReminderShownThisLaunch = useRef(false);

  // Check if user is employee (only OCR access)
  const isEmployee = user?.role === 'EMPLOYEE';

  // For employees, force OCR tab and prevent access to other features
  useEffect(() => {
    if (isEmployee) {
      if (currentTab !== 'ocr') {
        setCurrentTab('ocr');
      }
    }
  }, [isEmployee, currentTab]);

  // Track previous tab to detect when leaving profile screen
  const previousTab = useRef<Tab>('home');
  useEffect(() => {
    // If user was on profile and is now leaving, refresh security state
    // (they might have enabled/disabled PIN)
    if (previousTab.current === 'profile' && currentTab !== 'profile') {
      refreshSecurityState();
    }
    previousTab.current = currentTab;
  }, [currentTab]);

  // Check security status on mount and when returning from background
  useEffect(() => {
    checkSecurityAndLock();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeNetworkStatus((status) => {
      setIsOffline(status === 'offline');
    });

    return unsubscribe;
  }, []);

  // App state change listener for lock screen
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [securityEnabled]);

  const checkSecurityAndLock = async () => {
    try {
      const enabled = await securityService.isSecurityEnabled();
      console.log('🔐 [App] Security check on mount - enabled:', enabled);
      setSecurityEnabled(enabled);
      if (enabled) {
        setIsLocked(true);
        console.log('🔒 [App] Lock screen will be shown');
      }
    } catch (error) {
      console.error('Error checking security status:', error);
    }
  };

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (appState.current.match(/active/) && nextAppState.match(/inactive|background/)) {
      // App going to background - record timestamp
      backgroundTimestamp.current = Date.now();
      console.log('📱 [App] Going to background');
    } else if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      // App coming to foreground
      console.log('📱 [App] Coming to foreground');
      const enabled = await securityService.isSecurityEnabled();
      setSecurityEnabled(enabled);
      
      if (enabled && backgroundTimestamp.current) {
        // Lock app if it was in background for more than a few seconds
        const timeInBackground = Date.now() - backgroundTimestamp.current;
        if (timeInBackground > 3000) { // 3 seconds threshold
          setIsLocked(true);
          console.log('🔒 [App] Locking app after background');
        }
      }
      await remindSMSRoleIfNeeded();
      backgroundTimestamp.current = null;
    }
    appState.current = nextAppState;
  };

  const remindSMSRoleIfNeeded = async () => {
    if (Platform.OS !== 'android') {
      return;
    }

    const onboardingCompleted = await storage.getOnboardingCompleted();
    const token = await storage.getToken();
    if (!onboardingCompleted || !token) {
      return;
    }

    const isDefault = await isDefaultSMSApp();
    if (isDefault || smsReminderShownThisLaunch.current) {
      return;
    }

    smsReminderShownThisLaunch.current = true;
    Alert.alert(
      'Enable SMS Auto Import',
      'To auto-detect transactions from SMS, set CheckPay as your default SMS app. You can continue using manual mode anytime.',
      [
        { text: 'Continue Manual Mode', style: 'cancel' },
        {
          text: 'Enable SMS Import',
          onPress: () => {
            requestDefaultSMSRole().catch((error) => {
              console.error('Error requesting default SMS role:', error);
            });
          },
        },
      ]
    );
  };

  const handleUnlock = () => {
    setIsLocked(false);
    console.log('🔓 [App] Unlocked');
  };

  // Refresh security state - call this after PIN is set up or toggled
  const refreshSecurityState = async () => {
    try {
      const enabled = await securityService.isSecurityEnabled();
      console.log('🔐 [App] Security state refreshed:', enabled);
      setSecurityEnabled(enabled);
      if (enabled) {
        setIsLocked(true);
      }
    } catch (error) {
      console.error('Error refreshing security state:', error);
    }
  };

  // Check if we should prompt user to set up security after login
  const checkAndPromptSecuritySetup = async () => {
    try {
      const enabled = await securityService.isSecurityEnabled();
      const wasPrompted = await securityService.wasOnboardingPrompted();
      
      // If security is not enabled and user hasn't been prompted yet, show the setup prompt
      if (!enabled && !wasPrompted) {
        console.log('🔐 [App] Security not set up, showing setup prompt');
        // Check biometric availability for the prompt
        const bioInfo = await securityService.getBiometricInfo();
        setBiometricAvailableForPrompt(bioInfo.isAvailable && bioInfo.hasEnrolledBiometrics);
        setShowSecuritySetupPrompt(true);
      }
    } catch (error) {
      console.error('Error checking security setup:', error);
    }
  };

  // Handle starting PIN setup from prompt
  const handleStartPINSetupFromPrompt = () => {
    setShowSecuritySetupPrompt(false);
    setShowPINSetupFromPrompt(true);
  };

  // Handle security setup completion from prompt
  const handleSecuritySetupFromPromptComplete = async () => {
    setShowPINSetupFromPrompt(false);
    await refreshSecurityState();
  };

  // Handle skipping security setup from prompt
  const handleSkipSecuritySetup = async () => {
    await securityService.setOnboardingPrompted();
    setShowSecuritySetupPrompt(false);
  };

  // Handle profile completion (for social auth users)
  const handleProfileComplete = async (updatedUser: any) => {
    console.log('✅ [App] Profile completed:', updatedUser);
    setUser(updatedUser);
    setShowProfileCompletion(false);
    
    // Continue with login flow
    const enabled = await securityService.isSecurityEnabled();
    if (enabled) {
      await refreshSecurityState();
    } else {
      await checkAndPromptSecuritySetup();
    }
    
    // Set country code and download patterns
    if (updatedUser?.country) {
      await storage.setCountryCode(updatedUser.country);
      try {
        const { downloadCountryPatterns } = await import('./src/utils/patternVerifier');
        await downloadCountryPatterns(updatedUser.country);
      } catch (error) {
        console.error('Error downloading patterns:', error);
      }
    }
    
    // Start SMS monitoring
    try {
      await smsService.startMonitoring();
    } catch (error) {
      console.error('Error starting SMS monitoring:', error);
    }
    
    // Setup notifications
    setupNotifications();
  };

  useEffect(() => {
    initializeApp();
    requestPermissions();
    
    // Start SMS monitoring after app initializes (with longer delay to not block UI)
    const startMonitoring = async () => {
      try {
        const onboardingCompleted = await storage.getOnboardingCompleted();
        const token = await storage.getToken();
        if (onboardingCompleted && token) {
          // Delay SMS monitoring to not block app startup
          await smsService.startMonitoring();
        } else if (onboardingCompleted && !token) {
          console.log('ℹ️ [App] Skipping SMS monitoring startup: user is not authenticated yet');
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

  useEffect(() => {
    const handleIncomingUrl = async (url: string | null) => {
      if (!url || !url.startsWith('checkpay://')) {
        return;
      }

      console.log('🔗 [App] Deep link received:', url);

      if (url.includes('auth/success')) {
        await resumePendingTelegramAuth();
      }
    };

    Linking.getInitialURL().then(handleIncomingUrl).catch((error) => {
      console.error('Error reading initial URL:', error);
    });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleIncomingUrl(url).catch((error) => {
        console.error('Error handling deep link:', error);
      });
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const resumePendingTelegramAuth = async () => {
    try {
      const pendingToken = await storage.getItem(PENDING_TELEGRAM_AUTH_TOKEN_KEY);
      if (!pendingToken) {
        return;
      }

      console.log('🔄 [App] Resuming pending Telegram authentication');
      const statusResponse = await telegramAuthAPI.checkStatus(pendingToken);

      if (statusResponse?.status !== 'COMPLETED' || !statusResponse?.data) {
        return;
      }

      const { token, user } = statusResponse.data;
      if (!token || !user?.apiKey) {
        return;
      }

      await storage.removeItem(PENDING_TELEGRAM_AUTH_TOKEN_KEY);
      await storage.setToken(token);
      await storage.setUser(user);
      await storage.setApiKey(user.apiKey);

      let loadedPatterns: Pattern[] = [];
      try {
        const patternsResponse = await patternsAPI.getAll();
        loadedPatterns = patternsResponse?.success && Array.isArray(patternsResponse?.data)
          ? patternsResponse.data
          : [];
      } catch (error) {
        console.error('Error loading patterns after Telegram auth resume:', error);
      }

      await handleLoginSuccess(user, user.apiKey, loadedPatterns);
    } catch (error) {
      console.error('Error resuming Telegram authentication:', error);
    }
  };

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.CAMERA,
        ]);
        console.log('🔐 [App] Permissions status:', granted);
      } catch (err) {
        console.warn(err);
      }
    }
  };

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

  const setupNotifications = async () => {
    try {
      const { 
        registerForPushNotificationsAsync, 
        sendPushTokenToBackend, 
        setupNotificationListeners,
        setNotificationNavigationCallback 
      } = await import('./src/services/NotificationService');
      
      const token = await registerForPushNotificationsAsync();
      if (token) {
        await sendPushTokenToBackend(token);
      }
      
      // Set up navigation callback for notification taps
      setNotificationNavigationCallback((data) => {
        const { txnId, type, notificationId } = data;
        
        // Navigate based on notification type
        if (type === 'TRANSACTION_VERIFIED' || type === 'TRANSACTION_RECEIVED') {
          // Navigate to transactions screen
          setCurrentTab('transactions');
        } else if (type === 'TOKEN_LOW' || type === 'TOKEN_DEPLETED') {
          // Navigate to profile/settings for token management
          setCurrentTab('profile');
        } else {
          // Default: navigate to notifications screen
          setCurrentTab('notifications' as any);
        }
      });
      
      setupNotificationListeners();
    } catch (error) {
      console.error('Error setting up notifications:', error);
    }
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
            
            // Check security state to show lock screen if needed
            await refreshSecurityState();
            
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
                    await storage.setCountryCode(countryCode!);
                    console.log(`✅ [App] Set country code from user profile: ${countryCode}`);
                  }
                  
                  // Download institution patterns in background (non-blocking)
                  if (countryCode) {
                    // Delay download to not block UI
                    setTimeout(async () => {
                      try {
                        const { downloadCountryPatterns } = await import('./src/utils/patternVerifier');
                        const institutionPatterns = await downloadCountryPatterns(countryCode!);
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

            // Setup notifications
            setupNotifications();

            // Remind user about default SMS role (manual mode remains available)
            await remindSMSRoleIfNeeded();
          } else { // Setup notifications
            setupNotifications();
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
    
    // Check if profile completion is needed (for social auth users)
    if (userData?.profileComplete === false) {
      console.log('🔄 [App] Profile incomplete, showing completion screen');
      setShowProfileCompletion(true);
      return; // Don't proceed with rest of login flow until profile is complete
    }
    
    // Check if security is enabled (for lock screen) or prompt setup
    const enabled = await securityService.isSecurityEnabled();
    if (enabled) {
      await refreshSecurityState();
    } else {
      // Check if we should prompt user to set up security
      await checkAndPromptSecuritySetup();
    }
    
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
      await storage.setCountryCode(countryCode!);
      console.log(`✅ Set country code from user profile: ${countryCode}`);
    }
    
    // Download and save institution patterns if we have country code
    if (countryCode) {
      try {
        const { downloadCountryPatterns } = await import('./src/utils/patternVerifier');
        const institutionPatterns = await downloadCountryPatterns(countryCode!);
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

    // Setup notifications
    setupNotifications();

    // Remind user about default SMS role on login
    await remindSMSRoleIfNeeded();
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
      
      // Clear security data
      await securityService.clearAllSecurityData();
      console.log('✅ [App] Security data cleared');
      
      // Reset all state
      setUser(null);
      setApiKey(null);
      setPatterns([]);
      setCurrentTab('home');
      setShowOnboarding(false);
      setAuthScreen('login'); // Show login screen after logout
      setLoading(false);
      setIsLocked(false);
      setSecurityEnabled(false);
      
      console.log('✅ [App] Logout completed, showing login screen');
    } catch (error) {
      console.error('❌ [App] Error during logout:', error);
      // Even if there's an error, try to show login screen
      setAuthScreen('login');
      setLoading(false);
    }
  };

  const renderScreen = () => {
    console.log('App.tsx: renderScreen called with currentTab:', currentTab);
    // For employees, show employee screen (no bottom nav)
    if (isEmployee) {
      return <EmployeeScreen onLogout={handleLogout} />;
    }

    switch (currentTab) {
      case 'home':
        return (
          <HomeScreen 
            apiKey={apiKey} 
            onNavigateToProfile={() => {
              console.log('Navigating to profile');
              setCurrentTab('profile');
            }}
            onNavigateToTransactions={() => {
              console.log('Navigating to transactions');
              setCurrentTab('transactions');
            }}
            onNavigateToEmployeeManagement={() => {
              console.log('Navigating to employee management');
              setCurrentTab('employee-management');
            }}
            onNavigateToNotifications={() => {
              console.log('Navigating to notifications');
              setCurrentTab('notifications' as any);
            }}
          />
        );
      case 'banks':
        return (
          <BanksScreen 
            apiKey={apiKey} 
          />
        );
      case 'transactions':
        return <TransactionsScreen apiKey={apiKey} />;
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
      case 'employee-management':
        return (
          <EmployeeManagementScreen 
            onBack={() => setCurrentTab('home')}
            onViewTransactions={(id, name) => {
              setSelectedEmployee({ id, name });
              setCurrentTab('employee-transactions' as any);
            }}
          />
        );
      case 'employee-transactions' as any:
        return (
          <EmployeeTransactionsScreen 
            employeeId={selectedEmployee?.id || ''}
            employeeName={selectedEmployee?.name || ''}
            onBack={() => setCurrentTab('employee-management')}
          />
        );
      case 'notifications' as any:
        return <NotificationsScreen onBack={() => setCurrentTab('home')} />;
      default:
        return (
          <HomeScreen 
            apiKey={apiKey} 
            onNavigateToProfile={() => {
              console.log('Navigating to profile');
              setCurrentTab('profile');
            }}
            onNavigateToTransactions={() => {
              console.log('Navigating to transactions');
              setCurrentTab('transactions');
            }}
            onNavigateToEmployeeManagement={() => {
              console.log('Navigating to employee management');
              setCurrentTab('employee-management');
            }}
            onNavigateToNotifications={() => {
              console.log('Navigating to notifications');
              setCurrentTab('notifications' as any);
            }}
          />
        );
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Image
          source={require('./assets/logo/logo - Asset 10.png')}
          style={styles.loadingLogo}
          resizeMode="contain"
        />
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
    
    // Check if profile completion is needed (for social auth users)
    if (userData?.profileComplete === false) {
      console.log('🔄 [App] Profile incomplete after registration, showing completion screen');
      setShowProfileCompletion(true);
      return; // Don't proceed until profile is complete
    }
    
    // Check if security is enabled (for lock screen) or prompt setup
    const enabled = await securityService.isSecurityEnabled();
    if (enabled) {
      await refreshSecurityState();
    } else if (!cameFromOnboarding) {
      // Only prompt if not coming from onboarding (they had the chance there)
      await checkAndPromptSecuritySetup();
    }
    
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
      await storage.setCountryCode(countryCode!);
      console.log(`✅ Set country code from user profile: ${countryCode}`);
    }
    
    // Download and save institution patterns if we have country code
    if (countryCode) {
      try {
        const { downloadCountryPatterns } = await import('./src/utils/patternVerifier');
        const institutionPatterns = await downloadCountryPatterns(countryCode!);
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

    // Setup notifications
    setupNotifications();
  };

  const handleOnboardingComplete = async (countryCode: string, selectedBanks: string[]) => {
    try {
      await storage.setOnboardingCompleted(true);
      await storage.setUserCountry(countryCode);
      await storage.setSelectedBanks(selectedBanks);
      setShowOnboarding(false);
      
      // Refresh security state in case user set up PIN during onboarding
      await refreshSecurityState();
      
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

  const handleEmployeeRegisterSuccess = async () => {
    // After employee registration, refresh auth to get updated user role
    console.log('🔄 [App] Refreshing auth after employee registration...');
    await checkAuth();
    setAuthScreen(null);
    // Force a small delay to ensure state is updated
    setTimeout(() => {
      console.log('✅ [App] Auth refresh complete');
    }, 500);
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
      case 'employee-register':
        return (
          <EmployeeRegisterScreen
            onRegistrationSuccess={handleEmployeeRegisterSuccess}
            onCancel={() => setAuthScreen('login')}
          />
        );
      case 'login':
      default:
        return (
          <LoginScreen
            onLoginSuccess={handleLoginSuccess}
            onSwitchToRegister={() => setAuthScreen('register')}
            onSwitchToEmployeeRegister={() => setAuthScreen('employee-register')}
          />
        );
    }
  };

  // Don't show auth screen by default - only when user explicitly requests it

  // Prevent showing onboarding if user is authenticated (has user and apiKey)
  // This ensures that authenticated users go directly to home screen
  const shouldShowOnboarding = showOnboarding && !user && !apiKey;

  // Show lock screen if security is enabled and app is locked
  // Only show after loading is complete and user is authenticated
  const shouldShowLockScreen = isLocked && securityEnabled && !loading && !authScreen && !shouldShowOnboarding && (user || apiKey);
  
  // Debug logging for lock screen state
  if (__DEV__) {
    console.log('🔐 [App] Lock screen check:', {
      isLocked,
      securityEnabled,
      loading,
      authScreen,
      shouldShowOnboarding,
      hasUser: !!user,
      hasApiKey: !!apiKey,
      shouldShowLockScreen,
      showSecuritySetupPrompt,
    });
  }

  // PIN Setup screen from post-login prompt
  if (showPINSetupFromPrompt) {
    return (
      <ThemeProvider>
        <PINSetupScreen
          onComplete={handleSecuritySetupFromPromptComplete}
          onCancel={() => {
            setShowPINSetupFromPrompt(false);
            handleSkipSecuritySetup();
          }}
          showBiometricOption={biometricAvailableForPrompt}
        />
      </ThemeProvider>
    );
  }

  return (
    <>
      <StatusBar style={colors.background === '#1a1a1a' ? 'light' : 'dark'} />

      {isOffline && (
        <View style={styles.offlineBannerWrap} pointerEvents="none">
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineBannerText}>You are offline. Some features may be temporarily unavailable.</Text>
          </View>
        </View>
      )}
      
      {/* Security Setup Prompt Modal */}
      <Modal
        visible={showSecuritySetupPrompt}
        transparent
        animationType="fade"
        onRequestClose={handleSkipSecuritySetup}
      >
        <View style={styles.securityPromptOverlay}>
          <View style={[styles.securityPromptCard, { backgroundColor: colors.surface }]}>
            <View style={[styles.securityPromptIcon, { backgroundColor: colors.primary + '20' }]}>
              <Text style={{ fontSize: 40 }}>🔒</Text>
            </View>
            <Text style={[styles.securityPromptTitle, { color: colors.text }]}>
              Secure Your App
            </Text>
            <Text style={[styles.securityPromptSubtitle, { color: colors.textSecondary }]}>
              Add a PIN to protect your financial data. You can also enable biometrics for quick access.
            </Text>
            <TouchableOpacity
              style={[styles.securityPromptButton, { backgroundColor: colors.primary }]}
              onPress={handleStartPINSetupFromPrompt}
            >
              <Text style={styles.securityPromptButtonText}>Set Up PIN</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.securityPromptSkip}
              onPress={handleSkipSecuritySetup}
            >
              <Text style={[styles.securityPromptSkipText, { color: colors.textSecondary }]}>
                Maybe Later
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {showProfileCompletion && user ? (
        <ProfileCompletionScreen user={user} onComplete={handleProfileComplete} />
      ) : shouldShowLockScreen ? (
        <LockScreen onUnlock={handleUnlock} />
      ) : shouldShowOnboarding ? (
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
          {!isEmployee && (
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
      <PopupProvider>
        <ErrorBoundary>
          <AppContent />
        </ErrorBoundary>
      </PopupProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  offlineBannerWrap: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 16,
    left: 12,
    right: 12,
    zIndex: 1000,
  },
  offlineBanner: {
    backgroundColor: '#f59e0b',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  offlineBannerText: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingLogo: {
    width: 120,
    height: 120,
    marginBottom: 20,
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
  // Security setup prompt styles
  securityPromptOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  securityPromptCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  securityPromptIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  securityPromptTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  securityPromptSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 28,
  },
  securityPromptButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  securityPromptButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  securityPromptSkip: {
    paddingVertical: 12,
  },
  securityPromptSkipText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
