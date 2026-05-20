import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Building2, ChevronRight, Users, UserPlus, QrCode, Copy, RefreshCw, X as CloseIcon, CreditCard, Shield, Info, LogOut, Mail, Phone, Globe, Clock, AlertCircle, Check, Lock, Fingerprint, Smartphone, CheckCircle, Hash } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { storage } from '../services/storage';
import { installationService } from '../services/installation';
import { authAPI, employeeAPI, packageAPI, clustersAPI } from '../services/api';
import { Modal } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import PaymentModal from '../components/PaymentModal';
import { securityService } from '../services/securityService';
import PINSetupScreen from './PINSetupScreen';
import { getDisplayName, getUserInitials } from '../utils/userUtils';
import { useTranslation } from 'react-i18next';
import i18n, { changeAppLanguage, getCurrentAppLanguage } from '../i18n';
import { AppLanguage } from '../i18n/resources';

interface Props {
  apiKey?: string | null;
  onLogout: () => void;
  onNavigateToBanks?: () => void;
  onNavigateToClusterDetails?: () => void;
  onNavigateToClusterGuide?: () => void;
}

interface UserPackage {
  id: string;
  status: string;
  startsAt: string;
  endsAt?: string | null;
  phoneTxnsRemaining: number | null;
  verifiedTxnsRemaining: number | null;
  phoneTxnsUsed: number;
  verifiedTxnsUsed: number;
  package: {
    id: string;
    name: string;
    tier: string | null;
    maxPhoneTxns: number | null;
    maxVerifiedTxns: number | null;
    price: number | null;
    description?: string | null;
  };
}

interface Package {
  id: string;
  name: string;
  tier: string | null;
  maxPhoneTxns: number | null;
  maxVerifiedTxns: number | null;
  price: number | null;
  description?: string | null;
  billingCycle?: string | null;
}

interface PurchaseRequest {
  id: string;
  packageId: string;
  transactionNumber: string;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  adminNotes?: string;
  createdAt: string;
  package: {
    id: string;
    name: string;
    price: number;
    tier?: string;
    billingCycle?: string;
  };
}

const PROFILE_CACHE_TTL_MS = 10 * 60 * 1000;
const PACKAGE_USAGE_CACHE_TTL_MS = 10 * 60 * 1000;

export default function ProfileScreen({ apiKey, onLogout, onNavigateToBanks, onNavigateToClusterDetails, onNavigateToClusterGuide }: Props) {
  const { t } = useTranslation();
  const { colors, theme, toggleTheme } = useTheme();
  const [user, setUser] = useState<any>(null);
  const [installationDate, setInstallationDate] = useState<Date | null>(null);
  const [plan, setPlan] = useState<'FREE' | 'PREMIUM'>('FREE');
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [employeeOTP, setEmployeeOTP] = useState('');
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [generatingOTP, setGeneratingOTP] = useState(false);
  const [currentPackage, setCurrentPackage] = useState<UserPackage | null>(null);
  const [billingMode, setBillingMode] = useState<'COUNT_BASED' | 'FIXED_PRICE'>('COUNT_BASED');
  const [availablePackages, setAvailablePackages] = useState<Package[]>([]);
  const [pendingPurchases, setPendingPurchases] = useState<PurchaseRequest[]>([]);
  const [loadingPackage, setLoadingPackage] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  // Security state
  const [pinEnabled, setPinEnabled] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricName, setBiometricName] = useState('Biometrics');
  const [showPINSetup, setShowPINSetup] = useState(false);
  const [isChangingPIN, setIsChangingPIN] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<AppLanguage>(getCurrentAppLanguage());
  const [clusterIncoming, setClusterIncoming] = useState<any[]>([]);
  const [clusterOutgoing, setClusterOutgoing] = useState<any[]>([]);
  const [loadingCluster, setLoadingCluster] = useState(false);

  const [isUpgradeCollapsed, setIsUpgradeCollapsed] = useState(true);

  const isBusinessOwner = user?.role === 'BUSINESS_OWNER' || user?.role === 'DEVELOPER';
  const canViewIncomingClusterRequests = user?.role === 'BUSINESS_OWNER' || user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const canViewOutgoingClusterRequests = user?.role === 'DEVELOPER';
  const ownerIdentifier = user?.ownerCode || user?.ownerId || null;

  useEffect(() => {
    loadProfile();
    loadPackageInfo();
    loadSecuritySettings();
  }, []);

  useEffect(() => {
    const onLanguageChanged = (lng: string) => {
      setSelectedLanguage((lng || 'en').split(/[-_]/)[0] as AppLanguage);
    };

    i18n.on('languageChanged', onLanguageChanged);
    return () => {
      i18n.off('languageChanged', onLanguageChanged);
    };
  }, []);

  const getLanguageLabel = (code: AppLanguage) => {
    switch (code) {
      case 'am':
        return t('language.amharic');
      case 'om':
        return t('language.afaanOromo');
      case 'ti':
        return t('language.tigrinya');
      default:
        return t('language.english');
    }
  };

  const handleLanguagePicker = () => {
    Alert.alert(t('profile.language'), t('common.selectLanguage'), [
      {
        text: t('language.english'),
        onPress: async () => {
          await changeAppLanguage('en');
          setSelectedLanguage('en');
        },
      },
      {
        text: t('language.amharic'),
        onPress: async () => {
          await changeAppLanguage('am');
          setSelectedLanguage('am');
        },
      },
      {
        text: t('language.afaanOromo'),
        onPress: async () => {
          await changeAppLanguage('om');
          setSelectedLanguage('om');
        },
      },
      {
        text: t('language.tigrinya'),
        onPress: async () => {
          await changeAppLanguage('ti');
          setSelectedLanguage('ti');
        },
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  useEffect(() => {
    loadClusterData(user?.role);
  }, [user?.role]);

  const loadClusterData = async (role?: string) => {
    if (!role) {
      setClusterIncoming([]);
      setClusterOutgoing([]);
      setLoadingCluster(false);
      return;
    }

    const canLoadIncoming = role === 'BUSINESS_OWNER' || role === 'ADMIN' || role === 'SUPER_ADMIN';
    const canLoadOutgoing = role === 'DEVELOPER';

    // Do not call role-restricted endpoints for roles that cannot access them.
    if (!canLoadIncoming && !canLoadOutgoing) {
      setClusterIncoming([]);
      setClusterOutgoing([]);
      setLoadingCluster(false);
      return;
    }

    setLoadingCluster(true);
    try {
      const [incomingRes, outgoingRes] = await Promise.all([
        canLoadIncoming
          ? clustersAPI.getIncomingRequests().catch(() => ({ success: false, data: [] }))
          : Promise.resolve({ success: true, data: [] }),
        canLoadOutgoing
          ? clustersAPI.getOutgoingRequests().catch(() => ({ success: false, data: [] }))
          : Promise.resolve({ success: true, data: [] }),
      ]);

      setClusterIncoming(incomingRes.success && Array.isArray(incomingRes.data) ? incomingRes.data : []);
      setClusterOutgoing(outgoingRes.success && Array.isArray(outgoingRes.data) ? outgoingRes.data : []);
    } catch (error) {
      console.error('Error loading cluster requests:', error);
    } finally {
      setLoadingCluster(false);
    }
  };

  const handleClusterAction = async (action: 'accept' | 'reject' | 'cancel', id: string) => {
    try {
      if (action === 'accept') {
        await clustersAPI.acceptRequest(id);
      } else if (action === 'reject') {
        await clustersAPI.rejectRequest(id);
      } else {
        await clustersAPI.cancelRequest(id);
      }

      await loadClusterData();
      Alert.alert(t('common.success'), t('cluster.requestActioned', { action }));
    } catch (error: any) {
      Alert.alert(t('common.error'), error?.response?.data?.error || t('cluster.failedRequestAction', { action }));
    }
  };

  const loadSecuritySettings = async () => {
    try {
      const [pinStatus, bioStatus, bioInfo] = await Promise.all([
        securityService.isPINEnabled(),
        securityService.isBiometricEnabled(),
        securityService.getBiometricInfo(),
      ]);
      setPinEnabled(pinStatus);
      setBiometricEnabled(bioStatus);
      setBiometricAvailable(bioInfo.isAvailable && bioInfo.hasEnrolledBiometrics);
      setBiometricName(securityService.getBiometricTypeName(bioInfo.biometricTypes));
    } catch (error) {
      console.error('Error loading security settings:', error);
    }
  };

  const handleTogglePIN = async (value: boolean) => {
    if (value) {
      // Enable PIN - show PIN setup
      setIsChangingPIN(false);
      setShowPINSetup(true);
    } else {
      // Disable PIN - confirm first
      Alert.alert(
        t('profile.disablePinTitle', { defaultValue: 'Disable PIN' }),
        t('profile.disablePinMessage', { defaultValue: 'Are you sure you want to disable the PIN lock? This will also disable biometric unlock.' }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('profile.disable', { defaultValue: 'Disable' }),
            style: 'destructive',
            onPress: async () => {
              await securityService.disablePIN();
              setPinEnabled(false);
              setBiometricEnabled(false);
            },
          },
        ]
      );
    }
  };

  const handleToggleBiometric = async (value: boolean) => {
    if (value) {
      try {
        await securityService.enableBiometric();
        setBiometricEnabled(true);
        Alert.alert(t('common.success'), t('profile.biometricEnabledMessage', { biometricName, defaultValue: `${biometricName} has been enabled for quick unlock.` }));
      } catch (error: any) {
        Alert.alert(t('common.error'), error.message || t('profile.failedEnableBiometric', { defaultValue: 'Failed to enable biometric' }));
      }
    } else {
      await securityService.disableBiometric();
      setBiometricEnabled(false);
    }
  };

  const handleChangePIN = () => {
    setIsChangingPIN(true);
    setShowPINSetup(true);
  };

  const handlePINSetupComplete = () => {
    setShowPINSetup(false);
    setPinEnabled(true);
    loadSecuritySettings();
  };

  const loadPackageInfo = async () => {
    let usedCachedData = false;

    try {
      setLoadingPackage(true);

      const cachedPackageUsage = await storage.getPackageUsageCache();
      if (
        cachedPackageUsage.currentPackage ||
        cachedPackageUsage.availablePackages.length > 0 ||
        cachedPackageUsage.pendingPurchases.length > 0
      ) {
        usedCachedData = true;
        setCurrentPackage(cachedPackageUsage.currentPackage);
        setAvailablePackages(cachedPackageUsage.availablePackages);
        setPendingPurchases(cachedPackageUsage.pendingPurchases);
        setLoadingPackage(false);
      }

      const cacheIsFresh = Date.now() - cachedPackageUsage.lastSyncAt < PACKAGE_USAGE_CACHE_TTL_MS;
      if (cacheIsFresh && usedCachedData) {
        return;
      }

      const [myPackageRes, packagesRes, purchasesRes, billingModeRes] = await Promise.all([
        packageAPI.getMyPackage().catch(() => ({ success: false, data: null })),
        packageAPI.getPackages(),
        packageAPI.getMyPurchases().catch(() => ({ success: false, data: [] })),
        packageAPI.getBillingMode().catch(() => ({ success: true, data: { billingMode: 'COUNT_BASED' } })),
      ]);

      const mode = billingModeRes?.data?.billingMode || packagesRes?.meta?.billingMode || 'COUNT_BASED';
      setBillingMode(mode);

      let nextCurrentPackage: UserPackage | null = null;
      let nextAvailablePackages: Package[] = [];
      let nextPendingPurchases: PurchaseRequest[] = [];

      if (myPackageRes.success && myPackageRes.data) {
        nextCurrentPackage = myPackageRes.data;
        setCurrentPackage(nextCurrentPackage);
      }

      if (packagesRes.success) {
        const businessPackages = packagesRes.data.filter((p: Package) => {
          if (!(p.tier === 'BUSINESS' && p.price && p.price > 0)) {
            return false;
          }

          if (mode === 'FIXED_PRICE') {
            return ['MONTHLY', 'SIX_MONTH', 'YEARLY'].includes(p.billingCycle || '');
          }

          return p.maxPhoneTxns !== undefined || p.maxVerifiedTxns !== undefined;
        });
        nextAvailablePackages = businessPackages;
        setAvailablePackages(nextAvailablePackages);
      }

      if (purchasesRes.success) {
        // Show pending purchases
        const pending = purchasesRes.data.filter(
          (p: PurchaseRequest) => p.status === 'PENDING'
        );
        nextPendingPurchases = pending;
        setPendingPurchases(nextPendingPurchases);
      }

      await storage.setPackageUsageCache({
        currentPackage: nextCurrentPackage,
        availablePackages: nextAvailablePackages,
        pendingPurchases: nextPendingPurchases,
        lastSyncAt: Date.now(),
      });
    } catch (error) {
      console.error('Error loading package info:', error);
    } finally {
      setLoadingPackage(false);
    }
  };

  const handleSelectPackage = (pkg: Package) => {
    // Check if there's already a pending purchase for this package
    const hasPending = pendingPurchases.some(p => p.packageId === pkg.id);
    if (hasPending) {
      Alert.alert(
        t('profile.pendingPurchaseTitle', { defaultValue: 'Pending Purchase' }),
        t('profile.pendingPurchaseMessage', { defaultValue: 'You already have a pending purchase request for this package. Please wait for admin verification.' }),
        [{ text: t('common.done') }]
      );
      return;
    }

    // Check if it's the current package
    if (currentPackage?.package.id === pkg.id) {
      Alert.alert(t('profile.currentPackageTitle', { defaultValue: 'Current Package' }), t('profile.currentPackageMessage', { defaultValue: 'This is your current package.' }));
      return;
    }

    setSelectedPackage(pkg);
    setShowPaymentModal(true);
  };

  const handlePurchaseSubmit = async (payload: { transactionNumber: string; channel: string; screenshotUrl?: string }) => {
    if (!selectedPackage) return;

    setPurchasing(true);
    try {
      const response = await packageAPI.purchasePackage({
        packageId: selectedPackage.id,
        transactionNumber: payload.transactionNumber,
        channel: payload.channel,
        screenshotUrl: payload.screenshotUrl,
      });

      if (response.success) {
        setShowPaymentModal(false);
        setSelectedPackage(null);
        Alert.alert(
          t('profile.purchaseSubmittedTitle', { defaultValue: 'Request Submitted!' }), 
          t('profile.purchaseSubmittedMessage', { defaultValue: 'Your purchase request has been submitted. Your package will be activated once the transaction is verified by admin.' }),
          [{ text: t('common.done') }]
        );
        loadPackageInfo(); // Refresh to show the pending purchase
      } else {
        throw new Error(response.error || 'Failed to submit purchase request');
      }
    } catch (error: any) {
      console.error('Purchase error:', error);
      Alert.alert('Error', error.response?.data?.error || error.message || 'Failed to submit purchase request');
    } finally {
      setPurchasing(false);
    }
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return t('profile.never', { defaultValue: 'Never' });
    return new Date(dateString).toLocaleDateString();
  };

  const getRemainingPercentage = (remaining: number | null, max: number | null) => {
    if (remaining === null || max === null || max === 0) return 100;
    return Math.round((remaining / max) * 100);
  };

  const isFixedPriceMode = billingMode === 'FIXED_PRICE';

  const loadProfile = async () => {
    try {
      // First load from storage for immediate display
      const storedUser = await storage.getUser();
      setUser(storedUser);
      if (storedUser?.plan) {
        setPlan(storedUser.plan);
      }
      
      // Then fetch fresh data from backend
      const token = await storage.getToken();
      if (token) {
        const lastSyncAtRaw = await storage.getItem('profile_last_sync_at');
        const lastSyncAt = lastSyncAtRaw ? parseInt(lastSyncAtRaw, 10) || 0 : 0;
        const cacheIsFresh = Date.now() - lastSyncAt < PROFILE_CACHE_TTL_MS;

        if (cacheIsFresh && storedUser) {
          const date = await installationService.getInstallationDate();
          setInstallationDate(date);
          return;
        }

        try {
          const response = await authAPI.getMe();
          if (response.success) {
            // Robustly extract user data
            const freshUser = response.data || response.user || (response.id ? response : null);
            
            if (freshUser) {
              // Merge fresh data with stored user, preserving name fields if API doesn't return them
              const mergedUser = {
                ...storedUser,  // Start with stored user data
                ...freshUser,   // Override with fresh data from API
                // Preserve name fields from stored user if fresh data doesn't have them
                username: freshUser.username || storedUser?.username,
                firstName: freshUser.firstName || freshUser.first_name || storedUser?.firstName,
                lastName: freshUser.lastName || freshUser.last_name || storedUser?.lastName,
                phone: freshUser.phone || storedUser?.phone,
                email: freshUser.email || storedUser?.email,
              };
              
              console.log('✅ [Profile] Merged user data:', JSON.stringify(mergedUser, null, 2));
              
              setUser(mergedUser);
              if (mergedUser.plan) {
                setPlan(mergedUser.plan);
              }
              // Update stored user with merged data
              await storage.setUser(mergedUser);
              await storage.setItem('profile_last_sync_at', String(Date.now()));
              console.log('✅ [Profile] Loaded and merged fresh user data from backend');
            }
          }
        } catch (error) {
          console.error('Error fetching user data from backend:', error);
          // Continue with stored user data
        }
      }
      
      const date = await installationService.getInstallationDate();
      setInstallationDate(date);
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const handleAddEmployee = async () => {
    setGeneratingOTP(true);
    try {
      const businessId = await storage.getBusinessId();
      if (!businessId) {
        Alert.alert(t('common.error'), t('profile.noBusinessError', { defaultValue: 'No business associated with this account' }));
        return;
      }
      const response = await employeeAPI.generateCode(businessId);
      if (response.success && response.data?.code) {
        setBusinessId(businessId);
        setEmployeeOTP(response.data.code);
        setShowAddEmployeeModal(true);
      } else {
        Alert.alert(t('common.error'), t('profile.failedGenerateCode', { defaultValue: 'Failed to generate access code' }));
      }
    } catch (error) {
      console.error('Error generating employee code:', error);
      Alert.alert(t('common.error'), t('profile.failedGenerateCode', { defaultValue: 'Failed to generate access code' }));
    } finally {
      setGeneratingOTP(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      t('profile.logoutConfirmTitle'),
      t('profile.logoutConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.logout'),
          style: 'destructive',
          onPress: onLogout,
        },
      ]
    );
  };

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Professional Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.profileHeader}>
          <View style={[styles.avatar, { backgroundColor: colors.primary + '10' }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {getUserInitials(user)}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.name, { color: colors.text }]}>
              {getDisplayName(user)}
            </Text>
            <View style={styles.badgeRow}>
              <View style={[styles.roleBadge, { backgroundColor: colors.primary + '10' }]}>
                <Text style={[styles.roleBadgeText, { color: colors.primary }]}>
                  {user?.role?.replace('_', ' ') || 'USER'}
                </Text>
              </View>
              {plan === 'PREMIUM' && (
                <View style={[styles.premiumBadge, { backgroundColor: '#f59e0b10' }]}>
                  <Text style={[styles.premiumBadgeText, { color: '#f59e0b' }]}>PREMIUM</Text>
                </View>
              )}
            </View>
          </View>
          {ownerIdentifier ? (
            <View style={[styles.ownerIdBadge, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '30' }]}>
              <Hash size={13} color={colors.primary} />
              <Text style={[styles.ownerIdText, { color: colors.primary }]}>{ownerIdentifier}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.content}>
        {/* Account Section */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{t('profile.account')}</Text>
        <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.listItem}>
            <View style={styles.listItemLeft}>
              <Text style={[styles.listItemText, { color: colors.text }]}>{t('profile.phoneNumber')}</Text>
            </View>
            <Text style={[styles.listItemValue, { color: colors.textSecondary }]}>{user?.phone || t('profile.notSet')}</Text>
          </View>
          <View style={[styles.listDivider, { backgroundColor: colors.border }]} />
          <View style={styles.listItem}>
            <View style={styles.listItemLeft}>
              <Globe size={18} color={colors.textSecondary} />
              <Text style={[styles.listItemText, { color: colors.text }]}>{t('profile.country')}</Text>
            </View>
            <Text style={[styles.listItemValue, { color: colors.textSecondary }]}>{user?.country || t('profile.notSet')}</Text>
          </View>
          {(user?.role === 'BUSINESS_OWNER' || user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
            <>
              <View style={[styles.listDivider, { backgroundColor: colors.border }]} />
              <View style={styles.listItem}>
                <View style={styles.listItemLeft}>
                  <Shield size={18} color={colors.textSecondary} />
                  <Text style={[styles.listItemText, { color: colors.text }]}>{t('profile.ownerId')}</Text>
                </View>
                <Text style={[styles.listItemValue, { color: colors.primary }]}>{ownerIdentifier || t('profile.notAssignedYet')}</Text>
              </View>
            </>
          )}
        </View>

        {/* Cluster Section - only show if there are active pending requests */}
        {(() => {
          const pendingIncoming = canViewIncomingClusterRequests ? clusterIncoming.filter((req: any) => req.status === 'PENDING') : [];
          const pendingOutgoing = canViewOutgoingClusterRequests ? clusterOutgoing.filter((req: any) => req.status === 'PENDING') : [];
          const hasActiveRequests = pendingIncoming.length > 0 || pendingOutgoing.length > 0;
          if (!hasActiveRequests && !loadingCluster) return null;
          return (
            <>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{t('profile.cluster')}</Text>
              <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {loadingCluster ? (
                  <View style={styles.noPackageContainer}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                ) : (
                  <>
                    {pendingIncoming.slice(0, 3).map((req: any) => (
                      <View key={req.id} style={styles.clusterItemRow}>
                        <View style={styles.clusterItemInfo}>
                          <Text style={[styles.clusterTitle, { color: colors.text }]}>{t('profile.incomingFrom', { name: req.developer?.username || t('employee.unknown') })}</Text>
                          <Text style={[styles.clusterSub, { color: colors.textSecondary }]}>{req.project?.name || t('profile.noProjectLinked')}</Text>
                        </View>
                        <View style={styles.clusterActionsRow}>
                          <TouchableOpacity onPress={() => handleClusterAction('accept', req.id)}>
                            <Text style={[styles.clusterActionText, { color: '#16a34a' }]}>{t('common.accept', { defaultValue: 'Accept' })}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleClusterAction('reject', req.id)}>
                            <Text style={[styles.clusterActionText, { color: '#dc2626' }]}>{t('common.reject', { defaultValue: 'Reject' })}</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}

                    {pendingOutgoing.slice(0, 3).map((req: any) => (
                      <View key={req.id} style={styles.clusterItemRow}>
                        <View style={styles.clusterItemInfo}>
                          <Text style={[styles.clusterTitle, { color: colors.text }]}>{t('profile.pendingTo', { code: req.ownerCode })}</Text>
                          <Text style={[styles.clusterSub, { color: colors.textSecondary }]}>{req.project?.name || t('profile.noProjectLinked')}</Text>
                        </View>
                        <View style={styles.clusterActionsRow}>
                          <TouchableOpacity onPress={() => handleClusterAction('cancel', req.id)}>
                            <Text style={[styles.clusterActionText, { color: '#dc2626' }]}>{t('common.cancel')}</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}

                    <View style={[styles.listDivider, { backgroundColor: colors.border }]} />
                    <TouchableOpacity style={styles.clusterDetailsRow} onPress={onNavigateToClusterDetails}>
                      <View style={styles.listItemLeft}>
                        <Users size={18} color={colors.textSecondary} />
                        <Text style={[styles.listItemText, { color: colors.text }]}>{t('profile.viewFullCluster')}</Text>
                      </View>
                      <ChevronRight size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </>
          );
        })()}

        {/* Package & Usage Section */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{t('profile.packageAndUsage')}</Text>
        <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {loadingPackage ? (
            <View style={styles.packageSkeletonContainer}>
              <View style={[styles.skeletonLineLg, { backgroundColor: colors.border }]} />
              <View style={[styles.skeletonLineMd, { backgroundColor: colors.border }]} />
              <View style={[styles.skeletonBarTrack, { backgroundColor: colors.border }]}>
                <View style={[styles.skeletonBarFill, { backgroundColor: colors.primary + '55' }]} />
              </View>
              <View style={[styles.skeletonLineSm, { backgroundColor: colors.border }]} />
              <View style={[styles.skeletonBarTrack, { backgroundColor: colors.border }]}>
                <View style={[styles.skeletonBarFillAlt, { backgroundColor: colors.primary + '33' }]} />
              </View>
            </View>
          ) : currentPackage ? (
            <>
              {/* Plan Header */}
              <View style={styles.packageHeader}>
                <View style={styles.packageHeaderLeft}>
                  <Text style={[styles.packageName, { color: colors.text }]}>
                    {currentPackage.package.name}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <Text style={[styles.packageTier, { color: colors.textSecondary }]}>
                      {currentPackage.package.tier || 'Standard'}
                    </Text>
                    <View style={[styles.activeStatusDot, { backgroundColor: '#22C55E' }]} />
                    <Text style={{ fontSize: 11, color: '#22C55E', fontWeight: '600' }}>
                      {currentPackage.status || t('employeeManagement.active')}
                    </Text>
                  </View>
                </View>
                {currentPackage.package.tier === 'BUSINESS' && (
                  <View style={[styles.badge, { backgroundColor: colors.primary + '15' }]}>
                    <CreditCard size={12} color={colors.primary} style={{ marginRight: 4 }} />
                    <Text style={[styles.badgeText, { color: colors.primary }]}>BUSINESS</Text>
                  </View>
                )}
              </View>

              {currentPackage.endsAt && (
                <View style={[styles.packageInfoRow, { borderTopColor: colors.border }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Clock size={13} color={colors.textSecondary} />
                    <Text style={[styles.packageInfoLabel, { color: colors.textSecondary }]}>{t('profile.expires')}</Text>
                  </View>
                  <Text style={[styles.packageInfoValue, { color: colors.text }]}>
                    {formatDate(currentPackage.endsAt)}
                  </Text>
                </View>
              )}

              {/* Usage Stats */}
              {isFixedPriceMode ? (
                <View style={[styles.usageItem, { borderTopColor: colors.border }]}> 
                  <View style={styles.usageHeader}>
                    <Text style={[styles.usageLabel, { color: colors.text }]}>{t('profile.usage')}</Text>
                    <View style={[styles.unlimitedBadge, { backgroundColor: '#22C55E15' }]}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#22C55E' }}>∞ {t('profile.unlimited')}</Text>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.usageStatsGrid}>
                  {/* Phone Transactions Card */}
                  <View style={[styles.usageStatCard, { backgroundColor: colors.background, borderColor: colors.border }]}> 
                    <View style={styles.usageStatCardHeader}>
                      <View style={[styles.usageStatIcon, { backgroundColor: colors.primary + '12' }]}>
                        <Smartphone size={14} color={colors.primary} />
                      </View>
                      <Text style={[styles.usageStatLabel, { color: colors.textSecondary }]}>{t('profile.phoneTxns')}</Text>
                    </View>
                    <Text style={[styles.usageStatValue, { color: colors.text }]}>
                      {currentPackage.phoneTxnsRemaining === null
                        ? '∞'
                        : currentPackage.phoneTxnsRemaining}
                    </Text>
                    {currentPackage.phoneTxnsRemaining !== null && currentPackage.package.maxPhoneTxns ? (
                      <>
                        <View style={[styles.progressBar, { backgroundColor: colors.border }]}> 
                          <View
                            style={[
                              styles.progressFill,
                              {
                                width: `${getRemainingPercentage(
                                  currentPackage.phoneTxnsRemaining,
                                  currentPackage.package.maxPhoneTxns
                                )}%`,
                                backgroundColor: getRemainingPercentage(currentPackage.phoneTxnsRemaining, currentPackage.package.maxPhoneTxns) > 30 ? colors.primary : '#EF4444',
                              },
                            ]}
                          />
                        </View>
                        <Text style={[styles.usageStatSub, { color: colors.textSecondary }]}>
                          {currentPackage.phoneTxnsRemaining} {t('common.of', { defaultValue: 'of' })} {currentPackage.package.maxPhoneTxns} {t('profile.remaining')}
                        </Text>
                      </>
                    ) : (
                      <Text style={[styles.usageStatSub, { color: '#22C55E' }]}>Unlimited</Text>
                    )}
                  </View>

                  {/* Verified Transactions Card */}
                  <View style={[styles.usageStatCard, { backgroundColor: colors.background, borderColor: colors.border }]}> 
                    <View style={styles.usageStatCardHeader}>
                      <View style={[styles.usageStatIcon, { backgroundColor: '#8B5CF612' }]}>
                        <CheckCircle size={14} color="#8B5CF6" />
                      </View>
                      <Text style={[styles.usageStatLabel, { color: colors.textSecondary }]}>{t('profile.verifiedTxns')}</Text>
                    </View>
                    <Text style={[styles.usageStatValue, { color: colors.text }]}>
                      {currentPackage.verifiedTxnsRemaining === null
                        ? '∞'
                        : currentPackage.verifiedTxnsRemaining}
                    </Text>
                    {currentPackage.verifiedTxnsRemaining !== null && currentPackage.package.maxVerifiedTxns ? (
                      <>
                        <View style={[styles.progressBar, { backgroundColor: colors.border }]}> 
                          <View
                            style={[
                              styles.progressFill,
                              {
                                width: `${getRemainingPercentage(
                                  currentPackage.verifiedTxnsRemaining,
                                  currentPackage.package.maxVerifiedTxns
                                )}%`,
                                backgroundColor: getRemainingPercentage(currentPackage.verifiedTxnsRemaining, currentPackage.package.maxVerifiedTxns) > 30 ? '#8B5CF6' : '#EF4444',
                              },
                            ]}
                          />
                        </View>
                        <Text style={[styles.usageStatSub, { color: colors.textSecondary }]}>
                          {currentPackage.verifiedTxnsRemaining} {t('common.of', { defaultValue: 'of' })} {currentPackage.package.maxVerifiedTxns} {t('profile.remaining')}
                        </Text>
                      </>
                    ) : (
                      <Text style={[styles.usageStatSub, { color: '#22C55E' }]}>Unlimited</Text>
                    )}
                  </View>
                </View>
              )}
            </>
          ) : (
            <View style={styles.noPackageContainer}>
              <Text style={[styles.noPackageText, { color: colors.textSecondary }]}>
                {t('profile.noActivePackage')}
              </Text>
            </View>
          )}

          {/* Pending Purchases */}
          {pendingPurchases.length > 0 && (
            <View style={[styles.pendingSection, { borderTopColor: colors.border }]}>
              <View style={styles.pendingHeader}>
                <Clock size={16} color="#f59e0b" />
                <Text style={styles.pendingSectionTitle}>{t('profile.pendingVerification')}</Text>
              </View>
              {pendingPurchases.map((purchase) => (
                <View key={purchase.id} style={[styles.pendingItem, { borderBottomColor: 'rgba(245, 158, 11, 0.2)' }]}>
                  <View style={styles.pendingInfo}>
                    <Text style={[styles.pendingPackageName, { color: colors.text }]}>
                      {purchase.package.name}
                    </Text>
                    <Text style={[styles.pendingTxn, { color: colors.textSecondary }]}>
                      Txn: {purchase.transactionNumber}
                    </Text>
                  </View>
                  <View style={styles.pendingBadge}>
                    <AlertCircle size={12} color="#f59e0b" />
                    <Text style={styles.pendingBadgeText}>{t('profile.awaiting')}</Text>
                  </View>
                </View>
              ))}
              <Text style={[styles.pendingNote, { color: colors.textSecondary }]}>
                {t('profile.adminVerificationNote')}
              </Text>
            </View>
          )}

          {/* Available Packages */}
          {availablePackages.length > 0 && (
            <View style={[styles.availablePackagesContainer, { borderTopColor: colors.border }]}>
              <TouchableOpacity 
                style={styles.collapsableHeader} 
                onPress={() => setIsUpgradeCollapsed(!isUpgradeCollapsed)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.availablePackagesTitle, { color: colors.text }]}>{t('profile.upgradePackage')}</Text>
                  <Text style={[styles.availablePackagesSubtitle, { color: colors.textSecondary }]}>
                    {t('profile.upgradePackageSubtitle')}
                  </Text>
                </View>
                <ChevronRight 
                  size={20} 
                  color={colors.textSecondary} 
                  style={{ transform: [{ rotate: isUpgradeCollapsed ? '0deg' : '90deg' }] }} 
                />
              </TouchableOpacity>

              {!isUpgradeCollapsed && availablePackages.map((pkg, index) => {
                const isPending = pendingPurchases.some(p => p.packageId === pkg.id);
                const isCurrent = currentPackage?.package.id === pkg.id;
                const isPopular = pkg.name.toLowerCase().includes('pro') || pkg.name.toLowerCase().includes('business') || index === 1;
                
                return (
                  <TouchableOpacity
                    key={pkg.id}
                    style={[
                      styles.packageOption,
                      {
                        backgroundColor: colors.background,
                        borderColor: isCurrent ? colors.primary : isPending ? '#f59e0b' : colors.border,
                        borderWidth: isCurrent ? 2 : 1,
                      },
                    ]}
                    onPress={() => handleSelectPackage(pkg)}
                    disabled={isCurrent}
                    activeOpacity={0.8}
                  >
                    {isPopular && (
                      <View style={[styles.popularBadge, { backgroundColor: colors.primary }]}>
                        <Text style={styles.popularBadgeText}>{t('profile.mostPopular')}</Text>
                      </View>
                    )}

                    <View style={styles.packageOptionHeader}>
                      <View style={styles.packageOptionTitleSection}>
                        <Text style={[styles.packageOptionName, { color: colors.text }]}>
                          {pkg.name}
                        </Text>
                        <Text style={[styles.packageOptionTier, { color: colors.textSecondary }]}>
                          {pkg.tier} {t('profile.tier')}
                        </Text>
                      </View>
                      <View style={styles.packageOptionPriceSection}>
                        <Text style={[styles.packageOptionPrice, { color: colors.text }]}>
                          ${pkg.price}
                        </Text>
                        <Text style={[styles.packageOptionPeriod, { color: colors.textSecondary }]}>
                          /{pkg.billingCycle?.toLowerCase().replace('_', ' ') || 'mo'}
                        </Text>
                      </View>
                    </View>

                    <View style={[styles.packageOptionDivider, { backgroundColor: colors.border }]} />

                    <View style={styles.packageOptionFeatures}>
                      {isFixedPriceMode ? (
                        <View style={styles.featureItem}>
                          <Check size={14} color={colors.primary} />
                          <Text style={[styles.featureText, { color: colors.textSecondary }]}>{t('profile.unlimitedTransactions')}</Text>
                        </View>
                      ) : (
                        <>
                          <View style={styles.featureItem}>
                            <Check size={14} color={colors.primary} />
                            <Text style={[styles.featureText, { color: colors.textSecondary }]}> 
                              <Text style={{ color: colors.text, fontWeight: '600' }}>
                                {pkg.maxPhoneTxns === null ? t('profile.unlimited') : pkg.maxPhoneTxns}
                              </Text> {t('profile.phoneTxnsLabel')}
                            </Text>
                          </View>
                          <View style={styles.featureItem}>
                            <Check size={14} color={colors.primary} />
                            <Text style={[styles.featureText, { color: colors.textSecondary }]}> 
                              <Text style={{ color: colors.text, fontWeight: '600' }}>
                                {pkg.maxVerifiedTxns === null ? t('profile.unlimited') : pkg.maxVerifiedTxns}
                              </Text> {t('profile.verifiedTxnsLabel')}
                            </Text>
                          </View>
                        </>
                      )}
                    </View>

                    <View style={styles.packageOptionFooter}>
                      {isCurrent ? (
                        <View style={[styles.statusBadge, { backgroundColor: colors.primary + '15' }]}>
                          <Check size={12} color={colors.primary} />
                          <Text style={[styles.statusBadgeText, { color: colors.primary }]}>{t('profile.currentPlan')}</Text>
                        </View>
                      ) : isPending ? (
                        <View style={[styles.statusBadge, { backgroundColor: '#f59e0b15' }]}>
                          <Clock size={12} color="#f59e0b" />
                          <Text style={[styles.statusBadgeText, { color: '#f59e0b' }]}>{t('common.pending', { defaultValue: 'Pending' })}</Text>
                        </View>
                      ) : (
                        <Text style={[styles.selectActionText, { color: colors.primary }]}>
                          {t('profile.upgradeNow')}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Business Section */}
        {isBusinessOwner && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{t('profile.businessManagement')}</Text>
            <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TouchableOpacity 
                style={styles.listItem}
                onPress={onNavigateToBanks}
              >
                <View style={styles.listItemLeft}>
                  <Building2 size={18} color={colors.textSecondary} />
                  <Text style={[styles.listItemText, { color: colors.text }]}>{t('profile.linkedBanks')}</Text>
                </View>
                <ChevronRight size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              <View style={[styles.listDivider, { backgroundColor: colors.border }]} />
              <TouchableOpacity 
                style={styles.listItem}
                onPress={handleAddEmployee}
                disabled={generatingOTP}
              >
                <View style={styles.listItemLeft}>
                  <UserPlus size={18} color={colors.textSecondary} />
                  <Text style={[styles.listItemText, { color: colors.text }]}>{t('profile.addEmployee')}</Text>
                </View>
                {generatingOTP ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <ChevronRight size={18} color={colors.textSecondary} />
                )}
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Security Section */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{t('profile.security')}</Text>
        <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* App Lock Toggle */}
          <View style={styles.listItem}>
            <View style={styles.listItemLeft}>
              <Lock size={18} color={colors.primary} />
              <Text style={[styles.listItemText, { color: colors.text }]}>{t('profile.appLock')}</Text>
            </View>
            <Switch
              value={pinEnabled}
              onValueChange={handleTogglePIN}
              trackColor={{ false: '#767577', true: colors.primary }}
              thumbColor={pinEnabled ? '#fff' : '#f4f3f4'}
            />
          </View>

          {/* Biometric Toggle (only if PIN enabled and biometric available) */}
          {pinEnabled && biometricAvailable && (
            <>
              <View style={[styles.listDivider, { backgroundColor: colors.border }]} />
              <View style={styles.listItem}>
                <View style={styles.listItemLeft}>
                  <Fingerprint size={18} color={colors.primary} />
                  <Text style={[styles.listItemText, { color: colors.text }]}>{t('profile.biometricUnlock', { biometricName })}</Text>
                </View>
                <Switch
                  value={biometricEnabled}
                  onValueChange={handleToggleBiometric}
                  trackColor={{ false: '#767577', true: colors.primary }}
                  thumbColor={biometricEnabled ? '#fff' : '#f4f3f4'}
                />
              </View>
            </>
          )}

          {/* Change PIN Button (only if PIN enabled) */}
          {pinEnabled && (
            <>
              <View style={[styles.listDivider, { backgroundColor: colors.border }]} />
              <TouchableOpacity style={styles.listItem} onPress={handleChangePIN}>
                <View style={styles.listItemLeft}>
                  <Shield size={18} color={colors.textSecondary} />
                  <Text style={[styles.listItemText, { color: colors.text }]}>{t('profile.changePin')}</Text>
                </View>
                <ChevronRight size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Preferences Section */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{t('profile.preferences')}</Text>
        <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.listItem}>
            <View style={styles.listItemLeft}>
              <RefreshCw size={18} color={colors.textSecondary} />
              <Text style={[styles.listItemText, { color: colors.text }]}>{t('profile.darkMode')}</Text>
            </View>
            <Switch
              value={theme === 'dark'}
              onValueChange={toggleTheme}
              trackColor={{ false: '#767577', true: colors.primary }}
              thumbColor={theme === 'dark' ? '#fff' : '#f4f3f4'}
            />
          </View>
          <View style={[styles.listDivider, { backgroundColor: colors.border }]} />
          <TouchableOpacity style={styles.listItem} onPress={handleLanguagePicker}>
            <View style={styles.listItemLeft}>
              <Globe size={18} color={colors.textSecondary} />
              <Text style={[styles.listItemText, { color: colors.text }]}>{t('profile.language')}</Text>
            </View>
            <View style={styles.listItemRight}>
              <Text style={[styles.listItemValue, { color: colors.textSecondary }]}>
                {getLanguageLabel(selectedLanguage)}
              </Text>
              <ChevronRight size={18} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
          <View style={[styles.listDivider, { backgroundColor: colors.border }]} />
          <TouchableOpacity 
            style={styles.listItem}
            onPress={() =>
              plan === 'FREE' &&
              Alert.alert(t('profile.premiumComingSoonTitle'), t('profile.premiumComingSoonMessage'))
            }
          >
            <View style={styles.listItemLeft}>
              <CreditCard size={18} color={colors.textSecondary} />
              <Text style={[styles.listItemText, { color: colors.text }]}>{t('profile.subscription')}</Text>
            </View>
            <View style={styles.listItemRight}>
              <Text style={[styles.listItemValue, { color: plan === 'PREMIUM' ? colors.primary : colors.textSecondary }]}>
                {plan === 'PREMIUM' ? t('profile.premium') : t('profile.free')}
              </Text>
              <ChevronRight size={18} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* About Section */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{t('profile.about')}</Text>
        <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.listItem}>
            <View style={styles.listItemLeft}>
              <Info size={18} color={colors.textSecondary} />
              <Text style={[styles.listItemText, { color: colors.text }]}>{t('profile.version')}</Text>
            </View>
            <Text style={[styles.listItemValue, { color: colors.textSecondary }]}>1.0.0</Text>
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={handleLogout}
        >
          <LogOut size={18} color="#ef4444" />
          <Text style={styles.logoutButtonText}>{t('profile.logout')}</Text>
        </TouchableOpacity>

        <Text style={[styles.copyright, { color: colors.textSecondary }]}>
          {t('profile.copyright')}
        </Text>
      </View>

      {/* Add Employee Modal */}
      <Modal
        visible={showAddEmployeeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddEmployeeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background, height: 'auto', maxHeight: '80%', paddingBottom: 40 }]}>
            <View style={[styles.modalHeader, { borderBottomWidth: 0 }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t('employeeManagement.addNewEmployee')}</Text>
              <TouchableOpacity onPress={() => setShowAddEmployeeModal(false)}>
                <CloseIcon size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                {t('employeeManagement.shareCodeForRegister')}
              </Text>

              <View style={[styles.qrPlaceholder, { backgroundColor: '#fff', borderColor: colors.border }]}>
                {businessId && employeeOTP ? (
                  <QRCode
                    value={JSON.stringify({
                      businessId,
                      code: employeeOTP,
                      type: 'employee_registration',
                    })}
                    size={160}
                    color={colors.text}
                    backgroundColor="#fff"
                  />
                ) : (
                  <QrCode size={120} color={colors.primary} strokeWidth={1.5} />
                )}
                <Text style={[styles.qrHint, { color: colors.textSecondary }]}>{t('employeeManagement.employeeInviteQr')}</Text>
              </View>

              <View style={styles.otpContainer}>
                <Text style={[styles.otpLabel, { color: colors.textSecondary }]}>{t('employeeManagement.inviteCode')}</Text>
                <View style={[styles.otpBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.otpText, { color: colors.primary }]}>{employeeOTP}</Text>
                  <TouchableOpacity 
                    onPress={() => {
                      // Copy to clipboard logic would go here
                      Alert.alert(t('employeeManagement.copiedTitle'), t('employeeManagement.inviteCodeCopied'));
                    }}
                    style={styles.copyButton}
                  >
                    <Copy size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.doneButton, { backgroundColor: colors.primary }]}
                onPress={() => setShowAddEmployeeModal(false)}
              >
                <Text style={[styles.doneButtonText, { color: colors.primaryText }]}>{t('profile.done')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Payment Modal */}
      <PaymentModal
        visible={showPaymentModal}
        selectedPackage={selectedPackage}
        onSubmit={handlePurchaseSubmit}
        onClose={() => {
          setShowPaymentModal(false);
          setSelectedPackage(null);
        }}
        isSubmitting={purchasing}
      />

      {/* PIN Setup Modal */}
      <Modal
        visible={showPINSetup}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowPINSetup(false)}
      >
        <PINSetupScreen
          onComplete={handlePINSetupComplete}
          onCancel={() => setShowPINSetup(false)}
          isChangingPIN={isChangingPIN}
          showBiometricOption={biometricAvailable && !isChangingPIN}
        />
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  premiumBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  premiumBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  ownerIdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  ownerIdText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  activeStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  unlimitedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  usageStatsGrid: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    paddingTop: 4,
  },
  usageStatCard: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  usageStatCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  usageStatIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  usageStatLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  usageStatValue: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -1,
    marginBottom: 8,
  },
  usageStatSub: {
    fontSize: 10,
    marginTop: 6,
    fontWeight: '500',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 8,
    marginLeft: 4,
    letterSpacing: 1,
  },
  listCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  listItemText: {
    fontSize: 15,
    fontWeight: '500',
  },
  listItemValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  listItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  listDivider: {
    height: 1,
    marginHorizontal: 16,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 32,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  logoutButtonText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '600',
  },
  copyright: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: 32,
    opacity: 0.6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalBody: {
    alignItems: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  qrPlaceholder: {
    width: 180,
    height: 180,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  qrHint: {
    fontSize: 11,
    marginTop: 8,
    fontWeight: '600',
  },
  otpContainer: {
    width: '100%',
    marginBottom: 24,
  },
  otpLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  otpBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  otpText: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 4,
    flex: 1,
    textAlign: 'center',
    marginLeft: 32,
  },
  copyButton: {
    padding: 6,
  },
  doneButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  // Package Usage Styles
  packageSkeletonContainer: {
    padding: 16,
    gap: 12,
  },
  skeletonLineLg: {
    height: 18,
    width: '52%',
    borderRadius: 6,
  },
  skeletonLineMd: {
    height: 13,
    width: '32%',
    borderRadius: 6,
  },
  skeletonLineSm: {
    height: 12,
    width: '46%',
    borderRadius: 6,
  },
  skeletonBarTrack: {
    height: 10,
    borderRadius: 6,
    overflow: 'hidden',
  },
  skeletonBarFill: {
    height: '100%',
    width: '66%',
  },
  skeletonBarFillAlt: {
    height: '100%',
    width: '42%',
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  packageHeaderLeft: {
    flex: 1,
  },
  packageName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  packageTier: {
    fontSize: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  packageInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  packageInfoLabel: {
    fontSize: 12,
  },
  packageInfoValue: {
    fontSize: 12,
    fontWeight: '500',
  },
  usageItem: {
    padding: 16,
    borderTopWidth: 1,
  },
  usageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  usageLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  usageStats: {
    fontSize: 11,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  noPackageContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noPackageText: {
    fontSize: 13,
  },
  clusterItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.2)',
  },
  clusterItemInfo: {
    flex: 1,
    marginRight: 12,
  },
  clusterTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  clusterSub: {
    fontSize: 12,
  },
  clusterActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  clusterActionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  clusterDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  // Pending purchases styles
  pendingSection: {
    padding: 16,
    borderTopWidth: 1,
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
  },
  pendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  pendingSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#f59e0b',
    letterSpacing: 0.5,
  },
  pendingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  pendingInfo: {
    flex: 1,
  },
  pendingPackageName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  pendingTxn: {
    fontSize: 11,
    fontFamily: 'monospace',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  pendingBadgeText: {
    color: '#f59e0b',
    fontSize: 10,
    fontWeight: '600',
  },
  pendingNote: {
    fontSize: 10,
    marginTop: 10,
    fontStyle: 'italic',
  },
  availablePackagesContainer: {
    padding: 16,
    borderTopWidth: 1,
  },
  availablePackagesTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  collapsableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  availablePackagesSubtitle: {
    fontSize: 12,
    marginBottom: 12,
  },
  packageOption: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    right: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    zIndex: 1,
  },
  popularBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  packageOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  packageOptionTitleSection: {
    flex: 1,
  },
  packageOptionName: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
    letterSpacing: -0.5,
  },
  packageOptionTier: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  packageOptionPriceSection: {
    alignItems: 'flex-end',
  },
  packageOptionPrice: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  packageOptionPeriod: {
    fontSize: 11,
    fontWeight: '500',
  },
  packageOptionDivider: {
    height: 1,
    width: '100%',
    marginBottom: 16,
    opacity: 0.5,
  },
  packageOptionFeatures: {
    gap: 8,
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  packageOptionFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  selectActionText: {
    fontSize: 14,
    fontWeight: '700',
  },
});


