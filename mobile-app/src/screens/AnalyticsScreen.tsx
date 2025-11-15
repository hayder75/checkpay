import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { api, dashboardAPI } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { storage } from '../services/storage';
import { smsService } from '../services/smsService';

interface Props {
  apiKey?: string | null;
}

export default function AnalyticsScreen({ apiKey }: Props) {
  const { colors } = useTheme();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    loadStats();
    loadTransactions();
  }, [apiKey]);

  const loadStats = async () => {
    try {
      if (apiKey) {
        const response = await dashboardAPI.getStats();
        if (response.success && response.data) {
          setStats(response.data);
        }
      } else {
        // Use local data
        const localTxs = await storage.getLocalTransactions();
        const totalSpending = localTxs.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
        const thisWeek = localTxs.filter(tx => {
          const date = new Date(tx.receivedAt);
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return date >= weekAgo;
        });
        const weekSpending = thisWeek.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
        
        setStats({
          transactions: {
            today: localTxs.filter(tx => {
              const date = new Date(tx.receivedAt);
              const today = new Date();
              return date.toDateString() === today.toDateString();
            }).length,
            thisMonth: localTxs.filter(tx => {
              const date = new Date(tx.receivedAt);
              const month = new Date();
              return date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear();
            }).length,
            total: localTxs.length,
          },
          spending: {
            total: totalSpending,
            thisWeek: weekSpending,
            change: weekSpending > 0 ? ((weekSpending - (totalSpending - weekSpending)) / (totalSpending - weekSpending)) * 100 : 0,
          },
        });
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    try {
      const localTxs = await storage.getLocalTransactions();
      setTransactions(localTxs);
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    await loadTransactions();
    setRefreshing(false);
  };

  // Calculate spending by category (simplified)
  const getExpenseCategories = () => {
    const categories: { [key: string]: number } = {};
    transactions.forEach(tx => {
      const category = tx.bank || 'Other';
      if (!categories[category]) {
        categories[category] = 0;
      }
      categories[category] += Math.abs(tx.amount);
    });
    
    return Object.entries(categories)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 4);
  };

  // Generate weekly spending data for chart
  const getWeeklySpending = () => {
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const weekData = days.map(() => 0);
    
    transactions.forEach(tx => {
      const date = new Date(tx.receivedAt);
      const dayOfWeek = date.getDay();
      weekData[dayOfWeek] += Math.abs(tx.amount);
    });
    
    const max = Math.max(...weekData, 1);
    return weekData.map(amount => ({
      value: amount,
      height: (amount / max) * 100, // Percentage for bar height
    }));
  };

  const weeklyData = getWeeklySpending();
  const categories = getExpenseCategories();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Analytics</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading...</Text>
        </View>
      ) : (
        <>
          {/* My Spending Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>My Spending</Text>
            <Text style={[styles.spendingAmount, { color: colors.text }]}>
              ${(stats?.spending?.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            {stats?.spending?.change && (
              <View style={styles.changeRow}>
                <Text style={[styles.changeText, { color: colors.primary }]}>
                  ▲ {Math.abs(stats.spending.change).toFixed(1)}% From last week
                </Text>
              </View>
            )}
            
            {/* Weekly Chart */}
            <View style={styles.chartContainer}>
              <View style={styles.chart}>
                {weeklyData.map((day, index) => (
                  <View key={index} style={styles.chartBarContainer}>
                    <View
                      style={[
                        styles.chartBar,
                        {
                          height: `${day.height}%`,
                          backgroundColor: colors.primary,
                          minHeight: day.value > 0 ? 8 : 0,
                        },
                      ]}
                    />
                    <Text style={[styles.chartLabel, { color: colors.textSecondary }]}>
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'][index]}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* Expense Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Expense</Text>
              <View style={styles.monthSelector}>
                <Text style={[styles.monthText, { color: colors.text }]}>
                  {new Date().toLocaleString('default', { month: 'short', year: 'numeric' })}
                </Text>
                <Text style={styles.dropdownIcon}>▼</Text>
              </View>
            </View>
            <Text style={[styles.expenseAmount, { color: colors.text }]}>
              -${(stats?.spending?.thisWeek || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            
            {/* Simple line chart representation */}
            <View style={styles.lineChartContainer}>
              <View style={styles.lineChart}>
                <View style={[styles.lineChartLine, { borderColor: colors.primary }]} />
                <View style={[styles.lineChartPoint, { backgroundColor: colors.primary }]} />
              </View>
            </View>
          </View>

          {/* Expense Categories */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginBottom: 16 }]}>Expense Categories</Text>
            {categories.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No expense data yet</Text>
            ) : (
              categories.map((category, index) => (
                <View key={index} style={styles.categoryItem}>
                  <View style={[styles.categoryDot, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.categoryName, { color: colors.text }]}>{category.name}</Text>
                  <Text style={[styles.categoryAmount, { color: colors.text }]}>
                    ${category.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
              ))
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  center: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  section: {
    padding: 20,
    paddingTop: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  spendingAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  changeRow: {
    marginBottom: 16,
  },
  changeText: {
    fontSize: 14,
  },
  chartContainer: {
    marginTop: 16,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 120,
    paddingHorizontal: 8,
  },
  chartBarContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
  },
  chartBar: {
    width: '80%',
    borderRadius: 4,
    marginBottom: 8,
  },
  chartLabel: {
    fontSize: 12,
  },
  expenseAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  monthText: {
    fontSize: 14,
  },
  dropdownIcon: {
    fontSize: 10,
    color: '#6b7280',
  },
  lineChartContainer: {
    height: 100,
    marginTop: 16,
  },
  lineChart: {
    flex: 1,
    position: 'relative',
  },
  lineChartLine: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 2,
    borderTopWidth: 2,
  },
  lineChartPoint: {
    position: 'absolute',
    right: '30%',
    top: '45%',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryName: {
    flex: 1,
    fontSize: 14,
  },
  categoryAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    padding: 20,
  },
});
