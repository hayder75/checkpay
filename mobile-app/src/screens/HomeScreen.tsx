import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { ArrowDown, ArrowUp, ChevronDown } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { storage } from '../services/storage';
import { smsService, LocalTransaction } from '../services/smsService';

interface Props {
  apiKey?: string | null;
}

const { width } = Dimensions.get('window');

export default function HomeScreen({ apiKey }: Props) {
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
    return () => clearInterval(interval);
  }, [timeFilter]);

  const loadData = async () => {
    try {
      const storedUser = await storage.getUser();
      setUser(storedUser);
      
      const txs = await storage.getLocalTransactions();
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
      daysToShow = 1;
    } else if (timeFilter === '30d') {
      daysToShow = 30;
    }
    
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
      
      days.push({
        label: timeFilter === '30d' 
          ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : date.toLocaleDateString('en-US', { weekday: 'short' }),
        value: dayTotal,
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      });
    }
    
    return days;
  };

  const chartData = getChartData();
  const maxValue = Math.max(...chartData.map((d) => Math.abs(d.value)), 1);

  const getUserName = () => {
    if (user?.username) return user.username;
    if (user?.phone) return user.phone;
    return 'User';
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.greeting, { color: colors.textSecondary }]}>Welcome Back</Text>
          <Text style={[styles.title, { color: colors.text }]}>{getUserName()}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: isMonitoring ? colors.primary + '20' : '#ef444420' }]}>
          <View style={[styles.statusDot, { backgroundColor: isMonitoring ? colors.primary : '#ef4444' }]} />
          <Text style={[styles.statusText, { color: isMonitoring ? colors.primary : '#ef4444' }]}>
            {isMonitoring ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>

      {/* Payment Card with Time Filter */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.paymentHeader}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Payment</Text>
            <TouchableOpacity
              style={[styles.dropdownButton, { backgroundColor: colors.background, borderColor: colors.border }]}
              onPress={() => setShowDropdown(!showDropdown)}
            >
              <Text style={[styles.dropdownText, { color: colors.text }]}>{getFilterLabel()}</Text>
              <ChevronDown size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.statValue, { color: colors.text }]}>
            ${paymentTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
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
                    timeFilter === option.value && { backgroundColor: colors.primary + '20' },
                    index < timeFilterOptions.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
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
                  {timeFilter === option.value && (
                    <View style={[styles.checkmark, { backgroundColor: colors.primary }]} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Analytics Chart */}
      <View style={[styles.chartSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {timeFilter === '1d' ? 'Today' : timeFilter === '7d' ? 'Last 7 Days' : 'Last 30 Days'}
        </Text>
        <View style={styles.chartContainer}>
          {chartData.map((day, index) => {
            const height = (Math.abs(day.value) / maxValue) * 120;
            const isPositive = day.value >= 0;
            
            return (
              <View key={index} style={styles.chartBarContainer}>
                <View style={styles.chartBarWrapper}>
                  <View
                    style={[
                      styles.chartBar,
                      {
                        height: height || 2,
                        backgroundColor: isPositive ? colors.primary : '#ef4444',
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.chartLabel, { color: colors.textSecondary }]}>{day.label}</Text>
                <Text style={[styles.chartValue, { color: colors.text }]}>
                  ${Math.abs(day.value).toFixed(0)}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Recent Transactions */}
      <View style={styles.recentSection}>
        <View style={styles.recentHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Transactions</Text>
          <Text style={[styles.seeAll, { color: colors.primary }]}>See All</Text>
        </View>
        {transactions.slice(0, 5).map((tx) => {
          const isIncome = tx.amount > 0;
          return (
            <View key={tx.id} style={[styles.transactionItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.transactionLeft}>
                <View style={[styles.transactionIcon, { backgroundColor: isIncome ? colors.primary + '20' : '#ef444420' }]}>
                  {isIncome ? (
                    <ArrowDown size={20} color={colors.primary} />
                  ) : (
                    <ArrowUp size={20} color="#ef4444" />
                  )}
                </View>
                <View style={styles.transactionInfo}>
                  <Text style={[styles.transactionBank, { color: colors.text }]}>
                    {tx.bank || tx.sender || 'Transaction'}
                  </Text>
                  <Text style={[styles.transactionTime, { color: colors.textSecondary }]}>
                    {new Date(tx.receivedAt).toLocaleDateString()}
                  </Text>
                </View>
              </View>
              <Text style={[styles.transactionAmount, { color: isIncome ? colors.primary : '#ef4444' }]}>
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
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
  },
  greeting: {
    fontSize: 14,
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statsContainer: {
    padding: 20,
    gap: 12,
  },
  statCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  statLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  dropdownText: {
    fontSize: 14,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  dropdownContainer: {
    position: 'absolute',
    top: 180,
    right: 20,
    alignItems: 'flex-end',
  },
  dropdownMenu: {
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 150,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dropdownItemText: {
    fontSize: 14,
  },
  checkmark: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chartSection: {
    margin: 20,
    marginTop: 0,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 180,
  },
  chartBarContainer: {
    flex: 1,
    alignItems: 'center',
  },
  chartBarWrapper: {
    height: 120,
    justifyContent: 'flex-end',
    width: '100%',
    alignItems: 'center',
  },
  chartBar: {
    width: '80%',
    borderRadius: 4,
    minHeight: 2,
  },
  chartLabel: {
    fontSize: 10,
    marginTop: 8,
  },
  chartValue: {
    fontSize: 10,
    marginTop: 4,
    fontWeight: '600',
  },
  recentSection: {
    padding: 20,
    paddingTop: 0,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
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
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  transactionTime: {
    fontSize: 12,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
});

