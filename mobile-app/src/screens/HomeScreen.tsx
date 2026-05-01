import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  Image,
  Alert,
} from 'react-native';
import { ArrowDown, ArrowUp, ChevronDown, Settings, Users, X, Bell } from 'lucide-react-native';
import { LineChart } from 'react-native-chart-kit';
import { useTheme } from '../contexts/ThemeContext';
import { storage } from '../services/storage';
import { smsService, LocalTransaction } from '../services/smsService';
import { dashboardAPI } from '../services/api';
import { log } from '../utils/logger';
import TransactionDetailsModal from '../components/TransactionDetailsModal';
import { getDisplayName } from '../utils/userUtils';

interface Props {
  apiKey?: string | null;
  onNavigateToProfile?: () => void;
  onNavigateToTransactions?: () => void;
  onNavigateToEmployeeManagement?: () => void;
  onNavigateToNotifications?: () => void;
}

const { width } = Dimensions.get('window');

export default function HomeScreen({ onNavigateToProfile, onNavigateToTransactions, onNavigateToEmployeeManagement, onNavigateToNotifications }: Props) {
  const { theme, colors } = useTheme();
  // const navigation = useNavigation(); // Removed
  const [transactions, setTransactions] = useState<LocalTransaction[]>([]);
  const [user, setUser] = useState<any>(null);
  const [timeFilter, setTimeFilter] = useState<'1d' | '7d' | '30d'>('7d');
  const [paymentTotal, setPaymentTotal] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<LocalTransaction | null>(null);

  const timeFilterOptions = [
    { value: '1d' as const, label: '1 Day' },
    { value: '7d' as const, label: '7 Days' },
    { value: '30d' as const, label: '30 Days' },
  ];

  // Memoize filter label
  const filterLabel = useMemo(() => {
    return timeFilterOptions.find(opt => opt.value === timeFilter)?.label || '7 Days';
  }, [timeFilter]);

  // Memoize loadData to prevent recreating on every render
  const loadData = useCallback(async () => {
    try {
      const storedUser = await storage.getUser();
      setUser(storedUser);
      
      // First load local transactions as fallback
      let txs = await storage.getLocalTransactions();
      
      // Try to fetch from backend if authenticated (backend is source of truth)
      const token = await storage.getToken();
      if (token) {
        try {
          log.debug('HomeScreen', 'Fetching transactions from backend');
          const response = await dashboardAPI.getTransactions({ limit: 100 });
          
          if (__DEV__) {
            log.debug('HomeScreen', 'Backend response', {
              success: response.success,
              hasData: !!response.data,
              dataType: Array.isArray(response.data) ? 'array' : typeof response.data,
            });
          }
          
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
            
            log.debug('HomeScreen', `Extracted ${backendTxs.length} transactions from backend response`);
            
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
            
            log.debug('HomeScreen', `Fetched ${backendTxs.length} transactions from backend, ${unsyncedLocalTxs.length} unsynced local, total: ${txs.length}`);
          } else {
            log.warn('HomeScreen', 'Backend response not successful', {
              success: response.success,
              error: response.error,
            });
          }
        } catch (error: any) {
          log.error('HomeScreen', 'Error fetching transactions from backend', {
            message: error.message,
            status: error.response?.status,
            code: error.code,
          });
          // Continue with local transactions if backend fetch fails
        }
      } else {
        log.debug('HomeScreen', 'No auth token, using local transactions only');
      }
      
      // Filter out withdrawals - only show deposits (positive amounts)
      const beforeFilter = txs.length;
      txs = txs.filter(t => t.amount > 0);
      const afterFilter = txs.length;
      
      if (__DEV__ && beforeFilter !== afterFilter) {
        log.debug('HomeScreen', `Filtered out ${beforeFilter - afterFilter} withdrawal(s), showing ${afterFilter} deposit(s)`);
      }
      
      // Sort by most recent first
      txs.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
      
      log.debug('HomeScreen', `Final transaction count: ${txs.length}`);
      setTransactions(txs);
      
      // Payment total is now calculated via useMemo (calculatedPaymentTotal)
      // and synced to state via useEffect
    } catch (error) {
      log.error('HomeScreen', 'Error loading data', error);
    }
  }, [timeFilter]); // Dependencies: timeFilter

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    
    // Refresh when app comes to foreground
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        log.debug('HomeScreen', 'App came to foreground, refreshing transactions');
        loadData();
      }
    });
    
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [loadData]);

  // Memoize filtered transactions (only deposits, sorted)
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => t.amount > 0 && t.isValidated)
      .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
  }, [transactions]);

  // Memoize payment total calculation
  const calculatedPaymentTotal = useMemo(() => {
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

    return filteredTransactions.reduce((total, tx) => {
      const txDate = new Date(tx.receivedAt);
      if (txDate >= startDate) {
        return total + Math.abs(tx.amount);
      }
      return total;
    }, 0);
  }, [filteredTransactions, timeFilter]);

  // Sync calculated total with state (only update if changed)
  useEffect(() => {
    if (Math.abs(calculatedPaymentTotal - paymentTotal) > 0.01) {
      setPaymentTotal(calculatedPaymentTotal);
    }
  }, [calculatedPaymentTotal, paymentTotal]);

  // Memoize chart data - expensive calculation
  const chartData = useMemo(() => {
    const dataPoints: number[] = [];
    const labels: string[] = [];
    const now = new Date();
    
    if (timeFilter === '1d') {
      // Last 24 hours in 4-hour intervals
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now);
        date.setHours(now.getHours() - (i * 4));
        date.setMinutes(0, 0, 0);
        
        const nextDate = new Date(date);
        nextDate.setHours(date.getHours() + 4);
        
        const periodTransactions = filteredTransactions.filter((tx) => {
          const txDate = new Date(tx.receivedAt);
          return txDate >= date && txDate < nextDate;
        });
        
        const periodTotal = periodTransactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
        dataPoints.push(periodTotal);
        let hours = date.getHours();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        labels.push(`${hours}:00 ${ampm}`);
      }
    } else if (timeFilter === '7d') {
      // Last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(now.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        const nextDate = new Date(date);
        nextDate.setDate(date.getDate() + 1);
        
        const dayTransactions = filteredTransactions.filter((tx) => {
          const txDate = new Date(tx.receivedAt);
          return txDate >= date && txDate < nextDate;
        });
        
        const dayTotal = dayTransactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
        dataPoints.push(dayTotal);
        labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
      }
    } else if (timeFilter === '30d') {
      // Last 30 days in 5-day intervals
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(now.getDate() - (i * 5));
        date.setHours(0, 0, 0, 0);
        
        const nextDate = new Date(date);
        nextDate.setDate(date.getDate() + 5);
        
        const periodTransactions = filteredTransactions.filter((tx) => {
          const txDate = new Date(tx.receivedAt);
          return txDate >= date && txDate < nextDate;
        });
        
        const periodTotal = periodTransactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
        dataPoints.push(periodTotal);
        labels.push(`${date.getDate()}/${date.getMonth() + 1}`);
      }
    }
    
    // If no data, show flat line
    if (dataPoints.every(val => val === 0)) {
         return {
            labels: labels.length > 0 ? labels : ['No Data'],
            datasets: [{ data: labels.length > 0 ? new Array(labels.length).fill(0) : [0] }]
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
  }, [filteredTransactions, timeFilter, colors.primary]);

  // Calculate a nice round number for the Y-axis max value
  const getNiceMaxY = useCallback((max: number) => {
    if (max === 0) return 100;
    
    const digits = Math.floor(Math.log10(max));
    const magnitude = Math.pow(10, digits);
    const normalized = max / magnitude;
    
    let niceNormalized;
    if (normalized <= 1) niceNormalized = 1;
    else if (normalized <= 2) niceNormalized = 2;
    else if (normalized <= 5) niceNormalized = 5;
    else niceNormalized = 10;
    
    return niceNormalized * magnitude;
  }, []);

  // Memoize final chart data with Y-axis scaling
  const finalChartData = useMemo(() => {
    const chartDataCopy = { ...chartData };
    if (!chartDataCopy.datasets[0]?.data?.length) return chartDataCopy;
    
    const maxDataValue = Math.max(...chartData.datasets[0].data);
    const niceMaxYValue = getNiceMaxY(maxDataValue);
    
    // Add a hidden dataset to force the Y-axis to use our nice max value
    // We only add this if we have actual data
    if (chartData.datasets[0].data.some(v => v > 0)) {
      chartDataCopy.datasets = [...chartData.datasets];
      chartDataCopy.datasets.push({
        data: [niceMaxYValue],
        color: () => 'transparent',
        strokeWidth: 0,
        withDots: false,
      } as any);
      // Also add 0 to ensure start from 0
      chartDataCopy.datasets.push({
        data: [0],
        color: () => 'transparent',
        strokeWidth: 0,
        withDots: false,
      } as any);
    }
    return chartDataCopy;
  }, [chartData, getNiceMaxY]);

  const userName = useMemo(() => {
    return getDisplayName(user);
  }, [user]);

  // Check if we should show the greeting (only if name or username exists)
  const shouldShowGreeting = useMemo(() => {
    if (!user) return false;
    const userData = user.user || user.data || user;
    return !!(userData.firstName || userData.first_name || userData.name || userData.username);
  }, [user]);

  // Extract sender name from SMS text if not already captured
  const extractSenderFromSMS = useCallback((smsText: string): string | null => {
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
  }, []);

  // Helper to safely convert any value to string (handles objects)
  const safeString = useCallback((value: any, fallback: string = ''): string => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
      return value.name || value.bank || value.value || fallback;
    }
    return String(value);
  }, []);

  // Memoize display name function
  const getTransactionDisplayName = useCallback((item: LocalTransaction): string => {
    // First try to extract sender from SMS text if sender is Unknown or empty
    const senderStr = safeString(item.sender);
    if ((!senderStr || senderStr === 'Unknown' || senderStr === '') && item.smsText) {
      const extractedSender = extractSenderFromSMS(item.smsText);
      if (extractedSender) return extractedSender;
    }
    
    // Prefer sender name (if valid), then bank name, then sendFrom, then pattern name
    if (senderStr && senderStr !== 'Unknown' && senderStr !== '') return senderStr;
    const bankStr = safeString(item.bank);
    if (bankStr && bankStr !== 'Unknown') return bankStr;
    if (item.sendFrom) return safeString(item.sendFrom);
    const patternStr = safeString(item.pattern);
    if (patternStr && patternStr !== 'Institution Pattern') return patternStr;
    return 'Transaction';
  }, [extractSenderFromSMS, safeString]);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
      {/* Header (Separate) */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {shouldShowGreeting && (
            <View>
              <Text style={[styles.greeting, { color: colors.textSecondary }]}>Hello,</Text>
              <Text style={[styles.title, { color: colors.text }]}>{userName}</Text>
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {/* Employee Management Button (Only for Business Owners) */}
          {user?.role === 'BUSINESS_OWNER' && (
            <TouchableOpacity 
              onPress={() => {
                console.log('Employee button pressed in HomeScreen');
                if (onNavigateToEmployeeManagement) {
                  onNavigateToEmployeeManagement();
                } else {
                  console.error('onNavigateToEmployeeManagement prop is missing');
                }
              }}
              style={{ 
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingVertical: 8,
                paddingHorizontal: 12,
                backgroundColor: '#FF6B00', // Orange
                borderRadius: 20,
              }}
            >
              <Users size={18} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Employee</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            onPress={onNavigateToNotifications}
            style={{ 
              padding: 8, 
              backgroundColor: colors.surface, 
              borderRadius: 20,
              borderWidth: 1,
              borderColor: colors.border
            }}
          >
            <Bell size={20} color={colors.text} />
          </TouchableOpacity>

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
            <Settings size={20} color={colors.text} />
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
          <View style={styles.paymentHeader}>
            <Text style={styles.statValue}>
              {paymentTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Br
            </Text>
              {/* <Text style={styles.statLabel}>Total Payment</Text> */}
              <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => setShowDropdown(!showDropdown)}
              >
                  <Text style={styles.dropdownText}>{filterLabel}</Text>
                  <ChevronDown size={16} color="#fff" />
              </TouchableOpacity>
          </View>
          
        </View>

        {/* Analytics Chart */}
        <View style={styles.chartContainer}>
          <LineChart
              data={finalChartData}
              width={width - 24} // Full width minus small margins
              height={180} // Increased height for better visibility
              yAxisLabel=""
              yAxisSuffix=""
              withHorizontalLabels={true}
              withVerticalLabels={true}
              fromZero={true}
              segments={4} // Create 5 horizontal lines (0, 25%, 50%, 75%, 100%)
              chartConfig={{
                  backgroundColor: '#1C1C1E',
                  backgroundGradientFrom: '#1C1C1E',
                  backgroundGradientTo: '#1C1C1E',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(255, 107, 0, ${opacity})`, // Orange accent
                  labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                  propsForLabels: {
                    fontSize: 10,
                    fontWeight: '600',
                  },
                  style: {
                      borderRadius: 0,
                      paddingRight: 0,
                  },
                  propsForDots: {
                      r: "4",
                      strokeWidth: "2",
                      stroke: colors.primary
                  },
                  propsForBackgroundLines: {
                      strokeWidth: 1,
                      stroke: 'rgba(255, 255, 255, 0.1)',
                      strokeDasharray: '', // Solid lines
                  },
                  fillShadowGradientFrom: '#FF6B00',
                  fillShadowGradientTo: '#FF6B00',
                  fillShadowGradientFromOpacity: 0.2,
                  fillShadowGradientToOpacity: 0,
              }}
              bezier
              style={{
                  marginVertical: 10,
                  borderRadius: 16,
              }}
              withInnerLines={true}
              withOuterLines={false}
              withVerticalLines={false}
              withHorizontalLines={true}
              withDots={false}
              onDataPointClick={(data) => {
                // Only show alert for real data points, not our dummy scaling points
                const colorFunc = data.dataset.color;
                if (colorFunc && colorFunc(1) !== 'transparent') {
                  Alert.alert('Amount', `${data.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Br`);
                }
              }}
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
          {onNavigateToTransactions && (
            <TouchableOpacity onPress={onNavigateToTransactions}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>See All</Text>
            </TouchableOpacity>
          )}
        </View>
        {filteredTransactions.slice(0, 5).map((tx) => {
          const isIncome = tx.amount > 0;
          const displayName = getTransactionDisplayName(tx);
          return (
            <TouchableOpacity 
              key={tx.id} 
              style={[styles.transactionItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setSelectedTransaction(tx)}
            >
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
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={[styles.transactionAmount, { color: isIncome ? colors.darkGreen : '#ef4444' }]}>
                  {isIncome ? '+' : '-'}{Math.abs(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <Text style={styles.currencyUnitSmall}> Br</Text>
                </Text>
                <View style={[
                  styles.statusTag, 
                  { 
                    backgroundColor: tx.isValidated ? colors.darkGreen + '10' : '#fff7ed',
                  }
                ]}>
                  <Text style={[
                    styles.statusTagText, 
                    { color: tx.isValidated ? colors.darkGreen : '#c2410c' }
                  ]}>
                    {tx.isValidated ? 'Verified' : 'Pending'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
        {filteredTransactions.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No transactions yet</Text>
          </View>
        )}
      </View>

      {/* Transaction Detail Modal */}
      <TransactionDetailsModal
        visible={selectedTransaction !== null}
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
      />
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerLogo: {
    width: 40,
    height: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  unifiedCard: {
    marginHorizontal: 12,
    marginBottom: 24,
    borderRadius: 32,
    paddingTop: 24,
    paddingBottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
    backgroundColor: '#1C1C1E', // Dark background
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
  currencyUnit: {
    fontSize: 18,
    fontWeight: '600',
    opacity: 0.8,
  },
  currencyUnitSmall: {
    fontSize: 10,
    fontWeight: '600',
    opacity: 0.6,
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
  smsText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'monospace',
  },
  statusTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusTagText: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});

