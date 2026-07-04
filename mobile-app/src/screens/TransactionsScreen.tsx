import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
  AppState,
  AppStateStatus,
} from 'react-native';
import { RefreshCw, ArrowDown, ArrowUp, X, CheckCircle2, Filter, BarChart3, Coins } from 'lucide-react-native';
import { storage } from '../services/storage';
import { smsService, LocalTransaction } from '../services/smsService';
import { useTheme } from '../contexts/ThemeContext';
import { dashboardAPI } from '../services/api';
import TransactionDetailsModal from '../components/TransactionDetailsModal';
import VerifyPaymentsScreen from './VerifyPaymentsScreen';
import { dedupeTransactionsByIdentity } from '../utils/transactionDedup';
import { useTranslation } from 'react-i18next';
import BankLogo from '../components/BankLogo';
import { getBankLogosMap } from '../utils/bankLogoHelpers';

interface Props {
  apiKey?: string | null;
  onNavigateToReports?: () => void;
}

type TransactionsTab = 'transactions' | 'verify' | 'cash';

type LocalTransactionWithMeta = LocalTransaction & {
  businessId?: string | null;
  businessName?: string | null;
};

const TRANSACTIONS_CACHE_TTL_MS = 2 * 60 * 1000;

let transactionsScreenMemoryCache: {
  transactions: LocalTransactionWithMeta[];
  cachedAt: number;
} | null = null;

export default function TransactionsScreen({ apiKey, onNavigateToReports }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TransactionsTab>('verify');
  const [transactions, setTransactions] = useState<LocalTransactionWithMeta[]>(() => transactionsScreenMemoryCache?.transactions || []);
  const [bankFilter, setBankFilter] = useState<string>('all');
  const [businessFilter, setBusinessFilter] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<LocalTransactionWithMeta | null>(null);
  const [showBankPicker, setShowBankPicker] = useState(false);
  const [showBusinessPicker, setShowBusinessPicker] = useState(false);
  const [cashPayments, setCashPayments] = useState<any[]>([]);
  const [cashLoading, setCashLoading] = useState(false);
  const [logosMap, setLogosMap] = useState<Record<string, string>>({});

  useEffect(() => {
    checkAuth();
    loadTransactions();
    loadCashPayments();
    
    const loadLogos = async () => {
      try {
        const map = await getBankLogosMap();
        setLogosMap(map);
      } catch (err) {
        console.error('Failed to load bank logos in TransactionsScreen', err);
      }
    };
    loadLogos();
    
    // Refresh when app comes to foreground
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        console.log('🔄 [TransactionsScreen] App came to foreground, refreshing transactions');
        loadTransactions();
        loadCashPayments();
        loadLogos();
      }
    });
    
    return () => {
      subscription.remove();
    };
  }, []);

  const checkAuth = async () => {
    const token = await storage.getToken();
    setIsAuthenticated(!!token);
  };

  const loadCashPayments = async () => {
    setCashLoading(true);
    try {
      const businessId = await storage.getBusinessId();
      const response = await dashboardAPI.getCashPayments(
        businessId ? { businessId, limit: 50 } : { limit: 50 }
      );
      if (response?.success) {
        const items = Array.isArray(response.data)
          ? response.data
          : response.data?.items || [];
        setCashPayments(items);
      }
    } catch (error) {
      console.error('Error loading cash payments:', error);
    } finally {
      setCashLoading(false);
    }
  };

  const loadTransactions = async (forceRefresh: boolean = false) => {
    try {
      // First load local transactions as fallback
      let txs: LocalTransactionWithMeta[] = (await storage.getLocalTransactions()) as LocalTransactionWithMeta[];
      
      // Try to fetch from backend if authenticated (backend is source of truth)
      const token = await storage.getToken();
      if (token) {
        const lastSyncAt = await storage.getTransactionsLastSyncAt();
        const cacheIsFresh = Date.now() - lastSyncAt < TRANSACTIONS_CACHE_TTL_MS;

        if (!forceRefresh && cacheIsFresh) {
          // Keep local snapshot to avoid unnecessary backend refetches on each open.
          txs = txs.filter(t => t.amount > 0);
          txs = dedupeTransactionsByIdentity(txs);
          txs.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
          setTransactions(txs);
          // Keep cached snapshot visible while refreshing from backend in background.
        }

        try {
          const response = await dashboardAPI.getTransactions({ limit: 100 });
          if (response.success && response.data) {
            const backendTxs = Array.isArray(response.data) 
              ? response.data 
              : response.data.transactions || [];
            
            // Convert backend transactions to LocalTransaction format
            const convertedTxs: LocalTransactionWithMeta[] = backendTxs.map((tx: any) => {
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
              let patternValue = 'Backend Pattern';
              if (typeof tx.pattern === 'string') {
                patternValue = tx.pattern;
              } else if (tx.pattern && typeof tx.pattern === 'object') {
                patternValue = tx.pattern.name || tx.pattern.bank || 'Backend Pattern';
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
                smsText: tx.smsText || '',
                receivedAt: tx.createdAt || tx.receivedAt || new Date().toISOString(),
                synced: true,
                isValidated: tx.isValidated || false,
                createdAt: tx.createdAt || new Date().toISOString(),
                businessId: tx.businessId || tx.business?.id || null,
                businessName: tx.business?.name || tx.businessName || null,
              };
            });
            
            // Use backend transactions as primary source, merge with local unsynced ones
            const backendTxnIds = new Set(convertedTxs.map(t => t.txnId));
            const unsyncedLocalTxs = txs.filter(t => !t.synced && !backendTxnIds.has(t.txnId));
            txs = [...convertedTxs, ...unsyncedLocalTxs];
            await storage.setLocalTransactions(txs);
            await storage.setTransactionsLastSyncAt(Date.now());
            
            console.log(`📥 [TransactionsScreen] Fetched ${backendTxs.length} transactions from backend, total: ${txs.length}`);
          } else {
            console.warn('⚠️ [TransactionsScreen] Backend response not successful:', response);
          }
        } catch (error) {
          console.error('❌ [TransactionsScreen] Error fetching transactions from backend:', error);
          // Continue with local transactions if backend fetch fails
        }
      } else {
        console.log('ℹ️ [TransactionsScreen] No auth token, using local transactions only');
      }
      
      // Filter out withdrawals - only show deposits (positive amounts)
      txs = txs.filter(t => t.amount > 0);
      txs = dedupeTransactionsByIdentity(txs);
      
      // Sort by most recent first
      txs.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
      
      console.log(`📊 [TransactionsScreen] Final transaction count: ${txs.length}`);
      setTransactions(txs);
      transactionsScreenMemoryCache = {
        transactions: txs,
        cachedAt: Date.now(),
      };
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadTransactions(true),
      loadCashPayments()
    ]);
    if (smsService.isActive()) {
      try {
        await smsService.manualCheck();
      } catch (error) {
        console.log('Error checking SMS:', error);
      }
    }
    if (isAuthenticated) {
      try {
        await syncUnsyncedTransactions(false);
      } catch (error) {
        // Error already handled in syncUnsyncedTransactions
      }
    }
    setRefreshing(false);
  };

  const syncUnsyncedTransactions = async (showSuccessAlert: boolean = true) => {
    const token = await storage.getToken();
    if (!token) {
      Alert.alert(t('transactions.notSignedIn'), t('transactions.signInToSync'));
      return;
    }

    setSyncing(true);
    try {
      const unsyncedCount = transactions.filter(t => !t.synced).length;
      if (unsyncedCount === 0) {
        Alert.alert(t('transactions.allSyncedTitle'), t('transactions.allSyncedMessage'));
        return;
      }

      const { testAPIConnection } = await import('../services/api');
      const connectionTest = await testAPIConnection();
      if (!connectionTest.success) {
        Alert.alert(
          'Connection Error',
          connectionTest.message + '\n\nPlease check:\n- Backend is running\n- Correct API URL in config\n- Network connection'
        );
        return;
      }

      await smsService.syncAllUnsyncedTransactions();
      
      // Wait a moment for backend to process, then refresh multiple times to ensure we get the data
      await new Promise(resolve => setTimeout(resolve, 1000));
      await loadTransactions();
      
      // Refresh again after another short delay to ensure backend has processed
      await new Promise(resolve => setTimeout(resolve, 1000));
      await loadTransactions();
      
      console.log('✅ [TransactionsScreen] Sync complete, transactions refreshed');
      if (showSuccessAlert) {
        Alert.alert(t('common.success'), t('transactions.syncSuccessMessage', { count: unsyncedCount }));
      }
    } catch (error: any) {
      console.error('Error syncing transactions:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Failed to sync transactions';
      Alert.alert(
        t('transactions.syncFailedTitle'),
        errorMsg + '\n\nCheck console logs for details.'
      );
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const month = months[date.getMonth()];
    const day = date.getDate();
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const minutesStr = minutes.toString().padStart(2, '0');
    return `${month} ${day}, ${hours}:${minutesStr} ${ampm}`;
  };

  // Extract sender name from SMS text if not already captured
  const extractSenderFromSMS = (smsText: string): string | null => {
    if (!smsText) return null;
    
    const senderPatterns = [
      // "from NAME (phone)" or "from NAME"
      /from\s+([A-Za-z\s]+?)(?:\s*\(|\s+on\s+|\s+at\s+|,|\.|$)/i,
      // "received ... from NAME"
      /received\s+.*?from\s+([A-Za-z\s]+?)(?:\s*\(|\s+on\s+|\s+at\s+|,|\.|$)/i,
      // "credited ... from NAME"
      /credited\s+.*?from\s+([A-Za-z\s]+?)(?:\s*\(|\s+on\s+|\s+at\s+|,|\.|$)/i,
    ];
    
    for (const pattern of senderPatterns) {
      const match = smsText.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return null;
  };

  const getDisplayName = (item: LocalTransaction): string => {
    // First try to extract sender from SMS text if sender is Unknown or empty
    if ((!item.sender || item.sender === 'Unknown' || item.sender === '') && item.smsText) {
      const extractedSender = extractSenderFromSMS(item.smsText);
      if (extractedSender) return extractedSender;
    }
    
    // Prefer sender name (if valid), then bank name, then sendFrom, then pattern name
    if (item.sender && item.sender !== 'Unknown' && item.sender !== '') return item.sender;
    if (item.bank && item.bank !== 'Unknown') return item.bank;
    if (item.sendFrom) return item.sendFrom;
    if (item.pattern && item.pattern !== 'Institution Pattern') return item.pattern;
    return t('transactions.transactionFallback');
  };

  const availableBanks = Array.from(
    new Set(transactions.map(tx => (tx.bank && tx.bank.trim() ? tx.bank.trim() : t('transactions.unknownBank'))))
  ).sort((a, b) => a.localeCompare(b));

  const availableBusinesses = Array.from(
    new Set(
      transactions
        .map(tx => {
          if (tx.businessName && tx.businessName.trim()) return tx.businessName.trim();
          if (tx.businessId && tx.businessId.trim()) return `Business ${tx.businessId.slice(0, 6)}`;
          return 'No Business';
        })
    )
  ).sort((a, b) => a.localeCompare(b));

  const filteredTransactions = transactions.filter((tx) => {
    // Only show verified transactions in the Transactions tab
    if (!tx.isValidated) return false;

    const txBank = tx.bank && tx.bank.trim() ? tx.bank.trim() : t('transactions.unknownBank');
    const txBusiness = tx.businessName && tx.businessName.trim()
      ? tx.businessName.trim()
      : tx.businessId && tx.businessId.trim()
      ? `Business ${tx.businessId.slice(0, 6)}`
      : 'No Business';

    const bankOk = bankFilter === 'all' || txBank === bankFilter;
    const businessOk = businessFilter === 'all' || txBusiness === businessFilter;
    return bankOk && businessOk;
  });

  const hasActiveFilters = bankFilter !== 'all' || businessFilter !== 'all';

  const renderTransaction = ({ item }: { item: LocalTransaction }) => {
    const isIncome = item.amount > 0;
    const displayName = getDisplayName(item);
    
    return (
      <TouchableOpacity 
        style={styles.transactionItem}
        onPress={() => setSelectedTransaction(item)}
        activeOpacity={0.7}
      >
        <View style={styles.transactionLeft}>
            <BankLogo
              bankName={item.bank}
              logoUrl={logosMap[item.bank?.toLowerCase() || '']}
              size={44}
              containerStyle={{ marginRight: 16 }}
            />
            <View style={styles.transactionInfo}>
              {item.sender && item.sender !== 'Unknown' && item.sender !== '' && (
                <Text style={[styles.transactionSender, { color: colors.text }]} numberOfLines={1}>
                  {item.sender}
                </Text>
              )}
              <Text style={[styles.transactionBank, { color: colors.textSecondary }]} numberOfLines={1}>
                {item.bank || t('transactions.unknownBank')}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                {(item as LocalTransactionWithMeta).businessName && (
                  <>
                    <Text style={[styles.transactionTime, { color: colors.textSecondary }]} numberOfLines={1}>
                      {(item as LocalTransactionWithMeta).businessName}
                    </Text>
                    <Text style={[styles.transactionTime, { color: colors.textSecondary }]}>·</Text>
                  </>
                )}
                <Text style={[styles.transactionTime, { color: colors.textSecondary }]}>
                  {formatDate(item.receivedAt)}
                </Text>
              </View>
            </View>
        </View>
          <View style={styles.transactionRight}>
            <Text style={[styles.transactionAmount, { color: colors.text }]}>
              {item.amount > 0 ? '+' : ''}{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <Text style={styles.currencyUnitSmall}> {t('common.currency')}</Text>
            </Text>
            <View style={[
              styles.statusTag, 
              { 
                backgroundColor: item.isValidated ? colors.darkGreen + '10' : '#fff7ed',
                borderColor: item.isValidated ? colors.darkGreen + '30' : '#fdba74',
              }
            ]}>
              <Text style={[
                styles.statusTagText, 
                { color: item.isValidated ? colors.darkGreen : '#c2410c' }
              ]}>
                {item.isValidated ? t('transactions.verified') : t('transactions.pending')}
              </Text>
            </View>
            {!item.synced && (
                <View style={styles.unsyncedDot} />
            )}
        </View>
      </TouchableOpacity>
    );
  };

  const unsyncedCount = transactions.filter(t => !t.synced).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Tab Header */}
      <View style={styles.tabHeader}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'verify' && styles.activeTabButton,
            activeTab === 'verify' && { borderBottomColor: colors.primary }
          ]}
          onPress={() => setActiveTab('verify')}
        >
          <CheckCircle2 
            size={16} 
            color={activeTab === 'verify' ? colors.primary : colors.textSecondary}
            style={{ marginRight: 6 }}
          />
          <Text style={[
            styles.tabButtonText,
            { color: activeTab === 'verify' ? colors.primary : colors.textSecondary }
          ]}>
            {t('verifyPayments.title')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'transactions' && styles.activeTabButton,
            activeTab === 'transactions' && { borderBottomColor: colors.primary }
          ]}
          onPress={() => setActiveTab('transactions')}
        >
          <Text style={[
            styles.tabButtonText,
            { color: activeTab === 'transactions' ? colors.primary : colors.textSecondary }
          ]}>
            {t('navigation.history')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'cash' && styles.activeTabButton,
            activeTab === 'cash' && { borderBottomColor: colors.primary }
          ]}
          onPress={() => setActiveTab('cash')}
        >
          <Coins 
            size={16} 
            color={activeTab === 'cash' ? colors.primary : colors.textSecondary}
            style={{ marginRight: 6 }}
          />
          <Text style={[
            styles.tabButtonText,
            { color: activeTab === 'cash' ? colors.primary : colors.textSecondary }
          ]}>
            Cash
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'transactions' && (
        <>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={[styles.subtitleCount, { color: colors.textSecondary }]}>
                {filteredTransactions.length} shown
              </Text>
            </View>
            {isAuthenticated && unsyncedCount > 0 && (
              <TouchableOpacity
                onPress={() => syncUnsyncedTransactions()}
                disabled={syncing}
                style={[styles.syncButton, { backgroundColor: colors.primary + '10' }]}
              >
                <RefreshCw 
                  size={14} 
                  color={colors.primary} 
                  style={syncing ? { transform: [{ rotate: '180deg' }] } : undefined}
                />
                <Text style={[styles.syncButtonText, { color: colors.primary }]}>
                  Sync ({unsyncedCount})
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: 8,
            paddingHorizontal: 24,
            paddingVertical: 10,
          }}>
            {/* Bank Filter Button */}
            <TouchableOpacity
              onPress={() => setShowBankPicker(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: bankFilter !== 'all' ? colors.primary : colors.border,
                backgroundColor: bankFilter !== 'all' ? colors.primary + '0c' : colors.surface,
              }}
              activeOpacity={0.7}
            >
              <Text style={{
                fontSize: 13,
                fontWeight: '600',
                color: bankFilter !== 'all' ? colors.primary : colors.text,
                marginRight: 6,
              }}>
                {bankFilter === 'all' ? 'All Banks' : bankFilter}
              </Text>
              <Text style={{ fontSize: 9, color: bankFilter !== 'all' ? colors.primary : colors.textSecondary }}>▼</Text>
            </TouchableOpacity>

            {/* Business Filter Button */}
            <TouchableOpacity
              onPress={() => setShowBusinessPicker(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: businessFilter !== 'all' ? colors.primary : colors.border,
                backgroundColor: businessFilter !== 'all' ? colors.primary + '0c' : colors.surface,
              }}
              activeOpacity={0.7}
            >
              <Text style={{
                fontSize: 13,
                fontWeight: '600',
                color: businessFilter !== 'all' ? colors.primary : colors.text,
                marginRight: 6,
              }}>
                {businessFilter === 'all' ? 'All Businesses' : businessFilter}
              </Text>
              <Text style={{ fontSize: 9, color: businessFilter !== 'all' ? colors.primary : colors.textSecondary }}>▼</Text>
            </TouchableOpacity>

            {/* Clear Button */}
            {hasActiveFilters && (
              <TouchableOpacity
                onPress={() => {
                  setBankFilter('all');
                  setBusinessFilter('all');
                }}
                style={{
                  padding: 8,
                  borderRadius: 12,
                  backgroundColor: colors.border + '33',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
                activeOpacity={0.7}
              >
                <X size={14} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {filteredTransactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('transactions.noMatchingFilters')}</Text>
            </View>
          ) : (
            <FlatList
              data={filteredTransactions}
              renderItem={renderTransaction}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
              }
              showsVerticalScrollIndicator={false}
            />
          )}
        </>
      )}

      {activeTab === 'verify' && (
        <VerifyPaymentsScreen apiKey={apiKey} />
      )}

      {activeTab === 'cash' && (
        <FlatList
          data={cashPayments}
          keyExtractor={(item) => item.id || String(Math.random())}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing || cashLoading} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Coins size={36} color={colors.textSecondary} style={{ marginBottom: 12, opacity: 0.5 }} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No cash payments recorded yet.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const dateStr = item.paymentDate ? new Date(item.paymentDate).toLocaleString() : 'Unknown date';
            const amountStr = Number(item.amount || 0).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });
            return (
              <View style={[styles.cashCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.cashHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={[styles.cashIconWrap, { backgroundColor: colors.primary + '18' }]}>
                      <Coins size={18} color={colors.primary} />
                    </View>
                    <View>
                      <Text style={[styles.cashAmount, { color: colors.text }]}>
                        {amountStr} {item.currency || 'ETB'}
                      </Text>
                      <Text style={[styles.cashMeta, { color: colors.textSecondary }]}>
                        {item.side === 'EMPLOYEE' ? 'Employee Cash' : 'Employer Cash'}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.cashDate, { color: colors.textSecondary }]}>
                    {dateStr.split(',')[0]}
                  </Text>
                </View>
                {item.note ? (
                  <Text style={[styles.cashNote, { color: colors.textSecondary }]}>
                    {item.note}
                  </Text>
                ) : null}
                {(item.business?.name || item.employee?.name) && (
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 6 }}>
                    {item.business?.name ? (
                      <Text style={[styles.cashSubMeta, { color: colors.textSecondary }]}>
                        Biz: {item.business.name}
                      </Text>
                    ) : null}
                    {item.employee?.name ? (
                      <Text style={[styles.cashSubMeta, { color: colors.textSecondary }]}>
                        Emp: {item.employee.name}
                      </Text>
                    ) : null}
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      {/* Transaction Detail Modal */}
      <TransactionDetailsModal
        visible={selectedTransaction !== null}
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
      />

      {/* Bank Picker Modal */}
      <Modal visible={showBankPicker} transparent animationType="fade" onRequestClose={() => setShowBankPicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowBankPicker(false)}>
          <View style={[styles.pickerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.pickerTitle, { color: colors.text }]}>Select Bank</Text>
            <ScrollView style={{ maxHeight: 250 }}>
              <TouchableOpacity
                style={[styles.pickerItem, bankFilter === 'all' && { backgroundColor: colors.primary + '18' }]}
                onPress={() => { setBankFilter('all'); setShowBankPicker(false); }}
              >
                <Text style={[styles.pickerItemText, { color: bankFilter === 'all' ? colors.primary : colors.text }]}>All Banks</Text>
              </TouchableOpacity>
              {availableBanks.map(bank => (
                <TouchableOpacity
                  key={`picker-bank-${bank}`}
                  style={[styles.pickerItem, bankFilter === bank && { backgroundColor: colors.primary + '18' }]}
                  onPress={() => { setBankFilter(bank); setShowBankPicker(false); }}
                >
                  <Text style={[styles.pickerItemText, { color: bankFilter === bank ? colors.primary : colors.text }]}>{bank}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Business Picker Modal */}
      <Modal visible={showBusinessPicker} transparent animationType="fade" onRequestClose={() => setShowBusinessPicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowBusinessPicker(false)}>
          <View style={[styles.pickerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.pickerTitle, { color: colors.text }]}>Select Business</Text>
            <ScrollView style={{ maxHeight: 250 }}>
              <TouchableOpacity
                style={[styles.pickerItem, businessFilter === 'all' && { backgroundColor: colors.primary + '18' }]}
                onPress={() => { setBusinessFilter('all'); setShowBusinessPicker(false); }}
              >
                <Text style={[styles.pickerItemText, { color: businessFilter === 'all' ? colors.primary : colors.text }]}>All Businesses</Text>
              </TouchableOpacity>
              {availableBusinesses.map(biz => (
                <TouchableOpacity
                  key={`picker-biz-${biz}`}
                  style={[styles.pickerItem, businessFilter === biz && { backgroundColor: colors.primary + '18' }]}
                  onPress={() => { setBusinessFilter(biz); setShowBusinessPicker(false); }}
                >
                  <Text style={[styles.pickerItemText, { color: businessFilter === biz ? colors.primary : colors.text }]}>{biz}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Reports Floating Action Button */}
      {onNavigateToReports && (
        <TouchableOpacity
          style={[
            styles.fab,
            {
              backgroundColor: colors.primary,
              shadowColor: colors.primary,
            },
          ]}
          onPress={onNavigateToReports}
          activeOpacity={0.85}
        >
          <BarChart3 size={24} color={colors.primaryText || '#fff'} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingTop: 60,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabButton: {
    borderBottomWidth: 2,
  },
  tabButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subtitleCount: {
    fontSize: 13,
    fontWeight: '600',
  },
  filtersWrapper: {
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  filterIconWrap: {
    marginRight: 2,
  },
  filterDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#d1d5db',
    marginHorizontal: 2,
  },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  clearFiltersText: {
    fontSize: 10,
    fontWeight: '600',
  },
  filterChip: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  currencyUnitSmall: {
    fontSize: 10,
    fontWeight: '600',
    opacity: 0.6,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  syncButtonText: {
    fontSize: 12,
    fontWeight: '600',
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
    borderBottomColor: '#f0f0f0',
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
  },
  transactionRight: {
      alignItems: 'flex-end',
      gap: 4,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  unsyncedDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#ef4444',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  statusTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusTagText: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerCard: {
    width: '80%',
    maxWidth: 320,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 8,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  pickerItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 4,
  },
  pickerItemText: {
    fontSize: 14,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 999,
  },
  cashCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cashHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cashIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cashAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  cashMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  cashDate: {
    fontSize: 12,
  },
  cashNote: {
    fontSize: 13,
    marginTop: 8,
    opacity: 0.85,
    fontStyle: 'italic',
  },
  cashSubMeta: {
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.6,
  },
});
