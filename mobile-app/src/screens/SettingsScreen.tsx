import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Modal,
  Linking,
  Clipboard,
} from 'react-native';
import { storage } from '../services/storage';
import { installationService } from '../services/installation';
import { useTheme } from '../contexts/ThemeContext';
import { packageAPI, telegramAuthAPI } from '../services/api';
import { Crown, Check, Clock, Smartphone, CheckCircle, AlertCircle, Lock, Fingerprint, ChevronRight, MessageCircle, Link2, Link2Off, Copy, ExternalLink } from 'lucide-react-native';
import PaymentModal from '../components/PaymentModal';
import { securityService } from '../services/securityService';
import PINSetupScreen from './PINSetupScreen';
import { getDisplayName } from '../utils/userUtils';
import { useTranslation } from 'react-i18next';

interface Props {
  apiKey: string;
  onLogout: () => void;
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

export default function SettingsScreen({ apiKey, onLogout }: Props) {
  const { colors, theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const [smsMonitoring, setSmsMonitoring] = useState(false);
  const [installationDate, setInstallationDate] = useState<Date | null>(null);
  const [currentPackage, setCurrentPackage] = useState<UserPackage | null>(null);
  const [availablePackages, setAvailablePackages] = useState<Package[]>([]);
  const [pendingPurchases, setPendingPurchases] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  // Security state
  const [pinEnabled, setPinEnabled] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricName, setBiometricName] = useState('Biometrics');
  const [showPINSetup, setShowPINSetup] = useState(false);
  const [isChangingPIN, setIsChangingPIN] = useState(false);
  
  // Telegram linking state
  const [telegramStatus, setTelegramStatus] = useState<{
    isLinked: boolean;
    telegramUsername: string | null;
    linkedAt: string | null;
  }>({ isLinked: false, telegramUsername: null, linkedAt: null });
  const [telegramLoading, setTelegramLoading] = useState(true);
  const [linkingCode, setLinkingCode] = useState<string | null>(null);
  const [botUsername, setBotUsername] = useState<string>('');
  const [linkingTelegram, setLinkingTelegram] = useState(false);
  const [unlinkingTelegram, setUnlinkingTelegram] = useState(false);
  const [isUpgradeCollapsed, setIsUpgradeCollapsed] = useState(true);
  const [user, setUser] = useState<any>(null);

  React.useEffect(() => {
    loadSettings();
    loadPackageInfo();
    loadSecuritySettings();
    loadTelegramStatus();
    loadUser();
  }, []);

  const loadUser = async () => {
    const storedUser = await storage.getUser();
    setUser(storedUser);
  };

  const loadSettings = async () => {
    const date = await installationService.getInstallationDate();
    setInstallationDate(date);
  };

  const loadTelegramStatus = async () => {
    try {
      const [statusRes, botRes] = await Promise.all([
        telegramAuthAPI.getStatus().catch(() => ({ success: false, data: null })),
        telegramAuthAPI.getBotInfo().catch(() => ({ success: false, data: null })),
      ]);
      
      if (statusRes.success && statusRes.data) {
        setTelegramStatus(statusRes.data);
      }
      
      if (botRes.success && botRes.data?.botUsername) {
        setBotUsername(botRes.data.botUsername);
      }
    } catch (error) {
      console.error('Error loading Telegram status:', error);
    } finally {
      setTelegramLoading(false);
    }
  };

  const handleLinkTelegram = async () => {
    setLinkingTelegram(true);
    try {
      const response = await telegramAuthAPI.link();
      if (response.success && response.data) {
        setLinkingCode(response.data.code);
        if (response.data.botUsername) {
          setBotUsername(response.data.botUsername);
        }
        Alert.alert(
          t('settings.linkingCodeGeneratedTitle', { defaultValue: 'Linking Code Generated' }),
          t('settings.linkingCodeGeneratedMessage', {
            defaultValue: 'Send /link {{code}} to our Telegram bot to link your account.',
            code: response.data.code,
          }),
          [{ text: t('common.done', { defaultValue: 'OK' }) }]
        );
      } else {
        Alert.alert(t('common.error'), response.error || t('settings.failedGenerateLinkingCode', { defaultValue: 'Failed to generate linking code' }));
      }
    } catch (error: any) {
      Alert.alert(t('common.error'), error.response?.data?.error || t('settings.failedGenerateLinkingCode', { defaultValue: 'Failed to generate linking code' }));
    } finally {
      setLinkingTelegram(false);
    }
  };

  const handleUnlinkTelegram = async () => {
    Alert.alert(
      t('settings.unlinkTelegramTitle', { defaultValue: 'Unlink Telegram' }),
      t('settings.unlinkTelegramMessage', { defaultValue: 'Are you sure you want to unlink your Telegram account? You will no longer receive OTP codes or notifications via Telegram.' }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.unlink', { defaultValue: 'Unlink' }),
          style: 'destructive',
          onPress: async () => {
            setUnlinkingTelegram(true);
            try {
              const response = await telegramAuthAPI.unlink();
              if (response.success) {
                setTelegramStatus({ isLinked: false, telegramUsername: null, linkedAt: null });
                setLinkingCode(null);
                Alert.alert(t('common.success'), t('settings.telegramUnlinked', { defaultValue: 'Telegram account unlinked successfully' }));
              } else {
                Alert.alert(t('common.error'), response.error || t('settings.failedUnlinkTelegram', { defaultValue: 'Failed to unlink Telegram' }));
              }
            } catch (error: any) {
              Alert.alert(t('common.error'), error.response?.data?.error || t('settings.failedUnlinkTelegramAccount', { defaultValue: 'Failed to unlink Telegram account' }));
            } finally {
              setUnlinkingTelegram(false);
            }
          },
        },
      ]
    );
  };

  const copyToClipboard = (text: string) => {
    Clipboard.setString(text);
    Alert.alert(
      t('settings.copiedTitle', { defaultValue: 'Copied' }),
      t('settings.commandCopiedToClipboard', { defaultValue: 'Command copied to clipboard' })
    );
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
        t('settings.disablePinTitle', { defaultValue: 'Disable PIN' }),
        t('settings.disablePinMessage', { defaultValue: 'Are you sure you want to disable the PIN lock? This will also disable biometric unlock.' }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('settings.disable', { defaultValue: 'Disable' }),
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
        Alert.alert(
          t('common.success'),
          t('settings.biometricEnabled', {
            defaultValue: '{{biometricName}} has been enabled for quick unlock.',
            biometricName,
          })
        );
      } catch (error: any) {
        Alert.alert(t('common.error'), error.message || t('settings.failedEnableBiometric', { defaultValue: 'Failed to enable biometric' }));
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
    try {
      setLoading(true);
      const [myPackageRes, packagesRes, purchasesRes] = await Promise.all([
        packageAPI.getMyPackage().catch(() => ({ success: false, data: null })),
        packageAPI.getPackages(),
        packageAPI.getMyPurchases().catch(() => ({ success: false, data: [] })),
      ]);

      if (myPackageRes.success && myPackageRes.data) {
        setCurrentPackage(myPackageRes.data);
      }

      if (packagesRes.success) {
        // Only show BUSINESS tier packages
        const businessPackages = packagesRes.data.filter((p: Package) => 
          p.tier === 'BUSINESS' && p.price && p.price > 0
        );
        setAvailablePackages(businessPackages);
      }

      if (purchasesRes.success) {
        // Show pending purchases
        const pending = purchasesRes.data.filter(
          (p: PurchaseRequest) => p.status === 'PENDING'
        );
        setPendingPurchases(pending);
      }
    } catch (error) {
      console.error('Error loading package info:', error);
      Alert.alert(t('common.error'), t('settings.failedLoadPackageInfo', { defaultValue: 'Failed to load package information' }));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadPackageInfo();
    loadSettings();
    loadSecuritySettings();
  };

  const handlePurchaseSubmit = async (transactionNumber: string) => {
    if (!selectedPackage) return;

    setPurchasing(true);
    try {
      const response = await packageAPI.purchasePackage({
        packageId: selectedPackage.id,
        transactionNumber,
      });

      if (response.success) {
        setShowPaymentModal(false);
        setSelectedPackage(null);
        Alert.alert(
          t('settings.requestSubmittedTitle', { defaultValue: 'Request Submitted!' }), 
          t('settings.requestSubmittedMessage', { defaultValue: 'Your purchase request has been submitted. Your package will be activated once the transaction is verified by admin.' }),
          [{ text: t('common.done', { defaultValue: 'OK' }) }]
        );
        loadPackageInfo(); // Refresh to show the pending purchase
      } else {
        throw new Error(response.error || t('settings.failedSubmitPurchaseRequest', { defaultValue: 'Failed to submit purchase request' }));
      }
    } catch (error: any) {
      console.error('Purchase error:', error);
      Alert.alert(t('common.error'), error.response?.data?.error || error.message || t('settings.failedSubmitPurchaseRequest', { defaultValue: 'Failed to submit purchase request' }));
    } finally {
      setPurchasing(false);
    }
  };

  const handleSelectPackage = (pkg: Package) => {
    // Check if there's already a pending purchase for this package
    const hasPending = pendingPurchases.some(p => p.packageId === pkg.id);
    if (hasPending) {
      Alert.alert(
        t('settings.pendingPurchaseTitle', { defaultValue: 'Pending Purchase' }),
        t('settings.pendingPurchaseMessage', { defaultValue: 'You already have a pending purchase request for this package. Please wait for admin verification.' }),
        [{ text: t('common.done', { defaultValue: 'OK' }) }]
      );
      return;
    }
    setSelectedPackage(pkg);
  };

  const handleLogout = () => {
    Alert.alert(
      t('settings.logoutTitle', { defaultValue: 'Logout' }),
      t('settings.logoutMessage', { defaultValue: 'Are you sure you want to logout?' }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.logout', { defaultValue: 'Logout' }),
          style: 'destructive',
          onPress: onLogout,
        },
      ]
    );
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return t('settings.never', { defaultValue: 'Never' });
    return new Date(dateString).toLocaleDateString();
  };

  const isPremium = currentPackage?.package?.tier !== 'FREE';

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
      }
    >
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerContent}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>{t('settings.title', { defaultValue: 'Settings' })}</Text>
            <Text style={[styles.userName, { color: colors.textSecondary }]}>
              {getDisplayName(user)}
            </Text>
          </View>
        </View>
      </View>

      {/* Package & Usage Section */}
      <View style={[styles.section, { borderTopColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('settings.packageAndUsage', { defaultValue: 'Package & Usage' })}</Text>
        
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 20 }} />
        ) : (
          <>
            {/* Current Plan Card */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={[styles.planName, { color: colors.text }]}>
                    {currentPackage?.package?.name || t('settings.freePlan', { defaultValue: 'Free Plan' })}
                  </Text>
                  <Text style={[styles.planStatus, { color: isPremium ? colors.primary : colors.textSecondary }]}>
                    {currentPackage?.status || t('settings.active', { defaultValue: 'Active' })}
                  </Text>
                </View>
                {isPremium && <Crown size={24} color={colors.primary} fill={colors.primary + '20'} />}
              </View>

              <View style={[styles.usageStats, { backgroundColor: colors.background }]}>
                <View style={styles.usageItem}>
                  <Smartphone size={16} color={colors.textSecondary} style={{ marginBottom: 4 }} />
                  <Text style={[styles.usageLabel, { color: colors.textSecondary }]}>{t('settings.phoneTxns', { defaultValue: 'Phone Txns' })}</Text>
                  <Text style={[styles.usageValue, { color: colors.text }]}>
                    {currentPackage?.phoneTxnsRemaining === null ? '∞' : currentPackage?.phoneTxnsRemaining}
                  </Text>
                </View>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.usageItem}>
                  <CheckCircle size={16} color={colors.textSecondary} style={{ marginBottom: 4 }} />
                  <Text style={[styles.usageLabel, { color: colors.textSecondary }]}>{t('settings.verifiedTxns', { defaultValue: 'Verified Txns' })}</Text>
                  <Text style={[styles.usageValue, { color: colors.text }]}>
                    {currentPackage?.verifiedTxnsRemaining === null ? '∞' : currentPackage?.verifiedTxnsRemaining}
                  </Text>
                </View>
              </View>
              
              {currentPackage?.endsAt && (
                <Text style={[styles.expiryText, { color: colors.textSecondary }]}>
                  {t('settings.expires', { defaultValue: 'Expires' })}: {formatDate(currentPackage.endsAt)}
                </Text>
              )}
            </View>

            {/* Available Upgrades */}
            {availablePackages.length > 0 && (
              <View style={styles.upgradesContainer}>
                <TouchableOpacity 
                  style={styles.collapsableHeader} 
                  onPress={() => setIsUpgradeCollapsed(!isUpgradeCollapsed)}
                  activeOpacity={0.7}
                >
                  <View style={styles.upgradesHeader}>
                    <Text style={[styles.subsectionTitle, { color: colors.text }]}>{t('settings.upgradePlan', { defaultValue: 'Upgrade Plan' })}</Text>
                    <Text style={[styles.upgradesSubtitle, { color: colors.textSecondary }]}>
                      {t('settings.selectPlanToContinue', { defaultValue: 'Select a plan to continue' })}
                    </Text>
                  </View>
                  <ChevronRight 
                    size={20} 
                    color={colors.textSecondary} 
                    style={{ transform: [{ rotate: isUpgradeCollapsed ? '0deg' : '90deg' }] }} 
                  />
                </TouchableOpacity>
                
                {!isUpgradeCollapsed && (
                  <View style={styles.packagesList}>
                  {availablePackages.map((pkg, index) => {
                    const isSelected = selectedPackage?.id === pkg.id;
                    const hasPending = pendingPurchases.some(p => p.packageId === pkg.id);
                    const isPopular = pkg.name.toLowerCase().includes('pro') || pkg.name.toLowerCase().includes('business') || index === 1;
                    
                    return (
                      <TouchableOpacity
                        key={pkg.id}
                        style={[
                          styles.packageCard, 
                          { 
                            backgroundColor: colors.surface,
                            borderColor: isSelected ? colors.primary : colors.border,
                            borderWidth: isSelected ? 2 : 1,
                          },
                          isSelected && styles.selectedPackageCard
                        ]}
                        onPress={() => handleSelectPackage(pkg)}
                        activeOpacity={0.8}
                      >
                        {isPopular && (
                          <View style={[styles.popularBadge, { backgroundColor: colors.primary }]}>
                            <Text style={styles.popularBadgeText}>{t('settings.mostPopular', { defaultValue: 'MOST POPULAR' })}</Text>
                          </View>
                        )}
                        
                        <View style={styles.packageCardHeader}>
                          <View style={styles.packageTitleSection}>
                            <Text style={[styles.packageName, { color: colors.text }]}>
                              {pkg.name}
                            </Text>
                            <Text style={[styles.packageTierLabel, { color: colors.textSecondary }]}>
                              {t('settings.tierLabel', { defaultValue: '{{tier}} Tier', tier: pkg.tier })}
                            </Text>
                          </View>
                          <View style={styles.packagePriceSection}>
                            <Text style={[styles.packagePrice, { color: colors.text }]}>
                              ${pkg.price}
                            </Text>
                            <Text style={[styles.packagePeriod, { color: colors.textSecondary }]}>
                              /{pkg.billingCycle?.toLowerCase().replace('_', ' ') || t('settings.monthShort', { defaultValue: 'mo' })}
                            </Text>
                          </View>
                        </View>

                        <View style={[styles.packageDivider, { backgroundColor: colors.border }]} />

                        <View style={styles.packageFeaturesList}>
                          <View style={styles.featureItem}>
                            <Check size={16} color={colors.primary} />
                            <Text style={[styles.featureText, { color: colors.textSecondary }]}>
                              <Text style={{ color: colors.text, fontWeight: '600' }}>
                                {pkg.maxPhoneTxns === null ? t('settings.unlimited', { defaultValue: 'Unlimited' }) : pkg.maxPhoneTxns}
                              </Text> {t('settings.phoneTransactions', { defaultValue: 'Phone Transactions' })}
                            </Text>
                          </View>
                          <View style={styles.featureItem}>
                            <Check size={16} color={colors.primary} />
                            <Text style={[styles.featureText, { color: colors.textSecondary }]}>
                              <Text style={{ color: colors.text, fontWeight: '600' }}>
                                {pkg.maxVerifiedTxns === null ? t('settings.unlimited', { defaultValue: 'Unlimited' }) : pkg.maxVerifiedTxns}
                              </Text> {t('settings.verifiedTransactions', { defaultValue: 'Verified Transactions' })}
                            </Text>
                          </View>
                          {pkg.description && (
                            <View style={styles.featureItem}>
                              <Check size={16} color={colors.primary} />
                              <Text style={[styles.featureText, { color: colors.textSecondary }]} numberOfLines={1}>
                                {pkg.description}
                              </Text>
                            </View>
                          )}
                        </View>

                        <View style={styles.packageCardFooter}>
                          {hasPending ? (
                            <View style={[styles.statusBadge, { backgroundColor: '#f59e0b15' }]}>
                              <Clock size={14} color="#f59e0b" />
                              <Text style={[styles.statusBadgeText, { color: '#f59e0b' }]}>{t('settings.pendingVerification', { defaultValue: 'Pending Verification' })}</Text>
                            </View>
                          ) : isSelected ? (
                            <View style={[styles.statusBadge, { backgroundColor: colors.primary + '15' }]}>
                              <Check size={14} color={colors.primary} />
                              <Text style={[styles.statusBadgeText, { color: colors.primary }]}>{t('settings.selected', { defaultValue: 'Selected' })}</Text>
                            </View>
                          ) : (
                            <Text style={[styles.selectActionText, { color: colors.primary }]}>
                              {t('settings.selectPlan', { defaultValue: 'Select Plan' })}
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                )}

                {/* Continue to Payment Button */}
                {selectedPackage && (
                  <View style={styles.continueButtonContainer}>
                    <TouchableOpacity
                      style={[styles.continueButton, { backgroundColor: colors.primary }]}
                      onPress={() => setShowPaymentModal(true)}
                    >
                      <Text style={styles.continueButtonText}>
                        {t('settings.continueToPayment', { defaultValue: 'Continue to Payment' })}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* Pending Purchases */}
            {pendingPurchases.length > 0 && (
              <View style={[styles.pendingSection, { borderColor: '#f59e0b' }]}>
                <View style={styles.pendingHeader}>
                  <Clock size={18} color="#f59e0b" />
                  <Text style={[styles.pendingSectionTitle, { color: '#f59e0b' }]}>
                    {t('settings.pendingVerificationUpper', { defaultValue: 'PENDING VERIFICATION' })}
                  </Text>
                </View>
                {pendingPurchases.map((purchase) => (
                  <View key={purchase.id} style={[styles.pendingItem, { borderBottomColor: 'rgba(245, 158, 11, 0.2)' }]}>
                    <View style={styles.pendingInfo}>
                      <Text style={[styles.pendingPackage, { color: colors.text }]}>
                        {purchase.package.name}
                      </Text>
                      <Text style={[styles.pendingTxn, { color: colors.textSecondary }]}>
                        {t('settings.txnLabel', { defaultValue: 'Txn' })}: {purchase.transactionNumber}
                      </Text>
                    </View>
                    <View style={styles.pendingBadge}>
                      <AlertCircle size={14} color="#f59e0b" />
                      <Text style={styles.pendingBadgeText}>{t('settings.awaiting', { defaultValue: 'Awaiting' })}</Text>
                    </View>
                  </View>
                ))}
                <Text style={[styles.pendingNote, { color: colors.textSecondary }]}>
                  {t('settings.purchaseActivatedAfterVerification', { defaultValue: 'Your purchase will be activated once verified by admin' })}
                </Text>
              </View>
            )}
          </>
        )}
      </View>

      {/* Security Section */}
      <View style={[styles.section, { borderTopColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('settings.security', { defaultValue: 'Security' })}</Text>
        
        {/* App Lock Toggle */}
        <View style={styles.settingItem}>
          <View style={styles.settingContent}>
            <View style={styles.settingLabelRow}>
              <Lock size={18} color={colors.primary} style={{ marginRight: 8 }} />
                <Text style={[styles.settingLabel, { color: colors.text }]}>{t('settings.appLock', { defaultValue: 'App Lock' })}</Text>
            </View>
            <Text style={[styles.settingHint, { color: colors.textSecondary }]}>
                {t('settings.requirePinToOpen', { defaultValue: 'Require PIN to open the app' })}
            </Text>
          </View>
          <Switch
            value={pinEnabled}
            onValueChange={handleTogglePIN}
            trackColor={{ false: '#767577', true: colors.primary }}
            thumbColor={pinEnabled ? colors.primary : '#f4f3f4'}
          />
        </View>

        {/* Biometric Toggle (only if PIN enabled and biometric available) */}
        {pinEnabled && biometricAvailable && (
          <View style={[styles.settingItem, { marginTop: 16 }]}>
            <View style={styles.settingContent}>
              <View style={styles.settingLabelRow}>
                <Fingerprint size={18} color={colors.primary} style={{ marginRight: 8 }} />
                <Text style={[styles.settingLabel, { color: colors.text }]}>{biometricName}</Text>
              </View>
              <Text style={[styles.settingHint, { color: colors.textSecondary }]}>
                {t('settings.useBiometricQuickUnlock', {
                  defaultValue: 'Use {{biometricName}} for quick unlock',
                  biometricName,
                })}
              </Text>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={handleToggleBiometric}
              trackColor={{ false: '#767577', true: colors.primary }}
              thumbColor={biometricEnabled ? colors.primary : '#f4f3f4'}
            />
          </View>
        )}

        {/* Change PIN Button (only if PIN enabled) */}
        {pinEnabled && (
          <TouchableOpacity
            style={[styles.changePinButton, { borderColor: colors.border }]}
            onPress={handleChangePIN}
          >
            <Text style={[styles.changePinText, { color: colors.primary }]}>{t('settings.changePin', { defaultValue: 'Change PIN' })}</Text>
            <ChevronRight size={18} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Telegram Account Section */}
      <View style={[styles.section, { borderTopColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('settings.telegramAccount', { defaultValue: 'Telegram Account' })}</Text>
        
        {telegramLoading ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 20 }} />
        ) : telegramStatus.isLinked ? (
          <View>
            {/* Linked Status Card */}
            <View style={[styles.telegramCard, styles.telegramCardLinked]}>
              <View style={styles.telegramCardHeader}>
                <View style={styles.telegramIconContainer}>
                  <MessageCircle size={24} color="#22C55E" />
                </View>
                <View style={styles.telegramCardContent}>
                  <Text style={[styles.telegramCardTitle, { color: colors.text }]}>
                    {t('settings.telegramLinked', { defaultValue: 'Telegram Linked' })}
                  </Text>
                  <Text style={[styles.telegramCardSubtitle, { color: colors.textSecondary }]}>
                    @{telegramStatus.telegramUsername || t('settings.unknown', { defaultValue: 'Unknown' })}
                  </Text>
                </View>
              </View>
            </View>

            <Text style={[styles.telegramInfoText, { color: colors.textSecondary }]}>
              {t('settings.telegramLinkedBenefits', {
                defaultValue: 'With Telegram linked, you can:\n• Login using OTP sent to Telegram\n• Receive transaction notifications\n• Reset your password using OTP',
              })}
            </Text>

            <TouchableOpacity
              style={[styles.unlinkButton, { borderColor: '#EF4444' }]}
              onPress={handleUnlinkTelegram}
              disabled={unlinkingTelegram}
            >
              {unlinkingTelegram ? (
                <ActivityIndicator size="small" color="#EF4444" />
              ) : (
                <>
                  <Link2Off size={18} color="#EF4444" />
                  <Text style={styles.unlinkButtonText}>{t('settings.unlinkTelegram', { defaultValue: 'Unlink Telegram' })}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            {/* Not Linked Card */}
            <View style={[styles.telegramCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.telegramCardHeader}>
                <View style={[styles.telegramIconContainer, { backgroundColor: colors.background }]}>
                  <MessageCircle size={24} color={colors.textSecondary} />
                </View>
                <View style={styles.telegramCardContent}>
                  <Text style={[styles.telegramCardTitle, { color: colors.text }]}>
                    {t('settings.telegramNotLinked', { defaultValue: 'Telegram Not Linked' })}
                  </Text>
                  <Text style={[styles.telegramCardSubtitle, { color: colors.textSecondary }]}>
                    {t('settings.linkEnableOtpNotifications', { defaultValue: 'Link to enable OTP login & notifications' })}
                  </Text>
                </View>
              </View>
            </View>

            {linkingCode ? (
              <View style={styles.linkingSteps}>
                <View style={[styles.linkingStep, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                  <Text style={[styles.linkingStepTitle, { color: '#1E40AF' }]}>
                    {t('settings.stepOpenTelegramBot', { defaultValue: 'Step 1: Open our Telegram bot' })}
                  </Text>
                  <TouchableOpacity
                    style={styles.linkingStepAction}
                    onPress={() => Linking.openURL(`https://t.me/${botUsername}`)}
                  >
                    <ExternalLink size={16} color="#2563EB" />
                    <Text style={styles.linkingStepLink}>
                      {t('settings.openBot', { defaultValue: 'Open @{{botUsername}}', botUsername })}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={[styles.linkingStep, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                  <Text style={[styles.linkingStepTitle, { color: '#1E40AF' }]}>
                    {t('settings.stepSendCommand', { defaultValue: 'Step 2: Send this command to the bot' })}
                  </Text>
                  <View style={styles.linkingCodeContainer}>
                    <Text style={styles.linkingCodeText}>/link {linkingCode}</Text>
                    <TouchableOpacity
                      style={styles.copyButton}
                      onPress={() => copyToClipboard(`/link ${linkingCode}`)}
                    >
                      <Copy size={16} color="#2563EB" />
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={[styles.linkingNote, { color: colors.textSecondary }]}>
                  {t('settings.codeExpiresNote', { defaultValue: 'Code expires in 10 minutes. After sending the command, refresh to see linked status.' })}
                </Text>

                <View style={styles.linkingActions}>
                  <TouchableOpacity
                    style={[styles.refreshButton, { borderColor: colors.border }]}
                    onPress={loadTelegramStatus}
                  >
                    <Text style={[styles.refreshButtonText, { color: colors.text }]}>{t('settings.refreshStatus', { defaultValue: 'Refresh Status' })}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cancelLinkButton}
                    onPress={() => setLinkingCode(null)}
                  >
                    <Text style={[styles.cancelLinkText, { color: colors.textSecondary }]}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.linkTelegramButton]}
                onPress={handleLinkTelegram}
                disabled={linkingTelegram || !botUsername}
              >
                {linkingTelegram ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Link2 size={18} color="#FFFFFF" />
                    <Text style={styles.linkTelegramButtonText}>{t('settings.linkTelegramAccount', { defaultValue: 'Link Telegram Account' })}</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Appearance Section */}
      <View style={[styles.section, { borderTopColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('settings.appearance', { defaultValue: 'Appearance' })}</Text>
        <View style={styles.settingItem}>
          <View style={styles.settingContent}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>{t('settings.theme', { defaultValue: 'Theme' })}</Text>
            <Text style={[styles.settingHint, { color: colors.textSecondary }]}>
              {theme === 'dark'
                ? t('settings.darkModeLabel', { defaultValue: 'Dark mode' })
                : t('settings.lightModeLabel', { defaultValue: 'Light mode' })}
            </Text>
          </View>
          <Switch
            value={theme === 'dark'}
            onValueChange={toggleTheme}
            trackColor={{ false: '#767577', true: colors.primary }}
            thumbColor={theme === 'dark' ? colors.primary : '#f4f3f4'}
          />
        </View>
      </View>

      {/* SMS Monitoring Section */}
      <View style={[styles.section, { borderTopColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('settings.smsMonitoring', { defaultValue: 'SMS Monitoring' })}</Text>
        <View style={styles.settingItem}>
          <View style={styles.settingContent}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>{t('settings.enableSmsMonitoring', { defaultValue: 'Enable SMS Monitoring' })}</Text>
            <Text style={[styles.settingHint, { color: colors.textSecondary }]}>
              {t('settings.autoProcessSmsHint', { defaultValue: 'Automatically process incoming SMS (requires permissions)' })}
            </Text>
          </View>
          <Switch
            value={smsMonitoring}
            onValueChange={setSmsMonitoring}
            trackColor={{ false: '#767577', true: colors.primary }}
            thumbColor={smsMonitoring ? colors.primary : '#f4f3f4'}
          />
        </View>
      </View>

      {/* App Info Section */}
      <View style={[styles.section, { borderTopColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('settings.appInformation', { defaultValue: 'App Information' })}</Text>
        {installationDate && (
          <View style={[styles.infoItem, { borderBottomColor: colors.border }]}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('settings.installedLabel', { defaultValue: 'Installed' })}:</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {installationDate.toLocaleDateString()}
            </Text>
          </View>
        )}
        <View style={[styles.infoItem, { borderBottomColor: colors.border }]}>
          <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('settings.versionLabel', { defaultValue: 'Version' })}:</Text>
          <Text style={[styles.infoValue, { color: colors.text }]}>1.0.0</Text>
        </View>
      </View>

      {/* Logout Section */}
      <View style={[styles.section, { borderTopColor: colors.border }]}>
        <TouchableOpacity 
          style={[styles.logoutButton, { backgroundColor: colors.primary }]} 
          onPress={handleLogout}
        >
          <Text style={[styles.logoutText, { color: colors.primaryText }]}>{t('settings.logout', { defaultValue: 'Logout' })}</Text>
        </TouchableOpacity>
      </View>

      {/* Payment Modal */}
      <PaymentModal
        visible={showPaymentModal}
        selectedPackage={selectedPackage}
        onSubmit={(payload) => handlePurchaseSubmit(payload.transactionNumber)}
        onClose={() => setShowPaymentModal(false)}
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
  header: {
    padding: 20,
    paddingTop: 20,
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userName: {
    fontSize: 14,
    marginTop: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  section: {
    padding: 20,
    borderTopWidth: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  planName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  planStatus: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  usageStats: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  usageItem: {
    flex: 1,
    alignItems: 'center',
  },
  usageLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  usageValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  divider: {
    width: 1,
    height: '100%',
    marginHorizontal: 12,
  },
  expiryText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  upgradesContainer: {
    marginTop: 16,
  },
  upgradesHeader: {
    flex: 1,
    marginBottom: 16,
  },
  collapsableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  upgradesSubtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  packagesList: {
    gap: 16,
  },
  packageCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  selectedPackageCard: {
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 5,
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
  packageCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  packageTitleSection: {
    flex: 1,
  },
  packageName: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  packageTierLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  packagePriceSection: {
    alignItems: 'flex-end',
  },
  packagePrice: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  packagePeriod: {
    fontSize: 12,
    fontWeight: '500',
  },
  packageDivider: {
    height: 1,
    width: '100%',
    marginBottom: 16,
    opacity: 0.5,
  },
  packageFeaturesList: {
    gap: 10,
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  packageCardFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  selectActionText: {
    fontSize: 15,
    fontWeight: '700',
  },
  // Continue to payment button
  continueButtonContainer: {
    marginTop: 24,
  },
  continueButton: {
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  // Pending purchases section
  pendingSection: {
    marginTop: 24,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
  },
  pendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  pendingSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  pendingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  pendingInfo: {
    flex: 1,
  },
  pendingPackage: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  pendingTxn: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  pendingBadgeText: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '700',
  },
  pendingNote: {
    fontSize: 12,
    marginTop: 16,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingContent: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    marginBottom: 4,
  },
  settingHint: {
    fontSize: 12,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
  },
  logoutButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Security styles
  settingLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  changePinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  changePinText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Telegram styles
  telegramCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  telegramCardLinked: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  telegramCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  telegramIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  telegramCardContent: {
    flex: 1,
  },
  telegramCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  telegramCardSubtitle: {
    fontSize: 14,
  },
  telegramInfoText: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 16,
  },
  unlinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  unlinkButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  linkTelegramButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#0088CC',
    gap: 8,
  },
  linkTelegramButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  linkingSteps: {
    gap: 12,
  },
  linkingStep: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  linkingStepTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  linkingStepAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  linkingStepLink: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '500',
  },
  linkingCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  linkingCodeText: {
    flex: 1,
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#1E40AF',
  },
  copyButton: {
    padding: 4,
  },
  linkingNote: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  linkingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
  },
  refreshButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  refreshButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  cancelLinkButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  cancelLinkText: {
    fontSize: 14,
  },
});
