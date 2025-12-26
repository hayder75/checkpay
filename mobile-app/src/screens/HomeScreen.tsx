import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Modal,
  AppState,
  AppStateStatus,
} from 'react-native';
import { ArrowDown, ArrowUp, ChevronDown, User } from 'lucide-react-native';
import { LineChart } from 'react-native-chart-kit';
import { useTheme } from '../contexts/ThemeContext';
import { storage } from '../services/storage';
import { smsService, LocalTransaction } from '../services/smsService';
import { dashboardAPI } from '../services/api';

interface Props {
  apiKey?: string | null;
  onNavigateToProfile?: () => void;
}

const { width } = Dimensions.get('window');

export default function HomeScreen({ apiKey, onNavigateToProfile }: Props) {
  const { colors } = useTheme();
  const [transactions, setTransactions] = useState<LocalTransaction[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [timeFilter, setTimeFilter] = useState<'1d' | '7d' | '30d'>('7d');
  const [paymentTotal, setPaymentTotal] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);

  const timeFilterOptions = [
    { value: '1d' as const, label: '1 Day' },
    { value: '7d' as const, label: '7 Days' },
    { value: '30d' as const, label: '30 Days' },
  ];

  const getFilterLabel = () => {
    return timeFilterOptions.find(opt => opt.value === timeFilter)?.label || '7 Days';
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    
    // Refresh when app comes to foreground
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        console.log('🔄 [HomeScreen] App came to foreground, refreshing transactions');
        loadData();
      }
    });
    
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [timeFilter]);

  const loadData = async () => {
    try {
      const storedUser = await storage.getUser();
      setUser(storedUser);
      
      // First load local transactions as fallback
      let txs = await storage.getLocalTransactions();
      
      // Try to fetch from backend if authenticated (backend is source of truth)
      const token = await storage.getToken();
      if (token) {
        try {
          console.log('🔄 [HomeScreen] Fetching transactions from backend...');
          const response = await dashboardAPI.getTransactions({ limit: 100 });
          console.log('📥 [HomeScreen] Backend response:', {
            success: response.success,
            hasData: !!response.data,
            dataType: Array.isArray(response.data) ? 'array' : typeof response.data,
            dataKeys: response.data && typeof response.data === 'object' ? Object.keys(response.data) : 'N/A',
            dataLength: Array.isArray(response.data) ? response.data.length : 
                       (response.data?.transactions ? response.data.transactions.length : 'N/A'),
          });
          
          if (response.success && response.data) {
            // Backend returns { success: true, data: { transactions: [...], pagination: {...} } }
            let backendTxs: any[] = [];
            
            if (Array.isArray(response.data)) {
              backendTxs = response.data;
            } else if (response.data.transactions && Array.isArray(response.data.transactions)) {
              backendTxs = response.data.transactions;
            } else if (response.data.data && response.data.data.transactions && Array.isArray(response.data.data.transactions)) {
              backendTxs = response.data.data.transactions;
            }
            
            console.log(`📊 [HomeScreen] Extracted ${backendTxs.length} transactions from backend response`);
            
            console.log(`📊 [HomeScreen] Processing ${backendTxs.length} backend transactions`);
            
            // Convert backend transactions to LocalTransaction format
            const convertedTxs: LocalTransaction[] = backendTxs.map((tx: any) => ({
              id: tx.id || `backend_${tx.txnId}`,
              txnId: tx.txnId || tx.id,
              amount: tx.amount || 0,
              sender: tx.sender || '',
              sendFrom: tx.sendFrom || null,
              sendTo: tx.sendTo || null,
              bank: tx.bank || tx.receiverBank || null,
              pattern: tx.pattern || 'Backend Pattern',
              smsText: tx.smsText || '',
              receivedAt: tx.createdAt || tx.receivedAt || new Date().toISOString(),
              synced: true,
              createdAt: tx.createdAt || new Date().toISOString(),
            }));
            
            // Use backend transactions as primary source, merge with local unsynced ones
            const backendTxnIds = new Set(convertedTxs.map(t => t.txnId));
            const unsyncedLocalTxs = txs.filter(t => !t.synced && !backendTxnIds.has(t.txnId));
            txs = [...convertedTxs, ...unsyncedLocalTxs];
            
            console.log(`✅ [HomeScreen] Fetched ${backendTxs.length} transactions from backend, ${unsyncedLocalTxs.length} unsynced local, total: ${txs.length}`);
          } else {
            console.warn('⚠️ [HomeScreen] Backend response not successful:', {
              success: response.success,
              error: response.error,
              message: response.message,
              data: response.data,
            });
          }
        } catch (error: any) {
          console.error('❌ [HomeScreen] Error fetching transactions from backend:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
            code: error.code,
            stack: error.stack,
          });
          // Continue with local transactions if backend fetch fails
        }
      } else {
        console.log('ℹ️ [HomeScreen] No auth token, using local transactions only');
      }
      
      // Filter out withdrawals - only show deposits (positive amounts)
      const beforeFilter = txs.length;
      txs = txs.filter(t => t.amount > 0);
      const afterFilter = txs.length;
      
      if (beforeFilter !== afterFilter) {
        console.log(`🔍 [HomeScreen] Filtered out ${beforeFilter - afterFilter} withdrawal(s), showing ${afterFilter} deposit(s)`);
      }
      
      // Sort by most recent first
      txs.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
      
      console.log(`📊 [HomeScreen] Final transaction count: ${txs.length}`);
      setTransactions(txs);
      setIsMonitoring(smsService.isActive());

      // Calculate payment total based on time filter
      const now = new Date();
      let startDate = new Date();
      
      switch (timeFilter) {
        case '1d':
          startDate.setDate(now.getDate() - 1);
          break;
        case '7d':
          startDate.setDate(now.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(now.getDate() - 30);
          break;
      }
      startDate.setHours(0, 0, 0, 0);

      let total = 0;
      txs.forEach((tx) => {
        const txDate = new Date(tx.receivedAt);
        if (txDate >= startDate) {
          total += Math.abs(tx.amount);
        }
      });

      setPaymentTotal(total);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  // Simple bar chart data based on time filter
  const getChartData = () => {
    const days = [];
    const now = new Date();
    let daysToShow = 7;
    
    if (timeFilter === '1d') {
      daysToShow = 1; // For 1d, maybe show hours? Keeping simple for now
    } else if (timeFilter === '30d') {
      daysToShow = 7; // Show last 7 days even for 30d filter to keep graph clean, or aggregate
    }
    
    const dataPoints = [];
    const labels = [];

    for (let i = daysToShow - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const dayTransactions = transactions.filter((tx) => {
        const txDate = new Date(tx.receivedAt);
        return txDate >= date && txDate < nextDate;
      });
      
      const dayTotal = dayTransactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
      
      dataPoints.push(dayTotal);
      labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
    }
    
    // If no data, show flat line
    if (dataPoints.every(val => val === 0)) {
         return {
            labels: labels,
            datasets: [{ data: new Array(labels.length).fill(0) }]
        };
    }

    return {
        labels: labels,
        datasets: [
            {
                data: dataPoints,
                color: (opacity = 1) => colors.primary,
                strokeWidth: 2
            }
        ]
    };
  };

  const chartData = getChartData();

  const getUserName = () => {
    if (user?.username) return user.username;
    if (user?.phone) return user.phone;
    return 'User';
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

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
      {/* Header (Separate) */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.textSecondary }]}>Welcome Back</Text>
          <Text style={[styles.title, { color: colors.text }]}>{getUserName()}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={[styles.statusBadge, { backgroundColor: isMonitoring ? colors.lightGreen : '#fee2e2' }]}>
            <View style={[styles.statusDot, { backgroundColor: isMonitoring ? colors.darkGreen : '#ef4444' }]} />
            <Text style={[styles.statusText, { color: isMonitoring ? colors.darkGreen : '#ef4444' }]}>
              {isMonitoring ? 'Active' : 'Inactive'}
            </Text>
          </View>
          <TouchableOpacity 
            onPress={onNavigateToProfile}
            style={{ 
              padding: 8, 
              backgroundColor: colors.surface, 
              borderRadius: 20,
              borderWidth: 1,
              borderColor: colors.border
            }}
          >
            <User size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Unified Card (Payment + Graph) */}
      <View style={styles.unifiedCard}>
        {/* Background Pattern */}
        <View style={styles.cardPattern} />
        <View style={styles.cardPattern2} />

        {/* Payment Info */}
        <View style={styles.paymentSection}>
          <View style={styles.paymentHeader}><Text style={styles.statValue}>
              ${paymentTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
              {/* <Text style={styles.statLabel}>Total Payment</Text> */}
              <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => setShowDropdown(!showDropdown)}
              >
                  <Text style={styles.dropdownText}>{getFilterLabel()}</Text>
                  <ChevronDown size={16} color="#fff" />
              </TouchableOpacity>
          </View>
          
        </View>

        {/* Analytics Chart */}
        <View style={styles.chartContainer}>
          <LineChart
              data={chartData}
              width={width - 24} // Width minus margins
              height={140}
              yAxisLabel=""
              yAxisSuffix=""
              withHorizontalLabels={false}
              withVerticalLabels={false}
              chartConfig={{
                  backgroundColor: '#1C1C1E',
                  backgroundGradientFrom: '#1C1C1E',
                  backgroundGradientTo: '#1C1C1E',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(255, 107, 0, ${opacity})`, // Orange accent
                  labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                  style: {
                      borderRadius: 0
                  },
                  propsForDots: {
                      r: "0",
                  },
                  propsForBackgroundLines: {
                      strokeWidth: 0,
                  },
                  fillShadowGradientFrom: '#FF6B00',
                  fillShadowGradientTo: '#FF6B00',
                  fillShadowGradientFromOpacity: 0.2,
                  fillShadowGradientToOpacity: 0,
              }}
              bezier
              style={{
                  marginVertical: 0,
                  paddingRight: 0,
                  paddingLeft: 0,
              }}
              withInnerLines={false}
              withOuterLines={false}
              withVerticalLines={false}
              withHorizontalLines={false}
              withDots={false}
          />
        </View>
      </View>

      {/* Dropdown Modal */}
      <Modal
        visible={showDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDropdown(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDropdown(false)}
        >
          <View style={styles.dropdownContainer}>
            <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {timeFilterOptions.map((option, index) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.dropdownItem,
                    timeFilter === option.value && { backgroundColor: colors.primary + '10' },
                  ]}
                  onPress={() => {
                    setTimeFilter(option.value);
                    setShowDropdown(false);
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      {
                        color: timeFilter === option.value ? colors.primary : colors.text,
                        fontWeight: timeFilter === option.value ? '600' : '400',
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Recent Transactions */}
      <View style={styles.recentSection}>
        <View style={styles.recentHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Transactions</Text>
          <Text style={[styles.seeAll, { color: colors.primary }]}>See All</Text>
        </View>
        {transactions.slice(0, 5).map((tx) => {
          const isIncome = tx.amount > 0;
          const displayName = getDisplayName(tx);
          return (
            <View key={tx.id} style={[styles.transactionItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.transactionLeft}>
                <View style={[styles.transactionIcon, { backgroundColor: isIncome ? colors.lightGreen + '20' : '#fee2e2' }]}>
                  {isIncome ? (
                    <ArrowDown size={20} color={colors.darkGreen} />
                  ) : (
                    <ArrowUp size={20} color="#ef4444" />
                  )}
                </View>
                <View style={styles.transactionInfo}>
                  <Text style={[styles.transactionBank, { color: colors.text }]}>
                    {displayName}
                  </Text>
                  <Text style={[styles.transactionTime, { color: colors.textSecondary }]}>
                    {new Date(tx.receivedAt).toLocaleDateString()}
                  </Text>
                </View>
              </View>
              <Text style={[styles.transactionAmount, { color: isIncome ? colors.darkGreen : '#ef4444' }]}>
                {isIncome ? '+' : '-'}${Math.abs(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>
          );
        })}
        {transactions.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No transactions yet</Text>
          </View>
        )}
      </View>
    </ScrollView>
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
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
  },
  greeting: {
    fontSize: 14,
    marginBottom: 0,
    fontWeight: '500',
    opacity: 0.6,
    // textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  unifiedCard: {
    marginHorizontal: 12,
    marginBottom: 24,
    borderRadius: 32,
    paddingTop: 18,
    paddingBottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
    backgroundColor: '#1C1C1E', // Dark background
  },
  cardPattern: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#FF6B00', // Orange accent
    opacity: 0.05, // Subtle pattern
  },
  cardPattern2: {
    position: 'absolute',
    bottom: -30,
    left: -30,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#FF6B00',
    opacity: 0.03,
  },
  paymentSection: {
    paddingHorizontal: 24,
    marginBottom: 1, // Reduced gap
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4, // Reduced gap
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.8,
    color: '#fff',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -1,
    color: '#fff',
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14, // Increased size
    paddingVertical: 8, // Increased size
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    gap: 6,
  },
  dropdownText: {
    fontSize: 13, // Increased size
    fontWeight: '600',
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  dropdownContainer: {
    position: 'absolute',
    top: 220,
    right: 48,
    alignItems: 'flex-end',
  },
  dropdownMenu: {
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 140, // Increased width
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
    padding: 4,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  dropdownItemText: {
    fontSize: 14,
  },
  chartContainer: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 0,
  },
  recentSection: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  seeAll: {
    fontSize: 13,
    fontWeight: '600',
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionBank: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  transactionTime: {
    fontSize: 12,
    opacity: 0.5,
  },
  transactionAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
});

