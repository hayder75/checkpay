import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { packageAPI } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { Crown, Check, Clock, Shield, AlertCircle, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react-native';
import PaymentModal from '../components/PaymentModal';

interface Props {
  apiKey: string;
}

interface Package {
  id: string;
  name: string;
  description?: string;
  price: number | null;
  billingCycle?: string | null;
  features?: any;
  tier?: string;
  maxPhoneTxns: number | null;
  maxVerifiedTxns: number | null;
}

interface UserPackage {
  id: string;
  package: Package;
  status: string;
  endsAt?: string | null;
  phoneTxnsRemaining: number | null;
  verifiedTxnsRemaining: number | null;
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

export default function PremiumScreen({ apiKey }: Props) {
  const { colors } = useTheme();
  const [currentPackage, setCurrentPackage] = useState<UserPackage | null>(null);
  const [billingMode, setBillingMode] = useState<'COUNT_BASED' | 'FIXED_PRICE'>('COUNT_BASED');
  const [availablePackages, setAvailablePackages] = useState<Package[]>([]);
  const [pendingPurchases, setPendingPurchases] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [myPackageRes, packagesRes, purchasesRes, billingModeRes] = await Promise.all([
        packageAPI.getMyPackage(),
        packageAPI.getPackages(),
        packageAPI.getMyPurchases(),
        packageAPI.getBillingMode().catch(() => ({ success: true, data: { billingMode: 'COUNT_BASED' } })),
      ]);

      const mode = billingModeRes?.data?.billingMode || packagesRes?.meta?.billingMode || 'COUNT_BASED';
      setBillingMode(mode);

      if (myPackageRes.success) {
        setCurrentPackage(myPackageRes.data);
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
        setAvailablePackages(businessPackages);
      }

      if (purchasesRes.success) {
        // Show pending purchases so user knows their request is being processed
        const pending = purchasesRes.data.filter(
          (p: PurchaseRequest) => p.status === 'PENDING'
        );
        setPendingPurchases(pending);
      }
    } catch (error) {
      console.error('Error loading premium data:', error);
      Alert.alert('Error', 'Failed to load premium info');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
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
          'Request Submitted!', 
          'Your purchase request has been submitted. Your package will be activated once the transaction is verified by admin.',
          [{ text: 'OK' }]
        );
        loadData(); // Refresh to show the pending purchase
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

  const handleSelectPackage = (pkg: Package) => {
    // Check if there's already a pending purchase for this package
    const hasPending = pendingPurchases.some(p => p.packageId === pkg.id);
    if (hasPending) {
      Alert.alert(
        'Pending Purchase',
        'You already have a pending purchase request for this package. Please wait for admin verification.',
        [{ text: 'OK' }]
      );
      return;
    }
    setSelectedPackage(pkg);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const isPremium = currentPackage?.package?.tier !== 'FREE';
  const isFixedPriceMode = billingMode === 'FIXED_PRICE';

  return (
    <View style={[styles.container, { backgroundColor: '#f7f7f7' }]}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#ff5a5f" />
        }
      >
        <TouchableOpacity style={styles.backButton}>
          <ChevronLeft size={24} color="#000" />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Upgrade to Next-Level</Text>
          <Text style={styles.subtitle}>
            Unlock access to the plan that matches your needs. You can cancel anytime!
          </Text>
        </View>

        <View style={styles.plansList}>
          {availablePackages.map((pkg, index) => {
            const isSelected = selectedPackage?.id === pkg.id;
            const hasPending = pendingPurchases.some(p => p.packageId === pkg.id);
            
            return (
              <TouchableOpacity
                key={pkg.id}
                style={[
                  styles.planCard,
                  isSelected && styles.planCardSelected
                ]}
                onPress={() => handleSelectPackage(pkg)}
                activeOpacity={0.9}
              >
                <View style={styles.planCardHeader}>
                  <View style={styles.planInfo}>
                    <View style={styles.planTitleRow}>
                      <Text style={styles.planTitle}>{pkg.name}</Text>
                      {isSelected && (
                        <View style={styles.tierBadge}>
                          <Text style={styles.tierBadgeText}>
                            {pkg.tier || 'Basic'}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.planSubtitle}>
                      {pkg.description || 'Flexible monthly access, cancel anytime'}
                    </Text>
                    <Text style={styles.planPrice}>
                      ${pkg.price} <Text style={styles.planPeriod}>/ {pkg.billingCycle?.toLowerCase().replace('_', ' ') || 'month'}</Text>
                    </Text>
                  </View>
                  {!isSelected && <ChevronRight size={20} color="#ccc" />}
                </View>

                {isSelected && (
                  <View style={styles.expandedContent}>
                    <View style={styles.featuresList}>
                      {isFixedPriceMode ? (
                        <View style={styles.featureItem}>
                          <Check size={16} color="#000" />
                          <Text style={styles.featureText}>Unlimited transactions while package is active</Text>
                        </View>
                      ) : (
                        <>
                          <View style={styles.featureItem}>
                            <Check size={16} color="#000" />
                            <Text style={styles.featureText}>
                              {pkg.maxPhoneTxns === null ? 'Unlimited' : pkg.maxPhoneTxns} Phone transactions
                            </Text>
                          </View>
                          <View style={styles.featureItem}>
                            <Check size={16} color="#000" />
                            <Text style={styles.featureText}>
                              {pkg.maxVerifiedTxns === null ? 'Unlimited' : pkg.maxVerifiedTxns} Verified transactions
                            </Text>
                          </View>
                        </>
                      )}
                      <View style={styles.featureItem}>
                        <Check size={16} color="#000" />
                        <Text style={styles.featureText}>
                          Secure verification
                        </Text>
                      </View>
                      <View style={styles.featureItem}>
                        <Check size={16} color="#000" />
                        <Text style={styles.featureText}>
                          Priority support
                        </Text>
                      </View>
                    </View>
                    
                    <Text style={styles.upgradeHint}>
                      Need higher limits? Upgrade to Plus.
                    </Text>
                  </View>
                )}

                {hasPending && (
                  <View style={styles.pendingOverlay}>
                    <Clock size={16} color="#f59e0b" />
                    <Text style={styles.pendingText}>Verification Pending</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[
              styles.primaryButton,
              !selectedPackage && styles.primaryButtonDisabled
            ]}
            onPress={() => selectedPackage && setShowPaymentModal(true)}
            disabled={!selectedPackage}
          >
            <Text style={styles.primaryButtonText}>
              {selectedPackage ? `Unlock ${selectedPackage.name}` : 'Select a Plan'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.secondaryButton}
            onPress={() => setSelectedPackage(null)}
          >
            <Text style={styles.secondaryButtonText}>Maybe Later</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <PaymentModal
        visible={showPaymentModal}
        selectedPackage={selectedPackage}
        onSubmit={handlePurchaseSubmit}
        onClose={() => setShowPaymentModal(false)}
        isSubmitting={purchasing}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  backButton: {
    padding: 20,
    paddingTop: 50,
  },
  header: {
    paddingHorizontal: 24,
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  plansList: {
    paddingHorizontal: 24,
    gap: 16,
  },
  planCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  planCardSelected: {
    borderColor: '#ff5a5f',
    borderWidth: 2,
  },
  planCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planInfo: {
    flex: 1,
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  tierBadge: {
    backgroundColor: '#000',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tierBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  planSubtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
  },
  planPrice: {
    fontSize: 20,
    fontWeight: '800',
    color: '#000',
  },
  planPeriod: {
    fontSize: 14,
    fontWeight: '400',
    color: '#888',
  },
  expandedContent: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  featuresList: {
    gap: 12,
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  upgradeHint: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
  },
  pendingOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    backgroundColor: '#fffbeb',
    padding: 8,
    borderRadius: 8,
  },
  pendingText: {
    fontSize: 12,
    color: '#d97706',
    fontWeight: '600',
  },
  actionsContainer: {
    padding: 24,
    marginTop: 20,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#ff5a5f',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff5a5f',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryButtonDisabled: {
    backgroundColor: '#ccc',
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryButton: {
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
});



