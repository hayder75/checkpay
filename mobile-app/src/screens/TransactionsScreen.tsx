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
import { CreditCard, RefreshCw, ArrowDown, ArrowUp, X, CheckCircle2 } from 'lucide-react-native';
import { storage } from '../services/storage';
import { smsService, LocalTransaction } from '../services/smsService';
import { useTheme } from '../contexts/ThemeContext';
import { dashboardAPI } from '../services/api';
import TransactionDetailsModal from '../components/TransactionDetailsModal';
import VerifyPaymentsScreen from './VerifyPaymentsScreen';

interface Props {
  apiKey?: string | null;
}

type TransactionsTab = 'transactions' | 'verify';

export default function TransactionsScreen({ apiKey }: Props) {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<TransactionsTab>('transactions');
  const [transactions, setTransactions] = useState<LocalTransaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<LocalTransaction | null>(null);

  useEffect(() => {
    checkAuth();
    loadTransactions();
    const interval = setInterval(loadTransactions, 3000);
    
    // Refresh when app comes to foreground
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        console.log('🔄 [TransactionsScreen] App came to foreground, refreshing transactions');
        loadTransactions();
      }
    });
    
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, []);

  const checkAuth = async () => {
    const token = await storage.getToken();
    setIsAuthenticated(!!token);
  };

  const loadTransactions = async () => {
    try {
      // First load local transactions as fallback
      let txs = await storage.getLocalTransactions();
      
      // Try to fetch from backend if authenticated (backend is source of truth)
      const token = await storage.getToken();
      if (token) {
        try {
          const response = await dashboardAPI.getTransactions({ limit: 100 });
          if (response.success && response.data) {
            const backendTxs = Array.isArray(response.data) 
              ? response.data 
              : response.data.transactions || [];
            
            // Convert backend transactions to LocalTransaction format
            const convertedTxs: LocalTransaction[] = backendTxs.map((tx: any) => {
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
              };
            });
            
            // Use backend transactions as primary source, merge with local unsynced ones
            const backendTxnIds = new Set(convertedTxs.map(t => t.txnId));
            const unsyncedLocalTxs = txs.filter(t => !t.synced && !backendTxnIds.has(t.txnId));
            txs = [...convertedTxs, ...unsyncedLocalTxs];
            
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
      
      // Sort by most recent first
      txs.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
      
      console.log(`📊 [TransactionsScreen] Final transaction count: ${txs.length}`);
      setTransactions(txs);
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTransactions();
    if (smsService.isActive()) {
      try {
        await smsService.manualCheck();
      } catch (error) {
        console.error('Error checking SMS:', error);
      }
    }
    if (isAuthenticated) {
      try {
        await syncUnsyncedTransactions();
      } catch (error) {
        // Error already handled in syncUnsyncedTransactions
      }
    }
    setRefreshing(false);
  };

  const syncUnsyncedTransactions = async () => {
    const token = await storage.getToken();
    if (!token) {
      Alert.alert('Not Signed In', 'Please sign in to sync transactions');
      return;
    }

    setSyncing(true);
    try {
      const unsyncedCount = transactions.filter(t => !t.synced).length;
      if (unsyncedCount === 0) {
        Alert.alert('All Synced', 'All transactions are already synced to the backend');
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
      Alert.alert('Success', `Successfully synced ${unsyncedCount} transaction(s) to the backend!`);
    } catch (error: any) {
      console.error('Error syncing transactions:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Failed to sync transactions';
      Alert.alert(
        'Sync Failed',
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
    return 'Transaction';
  };

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
            <View style={[styles.transactionIcon, { backgroundColor: isIncome ? colors.lightGreen : '#fee2e2' }]}>
                {isIncome ? (
                <ArrowDown size={20} color={colors.darkGreen} />
                ) : (
                <ArrowUp size={20} color="#ef4444" />
                )}
            </View>
            <View style={styles.transactionInfo}>
              {item.sender && item.sender !== 'Unknown' && item.sender !== '' && (
                <Text style={[styles.transactionSender, { color: colors.text }]}>
                  {item.sender}
                </Text>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.transactionBank, { color: colors.textSecondary }]}>
                  {item.bank || 'Unknown Bank'}
                </Text>
                <Text style={[styles.transactionTime, { color: colors.textSecondary }]}>·</Text>
                <Text style={[styles.transactionTime, { color: colors.textSecondary }]}>
                  {formatDate(item.receivedAt)}
                </Text>
              </View>
            </View>
        </View>
          <View style={styles.transactionRight}>
            <Text style={[styles.transactionAmount, { color: colors.text }]}>
              {item.amount > 0 ? '+' : ''}{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <Text style={styles.currencyUnitSmall}> Br</Text>
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
                {item.isValidated ? 'Verified' : 'Pending'}
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
            activeTab === 'transactions' && styles.activeTabButton,
            activeTab === 'transactions' && { borderBottomColor: colors.primary }
          ]}
          onPress={() => setActiveTab('transactions')}
        >
          <Text style={[
            styles.tabButtonText,
            { color: activeTab === 'transactions' ? colors.primary : colors.textSecondary }
          ]}>
            Transactions
          </Text>
        </TouchableOpacity>
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
            Verify
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'transactions' ? (
        <>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Transactions</Text>
            {isAuthenticated && unsyncedCount > 0 && (
              <TouchableOpacity
                onPress={syncUnsyncedTransactions}
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

          {transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No transactions yet</Text>
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
        </>
      ) : (
        <VerifyPaymentsScreen apiKey={apiKey} />
      )}

      {/* Transaction Detail Modal */}
      <TransactionDetailsModal
        visible={selectedTransaction !== null}
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
      />
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
    paddingTop: 10,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
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
});
