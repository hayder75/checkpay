import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { storage } from '../services/storage';
import { installationService } from '../services/installation';

interface Props {
  apiKey?: string | null;
  onLogout: () => void;
}

export default function ProfileScreen({ apiKey, onLogout }: Props) {
  const { colors, theme, toggleTheme } = useTheme();
  const [user, setUser] = useState<any>(null);
  const [installationDate, setInstallationDate] = useState<Date | null>(null);
  const [plan, setPlan] = useState<'FREE' | 'PREMIUM'>('FREE');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const storedUser = await storage.getUser();
      setUser(storedUser);
      if (storedUser?.plan) {
        setPlan(storedUser.plan);
      }
      const date = await installationService.getInstallationDate();
      setInstallationDate(date);
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: onLogout,
        },
      ]
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.profileHeader}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={[styles.avatarText, { color: colors.primaryText }]}>
              {user?.username?.[0]?.toUpperCase() || user?.phone?.[0] || 'U'}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.name, { color: colors.text }]}>
              {user?.username || user?.phone || 'User'}
            </Text>
            <Text style={[styles.phone, { color: colors.textSecondary }]}>
              {user?.phone || 'No phone number'}
            </Text>
          </View>
        </View>
      </View>

      {/* Profile Details Section */}
      <View style={[styles.section, { borderTopColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Profile Details</Text>
        
        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Username</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {user?.username || 'Not set'}
            </Text>
          </View>
          <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Phone</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {user?.phone || 'Not set'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Country</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {user?.country || 'Not set'}
            </Text>
          </View>
        </View>
      </View>

      {/* Subscription Section */}
      <View style={[styles.section, { borderTopColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Subscription</Text>
        
        <View style={[styles.subscriptionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.subscriptionHeader}>
            <View>
              <Text style={[styles.planName, { color: colors.text }]}>
                {plan === 'PREMIUM' ? 'Premium Plan' : 'Free Plan'}
              </Text>
              <Text style={[styles.planDescription, { color: colors.textSecondary }]}>
                {plan === 'PREMIUM'
                  ? 'Full access to all features'
                  : 'Basic features available'}
              </Text>
            </View>
            <View style={[styles.planBadge, { backgroundColor: plan === 'PREMIUM' ? colors.primary + '20' : colors.textSecondary + '20' }]}>
              <Text style={[styles.planBadgeText, { color: plan === 'PREMIUM' ? colors.primary : colors.textSecondary }]}>
                {plan}
              </Text>
            </View>
          </View>
          {plan === 'FREE' && (
            <TouchableOpacity
              style={[styles.upgradeButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                Alert.alert('Upgrade', 'Premium features coming soon!');
              }}
            >
              <Text style={[styles.upgradeButtonText, { color: colors.primaryText }]}>
                Upgrade to Premium
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Settings Section */}
      <View style={[styles.section, { borderTopColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Settings</Text>
        
        <View style={[styles.settingsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Theme</Text>
              <Text style={[styles.settingHint, { color: colors.textSecondary }]}>
                {theme === 'dark' ? 'Dark' : 'Light'} mode
              </Text>
            </View>
            <Switch
              value={theme === 'dark'}
              onValueChange={toggleTheme}
              trackColor={{ false: '#767577', true: colors.primary }}
              thumbColor={theme === 'dark' ? colors.primary : '#f4f3f4'}
            />
          </View>
        </View>
      </View>

      {/* App Information */}
      <View style={[styles.section, { borderTopColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>App Information</Text>
        
        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {installationDate && (
            <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Installed</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {installationDate.toLocaleDateString()}
              </Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Version</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>1.0.0</Text>
          </View>
        </View>
      </View>

      {/* Logout Button */}
      <View style={styles.logoutSection}>
        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: '#ef444420', borderColor: '#ef4444' }]}
          onPress={handleLogout}
        >
          <Text style={[styles.logoutText, { color: '#ef4444' }]}>Logout</Text>
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
    paddingTop: 60,
    borderBottomWidth: 1,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  profileInfo: {
    flex: 1,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  phone: {
    fontSize: 14,
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
  infoCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  subscriptionCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  planName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  planDescription: {
    fontSize: 14,
  },
  planBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  planBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  upgradeButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  upgradeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  settingsCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingContent: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    marginBottom: 4,
  },
  settingHint: {
    fontSize: 12,
  },
  logoutSection: {
    padding: 20,
    paddingBottom: 40,
  },
  logoutButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
  },
});


