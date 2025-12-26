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
import { Building2, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { storage } from '../services/storage';
import { installationService } from '../services/installation';
import { authAPI } from '../services/api';

interface Props {
  apiKey?: string | null;
  onLogout: () => void;
  onNavigateToBanks?: () => void;
}

export default function ProfileScreen({ apiKey, onLogout, onNavigateToBanks }: Props) {
  const { colors, theme, toggleTheme } = useTheme();
  const [user, setUser] = useState<any>(null);
  const [installationDate, setInstallationDate] = useState<Date | null>(null);
  const [plan, setPlan] = useState<'FREE' | 'PREMIUM'>('FREE');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      // First load from storage for immediate display
      const storedUser = await storage.getUser();
      setUser(storedUser);
      if (storedUser?.plan) {
        setPlan(storedUser.plan);
      }
      
      // Then fetch fresh data from backend
      const token = await storage.getToken();
      if (token) {
        try {
          const response = await authAPI.getMe();
          if (response.success && response.data) {
            const freshUser = response.data;
            setUser(freshUser);
            if (freshUser.plan) {
              setPlan(freshUser.plan);
            }
            // Update stored user
            await storage.setUser(freshUser);
            console.log('✅ [Profile] Loaded fresh user data from backend');
          }
        } catch (error) {
          console.error('Error fetching user data from backend:', error);
          // Continue with stored user data
        }
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
      <View style={styles.section}>
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

      {/* Management Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Management</Text>
        
        <View style={[styles.menuCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={onNavigateToBanks}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconContainer, { backgroundColor: colors.primary + '15' }]}>
                <Building2 size={20} color={colors.primary} />
              </View>
              <Text style={[styles.menuItemText, { color: colors.text }]}>My Banks</Text>
            </View>
            <ChevronRight size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Subscription Section */}
      <View style={styles.section}>
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
      <View style={styles.section}>
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
      <View style={styles.section}>
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
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  profileInfo: {
    flex: 1,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 2,
    letterSpacing: -0.5,
  },
  phone: {
    fontSize: 14,
    opacity: 0.6,
  },
  section: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  infoCard: {
    borderRadius: 20,
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
    opacity: 0.7,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  subscriptionCard: {
    borderRadius: 20,
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
    fontSize: 13,
    opacity: 0.7,
  },
  planBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  planBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  upgradeButton: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  upgradeButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  settingsCard: {
    borderRadius: 20,
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
    fontWeight: '500',
    marginBottom: 2,
  },
  settingHint: {
    fontSize: 12,
    opacity: 0.6,
  },
  logoutSection: {
    padding: 24,
    paddingBottom: 40,
  },
  logoutButton: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700',
  },
  menuCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '500',
  },
});


