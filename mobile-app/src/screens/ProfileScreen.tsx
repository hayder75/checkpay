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
import { Building2, ChevronRight, Users, UserPlus, QrCode, Copy, RefreshCw, X as CloseIcon, Settings, CreditCard, Shield, Info, LogOut, Mail, Phone, Globe } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { storage } from '../services/storage';
import { installationService } from '../services/installation';
import { authAPI, employeeAPI, packageAPI } from '../services/api';
import { Modal } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

interface Props {
  apiKey?: string | null;
  onLogout: () => void;
  onNavigateToBanks?: () => void;
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

export default function ProfileScreen({ apiKey, onLogout, onNavigateToBanks }: Props) {
  const { colors, theme, toggleTheme } = useTheme();
  const [user, setUser] = useState<any>(null);
  const [installationDate, setInstallationDate] = useState<Date | null>(null);
  const [plan, setPlan] = useState<'FREE' | 'PREMIUM'>('FREE');
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [employeeOTP, setEmployeeOTP] = useState('');
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [generatingOTP, setGeneratingOTP] = useState(false);
  const [currentPackage, setCurrentPackage] = useState<UserPackage | null>(null);
  const [availablePackages, setAvailablePackages] = useState<Package[]>([]);
  const [loadingPackage, setLoadingPackage] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);

  const isBusinessOwner = user?.role === 'BUSINESS_OWNER' || user?.role === 'DEVELOPER';

  useEffect(() => {
    loadProfile();
    loadPackageInfo();
  }, []);

  const loadPackageInfo = async () => {
    try {
      setLoadingPackage(true);
      const [myPackageRes, freePackagesRes, businessPackagesRes] = await Promise.all([
        packageAPI.getMyPackage().catch(() => ({ success: false, data: null })),
        packageAPI.getPackages({ tier: 'FREE' }),
        packageAPI.getPackages({ tier: 'BUSINESS' }),
      ]);

      if (myPackageRes.success && myPackageRes.data) {
        setCurrentPackage(myPackageRes.data);
      }

      const allPackages: Package[] = [
        ...(freePackagesRes.data || []),
        ...(businessPackagesRes.data || []),
      ];
      setAvailablePackages(allPackages);
    } catch (error) {
      console.error('Error loading package info:', error);
    } finally {
      setLoadingPackage(false);
    }
  };

  const handleActivatePackage = async (packageId: string) => {
    if (activating) return;

    Alert.alert(
      'Activate Package',
      'Are you sure you want to activate this package? Your remaining tokens from the current package will be rolled over.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Activate',
          onPress: async () => {
            try {
              setActivating(packageId);
              const response = await packageAPI.activatePackage({ packageId });
              if (response.success) {
                Alert.alert('Success', 'Package activated successfully');
                await loadPackageInfo();
              } else {
                Alert.alert('Error', response.error || 'Failed to activate package');
              }
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.error || 'Failed to activate package');
            } finally {
              setActivating(null);
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  const getRemainingPercentage = (remaining: number | null, max: number | null) => {
    if (remaining === null || max === null || max === 0) return 100;
    return Math.round((remaining / max) * 100);
  };

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
        try {
          const response = await authAPI.getMe();
          if (response.success && response.data) {
            const freshUser = response.data;
            setUser(freshUser);
            if (freshUser.plan) {
              setPlan(freshUser.plan);
            }
            // Update stored user
            await storage.setUser(freshUser);
            console.log('✅ [Profile] Loaded fresh user data from backend');
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
        Alert.alert('Error', 'No business associated with this account');
        return;
      }
      const response = await employeeAPI.generateCode(businessId);
      if (response.success && response.data?.code) {
        setBusinessId(businessId);
        setEmployeeOTP(response.data.code);
        setShowAddEmployeeModal(true);
      } else {
        Alert.alert('Error', 'Failed to generate access code');
      }
    } catch (error) {
      console.error('Error generating employee code:', error);
      Alert.alert('Error', 'Failed to generate access code');
    } finally {
      setGeneratingOTP(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
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
              {user?.username?.[0]?.toUpperCase() || user?.phone?.[0] || 'U'}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.name, { color: colors.text }]}>
              {user?.username || 'User'}
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
          <TouchableOpacity style={[styles.settingsBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Settings size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        {/* Account Section */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>ACCOUNT</Text>
        <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.listItem}>
            <View style={styles.listItemLeft}>
              <Phone size={18} color={colors.textSecondary} />
              <Text style={[styles.listItemText, { color: colors.text }]}>Phone Number</Text>
            </View>
            <Text style={[styles.listItemValue, { color: colors.textSecondary }]}>{user?.phone || 'Not set'}</Text>
          </View>
          <View style={[styles.listDivider, { backgroundColor: colors.border }]} />
          <View style={styles.listItem}>
            <View style={styles.listItemLeft}>
              <Globe size={18} color={colors.textSecondary} />
              <Text style={[styles.listItemText, { color: colors.text }]}>Country</Text>
            </View>
            <Text style={[styles.listItemValue, { color: colors.textSecondary }]}>{user?.country || 'Not set'}</Text>
          </View>
        </View>

        {/* Package & Usage Section */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>PACKAGE & USAGE</Text>
        <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {loadingPackage ? (
            <View style={styles.packageLoadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.packageLoadingText, { color: colors.textSecondary }]}>
                Loading package information...
              </Text>
            </View>
          ) : currentPackage ? (
            <>
              <View style={styles.packageHeader}>
                <View style={styles.packageHeaderLeft}>
                  <Text style={[styles.packageName, { color: colors.text }]}>
                    {currentPackage.package.name}
                  </Text>
                  <Text style={[styles.packageTier, { color: colors.textSecondary }]}>
                    {currentPackage.package.tier || 'Standard'} Package
                  </Text>
                </View>
                {currentPackage.package.tier === 'BUSINESS' && (
                  <View style={[styles.badge, { backgroundColor: '#f59e0b20' }]}>
                    <Text style={[styles.badgeText, { color: '#f59e0b' }]}>BUSINESS</Text>
                  </View>
                )}
              </View>

              {currentPackage.endsAt && (
                <View style={[styles.packageInfoRow, { borderTopColor: colors.border }]}>
                  <Text style={[styles.packageInfoLabel, { color: colors.textSecondary }]}>Expires:</Text>
                  <Text style={[styles.packageInfoValue, { color: colors.text }]}>
                    {formatDate(currentPackage.endsAt)}
                  </Text>
                </View>
              )}

              {/* Phone Transactions Usage */}
              <View style={[styles.usageItem, { borderTopColor: colors.border }]}>
                <View style={styles.usageHeader}>
                  <Text style={[styles.usageLabel, { color: colors.text }]}>Phone Transactions</Text>
                  <Text style={[styles.usageStats, { color: colors.textSecondary }]}>
                    {currentPackage.phoneTxnsRemaining === null
                      ? 'Unlimited'
                      : `${currentPackage.phoneTxnsRemaining} / ${currentPackage.package.maxPhoneTxns || 0}`}
                  </Text>
                </View>
                {currentPackage.phoneTxnsRemaining !== null && currentPackage.package.maxPhoneTxns && (
                  <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${getRemainingPercentage(
                            currentPackage.phoneTxnsRemaining,
                            currentPackage.package.maxPhoneTxns
                          )}%`,
                          backgroundColor: colors.primary,
                        },
                      ]}
                    />
                  </View>
                )}
              </View>

              {/* Verified Transactions Usage */}
              <View style={[styles.usageItem, { borderTopColor: colors.border }]}>
                <View style={styles.usageHeader}>
                  <Text style={[styles.usageLabel, { color: colors.text }]}>Verified Transactions</Text>
                  <Text style={[styles.usageStats, { color: colors.textSecondary }]}>
                    {currentPackage.verifiedTxnsRemaining === null
                      ? 'Unlimited'
                      : `${currentPackage.verifiedTxnsRemaining} / ${currentPackage.package.maxVerifiedTxns || 0}`}
                  </Text>
                </View>
                {currentPackage.verifiedTxnsRemaining !== null && currentPackage.package.maxVerifiedTxns && (
                  <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${getRemainingPercentage(
                            currentPackage.verifiedTxnsRemaining,
                            currentPackage.package.maxVerifiedTxns
                          )}%`,
                          backgroundColor: colors.primary,
                        },
                      ]}
                    />
                  </View>
                )}
              </View>
            </>
          ) : (
            <View style={styles.noPackageContainer}>
              <Text style={[styles.noPackageText, { color: colors.textSecondary }]}>
                No active package found
              </Text>
            </View>
          )}

          {/* Available Packages */}
          {availablePackages.length > 0 && (
            <View style={[styles.availablePackagesContainer, { borderTopColor: colors.border }]}>
              <Text style={[styles.availablePackagesTitle, { color: colors.text }]}>Available Packages</Text>
              {availablePackages.map((pkg) => (
                <TouchableOpacity
                  key={pkg.id}
                  style={[
                    styles.packageOption,
                    {
                      backgroundColor: currentPackage?.package.id === pkg.id ? colors.primary + '10' : 'transparent',
                      borderColor: currentPackage?.package.id === pkg.id ? colors.primary : colors.border,
                      opacity: activating === pkg.id ? 0.6 : 1,
                    },
                  ]}
                  onPress={() => handleActivatePackage(pkg.id)}
                  disabled={activating === pkg.id || currentPackage?.package.id === pkg.id}
                >
                  <View style={styles.packageOptionContent}>
                    <View style={styles.packageOptionHeader}>
                      <Text style={[styles.packageOptionName, { color: colors.text }]}>
                        {pkg.name}
                      </Text>
                      {pkg.tier && (
                        <View
                          style={[
                            styles.tierBadge,
                            {
                              backgroundColor:
                                pkg.tier === 'BUSINESS' ? '#f59e0b20' : colors.primary + '20',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.tierBadgeText,
                              {
                                color: pkg.tier === 'BUSINESS' ? '#f59e0b' : colors.primary,
                              },
                            ]}
                          >
                            {pkg.tier}
                          </Text>
                        </View>
                      )}
                    </View>
                    {pkg.description && (
                      <Text style={[styles.packageDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                        {pkg.description}
                      </Text>
                    )}
                    <View style={styles.packageFeatures}>
                      <Text style={[styles.featureText, { color: colors.textSecondary }]}>
                        Phone: {pkg.maxPhoneTxns === null ? 'Unlimited' : pkg.maxPhoneTxns}
                      </Text>
                      <Text style={[styles.featureText, { color: colors.textSecondary }]}>
                        Verified: {pkg.maxVerifiedTxns === null ? 'Unlimited' : pkg.maxVerifiedTxns}
                      </Text>
                    </View>
                    {pkg.price !== null && pkg.price !== undefined && (
                      <Text style={[styles.packagePrice, { color: colors.text }]}>
                        ${Number(pkg.price).toFixed(2)}
                        {pkg.billingCycle && ` / ${pkg.billingCycle.toLowerCase()}`}
                      </Text>
                    )}
                  </View>
                  {activating === pkg.id && (
                    <ActivityIndicator size="small" color={colors.primary} style={styles.activatingIndicator} />
                  )}
                  {currentPackage?.package.id === pkg.id && (
                    <View style={[styles.currentBadge, { backgroundColor: colors.primary }]}>
                      <Text style={[styles.currentBadgeText, { color: colors.primaryText }]}>Current</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Business Section */}
        {isBusinessOwner && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>BUSINESS MANAGEMENT</Text>
            <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TouchableOpacity 
                style={styles.listItem}
                onPress={onNavigateToBanks}
              >
                <View style={styles.listItemLeft}>
                  <Building2 size={18} color={colors.textSecondary} />
                  <Text style={[styles.listItemText, { color: colors.text }]}>Linked Banks</Text>
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
                  <Text style={[styles.listItemText, { color: colors.text }]}>Add Employee</Text>
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

        {/* Preferences Section */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>PREFERENCES</Text>
        <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.listItem}>
            <View style={styles.listItemLeft}>
              <RefreshCw size={18} color={colors.textSecondary} />
              <Text style={[styles.listItemText, { color: colors.text }]}>Dark Mode</Text>
            </View>
            <Switch
              value={theme === 'dark'}
              onValueChange={toggleTheme}
              trackColor={{ false: '#767577', true: colors.primary }}
              thumbColor={theme === 'dark' ? '#fff' : '#f4f3f4'}
            />
          </View>
          <View style={[styles.listDivider, { backgroundColor: colors.border }]} />
          <TouchableOpacity 
            style={styles.listItem}
            onPress={() => plan === 'FREE' && Alert.alert('Upgrade', 'Premium features coming soon!')}
          >
            <View style={styles.listItemLeft}>
              <CreditCard size={18} color={colors.textSecondary} />
              <Text style={[styles.listItemText, { color: colors.text }]}>Subscription</Text>
            </View>
            <View style={styles.listItemRight}>
              <Text style={[styles.listItemValue, { color: plan === 'PREMIUM' ? colors.primary : colors.textSecondary }]}>
                {plan === 'PREMIUM' ? 'Premium' : 'Free'}
              </Text>
              <ChevronRight size={18} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* About Section */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>ABOUT</Text>
        <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.listItem}>
            <View style={styles.listItemLeft}>
              <Info size={18} color={colors.textSecondary} />
              <Text style={[styles.listItemText, { color: colors.text }]}>Version</Text>
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
          <Text style={styles.logoutButtonText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={[styles.copyright, { color: colors.textSecondary }]}>
          CheckPay v1.0.0 • Built for Ethiopia
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
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add New Employee</Text>
              <TouchableOpacity onPress={() => setShowAddEmployeeModal(false)}>
                <CloseIcon size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                Share this code or QR with your employee to register them.
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
                <Text style={[styles.qrHint, { color: colors.textSecondary }]}>Employee Invite QR</Text>
              </View>

              <View style={styles.otpContainer}>
                <Text style={[styles.otpLabel, { color: colors.textSecondary }]}>Invite Code</Text>
                <View style={[styles.otpBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.otpText, { color: colors.primary }]}>{employeeOTP}</Text>
                  <TouchableOpacity 
                    onPress={() => {
                      // Copy to clipboard logic would go here
                      Alert.alert('Copied', 'Invite code copied to clipboard');
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
                <Text style={[styles.doneButtonText, { color: colors.primaryText }]}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
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
  packageLoadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  packageLoadingText: {
    marginTop: 8,
    fontSize: 12,
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
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
  availablePackagesContainer: {
    padding: 16,
    borderTopWidth: 1,
  },
  availablePackagesTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
  },
  packageOption: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  packageOptionContent: {
    flex: 1,
  },
  packageOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    flexWrap: 'wrap',
    gap: 6,
  },
  packageOptionName: {
    fontSize: 14,
    fontWeight: '600',
  },
  tierBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tierBadgeText: {
    fontSize: 9,
    fontWeight: '600',
  },
  packageDescription: {
    fontSize: 11,
    marginBottom: 6,
  },
  packageFeatures: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  featureText: {
    fontSize: 11,
  },
  packagePrice: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  activatingIndicator: {
    marginLeft: 8,
  },
  currentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  currentBadgeText: {
    fontSize: 9,
    fontWeight: '600',
  },
});


