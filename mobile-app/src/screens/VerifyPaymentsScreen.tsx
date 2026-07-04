import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { CheckCircle2, RefreshCw, ArrowDown, ArrowUp, Clock } from 'lucide-react-native';
import { storage } from '../services/storage';
import { useTheme } from '../contexts/ThemeContext';
import { dashboardAPI, verifyTransaction } from '../services/api';
import { dedupeTransactionsByIdentity } from '../utils/transactionDedup';
import { useTranslation } from 'react-i18next';
import BankLogo from '../components/BankLogo';
import { getBankLogosMap } from '../utils/bankLogoHelpers';

interface Props {
  apiKey?: string | null;
}

interface Transaction {
  id: string;
  txnId: string;
  amount: number;
  sender: string;
  sendFrom?: string | null;
  sendTo?: string | null;
  bank?: string | null;
  pattern?: string;
  smsText?: string;
  receivedAt: string;
  createdAt: string;
  verifiedAt?: string | null;
  source?: 'SMS' | 'OCR' | 'MANUAL' | 'NOTIFICATION';
  isPendingRequest?: boolean;
  pendingReason?: string;
}

const TRANSACTIONS_CACHE_TTL_MS = 2 * 60 * 1000;

const UNKNOWN_VALUE_TOKENS = new Set(['', 'unknown', 'unknown bank', 'manual review']);

const normalizeLabel = (value?: string | null): string => String(value || '').trim().toLowerCase();

const isMeaningfulLabel = (value?: string | null): boolean => {
  const normalized = normalizeLabel(value);
  return !!normalized && !UNKNOWN_VALUE_TOKENS.has(normalized);
};

const hasValidTxnId = (txnId?: string | null): boolean => {
  const normalized = String(txnId || '').trim();
  if (!normalized || normalized.length < 4) {
    return false;
  }
  if (normalized.toUpperCase().startsWith('PENDING-')) {
    return false;
  }
  return /\d/.test(normalized);
};

const isEligibleForVerify = (tx: Transaction): boolean => {
  if (tx.isPendingRequest) {
    return false;
  }

  if (!(Number(tx.amount) > 0)) {
    return false;
  }

  if (!hasValidTxnId(tx.txnId)) {
    return false;
  }

  const hasTrustedInstitutionHint = isMeaningfulLabel(tx.bank) || isMeaningfulLabel(tx.pattern);
  if (!hasTrustedInstitutionHint) {
    return false;
  }

  // Notification-sourced rows are more prone to false positives, so require sender + institution hints.
  if (tx.source === 'NOTIFICATION' && !isMeaningfulLabel(tx.sender)) {
    return false;
  }

  return true;
};

export default function VerifyPaymentsScreen({ apiKey }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [verifyingIds, setVerifyingIds] = useState<Set<string>>(new Set());
  const [recentlyVerifiedTxnIds, setRecentlyVerifiedTxnIds] = useState<Set<string>>(new Set());
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [logosMap, setLogosMap] = useState<Record<string, string>>({});

  useEffect(() => {
    checkAuth();
    loadTransactions();

    const loadLogos = async () => {
      try {
        const map = await getBankLogosMap();
        setLogosMap(map);
      } catch (err) {
        console.error('Failed to load bank logos in VerifyPaymentsScreen', err);
      }
    };
    loadLogos();

    // Fast local refresh so newly captured transactions appear quickly.
    const interval = setInterval(() => {
      loadTransactions(false);
    }, 2500);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const buildLocalPendingTransactions = async (): Promise<Transaction[]> => {
    const localTxs = await storage.getLocalTransactions();
    const pendingLocal = (Array.isArray(localTxs) ? localTxs : [])
      .filter((tx: any) => {
        const isDeposit = Number(tx?.amount || 0) > 0;
        const isVerified = !!tx?.isValidated;
        const wasRecentlyVerified = !!tx?.txnId && recentlyVerifiedTxnIds.has(String(tx.txnId));
        return isDeposit && !isVerified && !wasRecentlyVerified;
      })
      .map((tx: any) => ({
        id: tx.id || `local_${tx.txnId}`,
        txnId: tx.txnId || tx.id,
        amount: tx.amount || 0,
        sender: tx.sender || '',
        sendFrom: tx.sendFrom || null,
        sendTo: tx.sendTo || null,
        bank: tx.bank || null,
        pattern: tx.pattern || 'Local Pattern',
        smsText: tx.smsText || '',
        receivedAt: tx.receivedAt || tx.createdAt || new Date().toISOString(),
        createdAt: tx.createdAt || new Date().toISOString(),
        verifiedAt: null,
        source: tx.source || 'SMS',
      }));

    return dedupeTransactionsByIdentity(pendingLocal);
  };

  const markLocalTransactionVerified = async (txnId: string) => {
    try {
      const localTxs = await storage.getLocalTransactions();
      if (!Array.isArray(localTxs) || localTxs.length === 0) {
        return;
      }

      let changed = false;
      const updated = localTxs.map((tx: any) => {
        if (String(tx?.txnId || '') !== String(txnId)) {
          return tx;
        }

        changed = true;
        return {
          ...tx,
          isValidated: true,
          verifiedAt: new Date().toISOString(),
          synced: true,
        };
      });

      if (changed) {
        await storage.setLocalTransactions(updated);
        await storage.setTransactionsLastSyncAt(Date.now());
      }
    } catch (error) {
      console.error('Error marking local transaction as verified:', error);
    }
  };

  const mergeAndSetTransactions = (
    pendingAsTransactions: Transaction[],
    localPending: Transaction[],
    backendUnverified: Transaction[]
  ) => {
    const merged = dedupeTransactionsByIdentity([
      ...pendingAsTransactions,
      ...localPending,
      ...backendUnverified,
    ]).filter(isEligibleForVerify);
    merged.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
    setTransactions(merged);
  };

  const checkAuth = async () => {
    const token = await storage.getToken();
    setIsAuthenticated(!!token);
  };

  const loadTransactions = async (forceRefresh: boolean = false) => {
    try {
      // Keep Verify focused only on fully parsable payment candidates.
      const pendingAsTransactions: Transaction[] = [];

      const localPending = await buildLocalPendingTransactions();

      const token = await storage.getToken();
      if (!token) {
        mergeAndSetTransactions(pendingAsTransactions, localPending, []);
        setLoading(false);
        return;
      }

      const lastSyncAt = await storage.getTransactionsLastSyncAt();
      const cacheIsFresh = Date.now() - lastSyncAt < TRANSACTIONS_CACHE_TTL_MS;
      if (!forceRefresh && cacheIsFresh) {
        mergeAndSetTransactions(pendingAsTransactions, localPending, []);
        setLoading(false);
        return;
      }

      try {
        const response = await dashboardAPI.getTransactions({ limit: 200 });
        if (response.success && response.data) {
          const backendTxs = Array.isArray(response.data) 
            ? response.data 
            : response.data.transactions || [];
          
          // Filter to only show unverified transactions (verifiedAt is null or undefined)
          const unverifiedTxs: Transaction[] = backendTxs
            .filter((tx: any) => !tx.verifiedAt)
            .map((tx: any) => {
              // Handle sender - can be string or object {name, bank}
              let senderValue = '';
              if (typeof tx.sender === 'string') {
                senderValue = tx.sender;
              } else if (tx.sender && typeof tx.sender === 'object') {
                senderValue = tx.sender.name || tx.sender.bank || '';
              }
              
              // Handle bank - can be string or object
              let bankValue = null;
              if (typeof tx.bank === 'string') {
                bankValue = tx.bank;
              } else if (tx.bank && typeof tx.bank === 'object') {
                bankValue = tx.bank.name || tx.bank.bank || null;
              } else if (tx.receiverBank) {
                bankValue = typeof tx.receiverBank === 'string' ? tx.receiverBank : tx.receiverBank?.name || null;
              }
              
              // Handle pattern - can be string or object
              let patternValue = 'Unknown Pattern';
              if (typeof tx.pattern === 'string') {
                patternValue = tx.pattern;
              } else if (tx.pattern && typeof tx.pattern === 'object') {
                patternValue = tx.pattern.name || 'Unknown Pattern';
              }
              
              return {
                id: tx.id || `backend_${tx.txnId}`,
                txnId: tx.txnId || tx.id,
                amount: tx.amount || 0,
                sender: senderValue,
                sendFrom: tx.sendFrom || null,
                sendTo: tx.sendTo || null,
                bank: bankValue,
                pattern: patternValue,
                smsText: '', // SMS text is not stored in Transaction model
                receivedAt: tx.receivedAt || tx.createdAt || new Date().toISOString(),
                createdAt: tx.createdAt || new Date().toISOString(),
                verifiedAt: tx.verifiedAt || null,
                source: tx.source || 'SMS',
              };
            });
          
          const dedupedTransactions = dedupeTransactionsByIdentity(unverifiedTxs);
          mergeAndSetTransactions(pendingAsTransactions, localPending, dedupedTransactions);
        }
      } catch (error) {
        console.error('Error fetching transactions from backend:', error);
        mergeAndSetTransactions(pendingAsTransactions, localPending, []);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTransactions(true);
    setRefreshing(false);
  };

  const handleVerify = async (transaction: Transaction) => {
    if (transaction.isPendingRequest) {
      Alert.alert(
        t('verifyPayments.manualReviewNeededTitle', { defaultValue: 'Manual Review Needed' }),
        t('verifyPayments.manualReviewNeededMessage', { defaultValue: 'This request was saved because notification parsing did not extract a complete transaction. Business owner can review and verify it manually anytime.' })
      );
      return;
    }

    if (verifyingIds.has(transaction.id)) {
      return; // Already verifying
    }

    Alert.alert(
      t('verifyPayments.verifyPaymentTitle', { defaultValue: 'Verify Payment' }),
      t('verifyPayments.verifyPaymentMessage', { defaultValue: 'Verify transaction number {{txnId}}?', txnId: transaction.txnId }),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('verifyPayments.verifyButton', { defaultValue: 'Verify' }),
          onPress: async () => {
            setVerifyingIds(prev => new Set(prev).add(transaction.id));
            try {
              const result = await verifyTransaction({ txnId: transaction.txnId });
              
              if (result.success && result.data?.confirmed) {
                setRecentlyVerifiedTxnIds(prev => {
                  const next = new Set(prev);
                  next.add(transaction.txnId);
                  return next;
                });
                setTransactions(prev => prev.filter(tx => tx.txnId !== transaction.txnId));
                await markLocalTransactionVerified(transaction.txnId);

                Alert.alert(
                  t('common.success'),
                  t('verifyPayments.verifySuccessMessage', { defaultValue: 'Transaction number {{txnId}} has been verified.', txnId: transaction.txnId }),
                  [{ text: t('common.done', { defaultValue: 'OK' }), onPress: () => loadTransactions(true) }]
                );
              } else {
                Alert.alert(
                  t('verifyPayments.verificationFailedTitle', { defaultValue: 'Verification Failed' }),
                  result.data?.message || t('verifyPayments.verificationFailedMessage', { defaultValue: 'Transaction not found or could not be verified.' }),
                  [{ text: t('common.done', { defaultValue: 'OK' }) }]
                );
              }
            } catch (error: any) {
              console.error('Error verifying transaction:', error);
              const errorMsg = error.response?.data?.error || error.message || t('verifyPayments.failedVerifyTransaction', { defaultValue: 'Failed to verify transaction' });
              Alert.alert(t('common.error'), errorMsg);
            } finally {
              setVerifyingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(transaction.id);
                return newSet;
              });
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('verifyPayments.justNow', { defaultValue: 'Just now' });
    if (diffMins < 60) return t('verifyPayments.minutesAgo', { defaultValue: '{{count}}m ago', count: diffMins });
    if (diffHours < 24) {
      let hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      const minutesStr = minutes.toString().padStart(2, '0');
      return t('verifyPayments.todayAt', { defaultValue: 'Today, {{time}}', time: `${hours}:${minutesStr} ${ampm}` });
    }
    if (diffDays === 1) return t('verifyPayments.yesterday', { defaultValue: 'Yesterday' });
    if (diffDays < 7) return t('verifyPayments.daysAgo', { defaultValue: '{{count}}d ago', count: diffDays });
    return date.toLocaleDateString();
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const isIncome = item.amount > 0;
    const isVerifying = verifyingIds.has(item.id);
    
    return (
      <View style={[styles.transactionItem, { borderBottomColor: colors.border || '#f0f0f0' }]}>
        <View style={styles.transactionLeft}>
          <BankLogo
            bankName={item.bank}
            logoUrl={logosMap[item.bank?.toLowerCase() || '']}
            size={44}
            containerStyle={{ marginRight: 16 }}
          />
          <View style={styles.transactionInfo}>
            {item.sender && item.sender !== 'Unknown' && (
              <Text style={[styles.transactionSender, { color: colors.text }]}>
                {item.sender}
              </Text>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.transactionBank, { color: colors.textSecondary }]}>
                {item.bank || t('verifyPayments.unknownBank', { defaultValue: 'Unknown Bank' })}
              </Text>
              <Text style={[styles.transactionTime, { color: colors.textSecondary }]}>·</Text>
              <Text style={[styles.transactionTime, { color: colors.textSecondary }]}>
                {formatDate(item.receivedAt)}
              </Text>
            </View>
            <Text style={[styles.transactionId, { color: colors.textSecondary }]}>
              {t('verifyPayments.idLabel', { defaultValue: 'ID: {{txnId}}', txnId: item.txnId })}
            </Text>
          </View>
        </View>
        <View style={styles.transactionRight}>
          <Text style={[styles.transactionAmount, { color: isIncome ? colors.darkGreen : '#ef4444' }]}>
            {isIncome ? '+' : '-'}{Math.abs(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {t('common.currency')}
          </Text>
          <TouchableOpacity
            onPress={() => handleVerify(item)}
            disabled={isVerifying}
            style={[
              styles.verifyButton,
              {
                backgroundColor: isVerifying ? colors.textSecondary : colors.primary,
                opacity: isVerifying ? 0.6 : 1,
              },
            ]}
          >
            {isVerifying ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <CheckCircle2 size={16} color="#fff" />
                <Text style={styles.verifyButtonText}>{t('verifyPayments.verifyButton', { defaultValue: 'Verify' })}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{t('verifyPayments.loadingPayments', { defaultValue: 'Loading payments...' })}</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
        <Clock size={48} color={colors.textSecondary} />
        <Text style={[styles.emptyText, { color: colors.text }]}>{t('verifyPayments.signInToVerify', { defaultValue: 'Please sign in to verify payments' })}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {transactions.length > 0 && (
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textSecondary }}>
            {t('verifyPayments.pendingCount', { defaultValue: '{{count}} pending payments', count: transactions.length })}
          </Text>
        </View>
      )}

      {transactions.length === 0 ? (
        <View style={styles.emptyState}>
          <CheckCircle2 size={64} color={colors.textSecondary} opacity={0.5} />
          <Text style={[styles.emptyText, { color: colors.text }]}>{t('verifyPayments.allVerifiedTitle', { defaultValue: 'All payments verified!' })}</Text>
          <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
            {t('verifyPayments.allVerifiedSubtitle', { defaultValue: 'No payments are waiting for verification' })}
          </Text>
        </View>
      ) : (
        <FlatList
          data={transactions}
          renderItem={renderTransaction}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
  },
  currencyUnitSmall: {
    fontSize: 10,
    fontWeight: '600',
    opacity: 0.6,
  },
  listContent: {
    padding: 20,
    paddingTop: 10,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  transactionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionSender: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  transactionBank: {
    fontSize: 12,
    fontWeight: '500',
  },
  transactionTime: {
    fontSize: 12,
    marginBottom: 2,
  },
  transactionId: {
    fontSize: 11,
    fontFamily: 'monospace',
  },
  transactionRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 100,
    justifyContent: 'center',
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
});

