import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { storage } from '../services/storage';
import { Pattern } from '../types';
import { useTheme } from '../contexts/ThemeContext';
// Icons - using simple text for now, can add react-native-vector-icons later
const FileText = () => null;
const History = () => null;
const BarChart3 = () => null;
const Settings = () => null;
const Crown = () => null;

interface Props {
  apiKey: string;
  patterns: Pattern[];
  onNavigate: (screen: string) => void;
}

export default function DashboardScreen({ apiKey, patterns, onNavigate }: Props) {
  const { colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    patternsCount: patterns.length,
    transactionsToday: 0,
    transactionsTotal: 0,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    // Refresh patterns from backend
    // TODO: Fetch updated patterns
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Dashboard</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Welcome back</Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.statValue, { color: colors.primary }]}>{stats.patternsCount}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Patterns</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.statValue, { color: colors.primary }]}>{stats.transactionsToday}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Today</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.statValue, { color: colors.primary }]}>{stats.transactionsTotal}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total</Text>
        </View>
      </View>

      <View style={[styles.section, { borderTopColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
        
        <TouchableOpacity
          style={[styles.menuItem, { backgroundColor: colors.surface }]}
          onPress={() => onNavigate('test-sms')}
        >
          <View style={styles.menuIcon}>
            <Text style={styles.iconText}>📱</Text>
          </View>
          <View style={styles.menuContent}>
            <Text style={[styles.menuTitle, { color: colors.text }]}>Test SMS Parser</Text>
            <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>Test pattern matching</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, { backgroundColor: colors.surface }]}
          onPress={() => onNavigate('patterns')}
        >
          <View style={styles.menuIcon}>
            <Text style={styles.iconText}>📋</Text>
          </View>
          <View style={styles.menuContent}>
            <Text style={[styles.menuTitle, { color: colors.text }]}>Pattern Library</Text>
            <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>{patterns.length} patterns</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, { backgroundColor: colors.surface }]}
          onPress={() => onNavigate('transactions')}
        >
          <View style={styles.menuIcon}>
            <Text style={styles.iconText}>📊</Text>
          </View>
          <View style={styles.menuContent}>
            <Text style={[styles.menuTitle, { color: colors.text }]}>Transaction History</Text>
            <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>View all transactions</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, { backgroundColor: colors.surface }]}
          onPress={() => onNavigate('analytics')}
        >
          <View style={styles.menuIcon}>
            <Text style={styles.iconText}>📈</Text>
          </View>
          <View style={styles.menuContent}>
            <Text style={[styles.menuTitle, { color: colors.text }]}>Analytics</Text>
            <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>View statistics</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, { backgroundColor: colors.surface }]}
          onPress={() => onNavigate('settings')}
        >
          <View style={styles.menuIcon}>
            <Text style={styles.iconText}>⚙️</Text>
          </View>
          <View style={styles.menuContent}>
            <Text style={[styles.menuTitle, { color: colors.text }]}>Settings</Text>
            <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>App configuration</Text>
          </View>
        </TouchableOpacity>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
  },
  section: {
    padding: 20,
    borderTopWidth: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  menuIcon: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  iconText: {
    fontSize: 24,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  menuSubtitle: {
    fontSize: 12,
  },
});
