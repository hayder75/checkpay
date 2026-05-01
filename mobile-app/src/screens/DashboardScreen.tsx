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
} from 'react-native';
import { X } from 'lucide-react-native';
import { storage } from '../services/storage';
import { smsService, LocalTransaction } from '../services/smsService';
import { Pattern } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { dedupeTransactionsByIdentity } from '../utils/transactionDedup';

interface Props {
  apiKey?: string | null;
  patterns: Pattern[];
  onNavigate: (screen: string) => void;
}

export default function DashboardScreen({ apiKey, patterns, onNavigate }: Props) {
  const { colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [transactions, setTransactions] = useState<LocalTransaction[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<LocalTransaction | null>(null);
  
  useEffect(() => {
    checkAuth();
  }, []);
  
  const checkAuth = async () => {
    const token = await storage.getToken();
    setIsAuthenticated(!!token);
  };

  useEffect(() => {
    checkStatus();
    loadTransactions();
    
    // Update periodically
    const interval = setInterval(() => {
      checkStatus();
      loadTransactions();
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);

  const checkStatus = async () => {
    const isActive = smsService.isActive();
    setIsMonitoring(isActive);
    
    const patterns = await storage.getInstitutionPatterns();
    const countryCode = await storage.getCountryCode();
    const onboardingCompleted = await storage.getOnboardingCompleted();
    
    console.log('📊 [Dashboard] Status check:', {
      monitoring: isActive,
      patterns: patterns.length,
      countryCode,
      onboardingCompleted,
      apiKey: apiKey ? 'present' : 'missing',
    });
  };

  const loadTransactions = async () => {
    try {
      // First load local transactions as fallback
      let txs = await storage.getLocalTransactions();
      
      // Try to fetch from backend if authenticated (backend is source of truth)
      const token = await storage.getToken();
      if (token) {
        try {
          const { dashboardAPI } = await import('../services/api');
          const response = await dashboardAPI.getTransactions({ limit: 100 });
          if (response.success && response.data) {
            const backendTxs = Array.isArray(response.data) 
              ? response.data 
              : response.data.transactions || [];
            
            console.log(`📥 [Dashboard] Fetched ${backendTxs.length} transactions from backend`);
            
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
                createdAt: tx.createdAt || new Date().toISOString(),
              };
            });
            
            // Use backend transactions as primary source, merge with local unsynced ones
            const backendTxnIds = new Set(convertedTxs.map(t => t.txnId));
            const unsyncedLocalTxs = txs.filter(t => !t.synced && !backendTxnIds.has(t.txnId));
            txs = [...convertedTxs, ...unsyncedLocalTxs];
            
            console.log(`📊 [Dashboard] Total transactions after merge: ${txs.length} (${convertedTxs.length} from backend, ${unsyncedLocalTxs.length} unsynced local)`);
          } else {
            console.warn('⚠️ [Dashboard] Backend response not successful:', response);
          }
        } catch (error) {
          console.error('❌ [Dashboard] Error fetching transactions from backend:', error);
          // Continue with local transactions if backend fetch fails
        }
      } else {
        console.log('ℹ️ [Dashboard] No auth token, using local transactions only');
      }
      
      // Filter out withdrawals - only show deposits (positive amounts)
      txs = txs.filter(t => t.amount > 0);
      txs = dedupeTransactionsByIdentity(txs);
      
      // Sort by most recent first
      txs.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
      setTransactions(txs);
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTransactions();
    // Force SMS check if monitoring is active
    if (isMonitoring) {
      try {
        await smsService.manualCheck();
      } catch (error) {
        console.error('Error checking SMS:', error);
      }
    }
    // Also sync unsynced transactions if authenticated
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
      Alert.alert('Not Signed In', 'Please sign in to sync transactions');
      return;
    }

    try {
      const unsyncedCount = transactions.filter(t => !t.synced).length;
      if (unsyncedCount === 0) {
        return; // Already synced, no need to show alert
      }

      await smsService.syncAllUnsyncedTransactions();
      
      // Wait a moment for backend to process, then refresh
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Force reload transactions from backend
      await loadTransactions();
      
      if (showSuccessAlert) {
        Alert.alert('Success', `Successfully synced ${unsyncedCount} transaction(s) to the backend!`);
      }
    } catch (error: any) {
      console.error('Error syncing transactions:', error);
      Alert.alert(
        'Sync Failed',
        error.response?.data?.error || error.message || 'Failed to sync transactions. Please check your connection and try again.'
      );
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) {
      let hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      const minutesStr = minutes.toString().padStart(2, '0');
      return `Today, ${hours}:${minutesStr} ${ampm}`;
    }
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
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
        style={[styles.transactionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => setSelectedTransaction(item)}
        activeOpacity={0.7}
      >
        <View style={styles.transactionHeader}>
          <View style={styles.transactionHeaderLeft}>
            <Text style={[styles.transactionBank, { color: colors.text }]}>
              {displayName}
            </Text>
            <Text style={[styles.transactionTime, { color: colors.textSecondary }]}>
              {formatDate(item.receivedAt)}
            </Text>
          </View>
          {item.synced && (
            <View style={[styles.syncedBadge, { backgroundColor: colors.primary + '20' }]}>
              <Text style={[styles.syncedText, { color: colors.primary }]}>✓ Synced</Text>
            </View>
          )}
        </View>

        <View style={styles.transactionAmountRow}>
          <Text style={[styles.amountValue, { color: isIncome ? colors.primary : colors.text }]}>
            {isIncome ? '+' : '-'}${Math.abs(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          <Text style={[styles.transactionId, { color: colors.textSecondary }]}>
            Ref: {item.txnId}
          </Text>
        </View>

        {(item.sendFrom || item.sendTo || item.sender) && (
          <View style={styles.transactionDetails}>
            {item.sendFrom && (
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>From:</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>{item.sendFrom}</Text>
              </View>
            )}
            {item.sendTo && (
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>To:</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>{item.sendTo}</Text>
              </View>
            )}
            {item.sender && (
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Sender:</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>{item.sender}</Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const unsyncedCount = transactions.filter(t => !t.synced).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: colors.text }]}>Transactions</Text>
          {unsyncedCount > 0 && (
            <Text style={[styles.unsyncedText, { color: colors.textSecondary }]}>
              {unsyncedCount} unsynced
            </Text>
          )}
        </View>
        <View style={styles.headerRight}>
          {isAuthenticated && unsyncedCount > 0 && (
            <TouchableOpacity
              onPress={syncUnsyncedTransactions}
              style={[styles.syncButtonHeader, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.syncButtonHeaderText}>Sync</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={onRefresh}
            style={styles.refreshButton}
          >
            <Text style={[styles.refreshButtonText, { color: colors.primary }]}>🔄</Text>
          </TouchableOpacity>
          <View style={[styles.statusIndicator, { backgroundColor: isMonitoring ? colors.primary : '#ef4444' }]}>
            <Text style={styles.statusDot}>{isMonitoring ? '●' : '○'}</Text>
          </View>
          <Text style={[styles.statusLabel, { color: colors.textSecondary, marginLeft: 6 }]}>
            {isMonitoring ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>

      {transactions.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyIcon]}>📱</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No transactions yet</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {isMonitoring
              ? 'Waiting for SMS messages...'
              : 'Complete onboarding to start monitoring SMS'}
          </Text>
          {!isAuthenticated && (
            <Text style={[styles.emptyHint, { color: colors.textSecondary, marginTop: 12 }]}>
              Sign in to sync transactions to the cloud
            </Text>
          )}
          {isAuthenticated && (
            <TouchableOpacity
              style={[styles.syncButton, { backgroundColor: colors.primary, marginTop: 12 }]}
              onPress={async () => {
                try {
                  const token = await storage.getToken();
                  if (!token) {
                    Alert.alert('Not Signed In', 'Please sign in to sync transactions');
                    return;
                  }
                  
                  // Test connection first
                  const { testAPIConnection } = await import('../services/api');
                  const connectionTest = await testAPIConnection();
                  if (!connectionTest.success) {
                    Alert.alert(
                      'Connection Error',
                      connectionTest.message + '\n\nPlease check:\n- Backend is running\n- Correct API URL in config\n- Network connection'
                    );
                    return;
                  }
                  
                  Alert.alert('Syncing', 'Syncing unsynced transactions to backend...');
                  await smsService.syncAllUnsyncedTransactions();
                  await loadTransactions();
                  Alert.alert('Success', 'Transactions synced to backend!');
                } catch (error: any) {
                  console.error('Error syncing transactions:', error);
                  const errorMsg = error.response?.data?.error || error.message || 'Failed to sync transactions';
                  Alert.alert(
                    'Sync Failed',
                    errorMsg + '\n\nCheck console logs for details.'
                  );
                }
              }}
            >
              <Text style={[styles.startButtonText, { color: colors.primaryText }]}>
                Sync Transactions
              </Text>
            </TouchableOpacity>
          )}
          {!isMonitoring && (
            <TouchableOpacity
              style={[styles.startButton, { backgroundColor: colors.primary, marginTop: apiKey ? 8 : 0 }]}
              onPress={async () => {
                try {
                  const onboardingCompleted = await storage.getOnboardingCompleted();
                  if (onboardingCompleted) {
                    await smsService.startMonitoring();
                    setIsMonitoring(true);
                  } else {
                    Alert.alert('Onboarding Required', 'Please complete onboarding first');
                  }
                } catch (error) {
                  console.error('Error starting monitoring:', error);
                  Alert.alert('Error', 'Failed to start SMS monitoring');
                }
              }}
            >
              <Text style={[styles.startButtonText, { color: colors.primaryText }]}>
                Start Monitoring
              </Text>
            </TouchableOpacity>
          )}
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
        />
      )}

      {/* Transaction Detail Modal */}
      <Modal
        visible={selectedTransaction !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedTransaction(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Transaction Details</Text>
              <TouchableOpacity
                onPress={() => setSelectedTransaction(null)}
                style={styles.closeButton}
              >
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            {selectedTransaction && (() => {
              // Get the best sender name for display
              const getSenderForDisplay = () => {
                if (selectedTransaction.sender && selectedTransaction.sender !== 'Unknown' && selectedTransaction.sender !== '') {
                  return selectedTransaction.sender;
                }
                if (selectedTransaction.smsText) {
                  const extracted = extractSenderFromSMS(selectedTransaction.smsText);
                  if (extracted) return extracted;
                }
                return null;
              };
              const displaySender = getSenderForDisplay();
              
              return (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <View style={styles.detailSection}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Amount</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    ${selectedTransaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>

                {selectedTransaction.bank && (
                  <View style={styles.detailSection}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Bank/Institution</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>{selectedTransaction.bank}</Text>
                  </View>
                )}

                {displaySender && (
                  <View style={styles.detailSection}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Sender</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>{displaySender}</Text>
                  </View>
                )}

                {selectedTransaction.sendFrom && (
                  <View style={styles.detailSection}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>From (Phone)</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>{selectedTransaction.sendFrom}</Text>
                  </View>
                )}

                {selectedTransaction.sendTo && (
                  <View style={styles.detailSection}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>To</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>{selectedTransaction.sendTo}</Text>
                  </View>
                )}

                <View style={styles.detailSection}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Transaction ID</Text>
                  <Text style={[styles.detailValue, { color: colors.text, fontFamily: 'monospace' }]}>
                    {selectedTransaction.txnId}
                  </Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Date & Time</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {new Date(selectedTransaction.receivedAt).toLocaleString()}
                  </Text>
                </View>

                {selectedTransaction.pattern && (
                  <View style={styles.detailSection}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Pattern</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>{selectedTransaction.pattern}</Text>
                  </View>
                )}

                <View style={styles.detailSection}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Status</Text>
                  <Text style={[styles.detailValue, { color: selectedTransaction.synced ? colors.primary : '#ef4444' }]}>
                    {selectedTransaction.synced ? 'Synced' : 'Not Synced'}
                  </Text>
                </View>

                {selectedTransaction.smsText && (
                  <View style={styles.detailSection}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Original SMS</Text>
                    <View style={[styles.smsTextContainer, { backgroundColor: colors.background }]}>
                      <Text style={[styles.smsText, { color: colors.text }]}>{selectedTransaction.smsText}</Text>
                    </View>
                  </View>
                )}
              </ScrollView>
              );
            })()}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  unsyncedText: {
    fontSize: 12,
    marginTop: 4,
  },
  syncButtonHeader: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 8,
  },
  syncButtonHeaderText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshButton: {
    padding: 4,
  },
  refreshButtonText: {
    fontSize: 20,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusDot: {
    fontSize: 8,
    color: '#fff',
  },
  statusLabel: {
    fontSize: 12,
  },
  listContent: {
    padding: 16,
  },
  transactionCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  transactionHeaderLeft: {
    flex: 1,
  },
  transactionBank: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  transactionTime: {
    fontSize: 12,
  },
  syncedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  syncedText: {
    fontSize: 10,
    fontWeight: '600',
  },
  transactionAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  amountValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  transactionId: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  transactionDetails: {
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '500',
    width: 60,
  },
  detailValue: {
    fontSize: 13,
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyHint: {
    fontSize: 12,
    textAlign: 'center',
  },
  startButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  syncButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  detailSection: {
    marginBottom: 20,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  smsTextContainer: {
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  smsText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
