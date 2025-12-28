import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { User, LogOut, ScanLine } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { storage } from '../services/storage';
import OCRScreen from './OCRScreen';
import ProfileScreen from './ProfileScreen';

interface Props {
  onLogout: () => void;
}

type EmployeeView = 'ocr' | 'profile';

export default function EmployeeScreen({ onLogout }: Props) {
  const { colors } = useTheme();
  const [currentView, setCurrentView] = useState<EmployeeView>('ocr');
  const [user, setUser] = React.useState<any>(null);
  const [employee, setEmployee] = React.useState<any>(null);

  React.useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      // First load from storage for immediate display
      const storedUser = await storage.getUser();
      setUser(storedUser);
      
      // Then fetch fresh data from backend
      const token = await storage.getToken();
      if (token) {
        try {
          const { authAPI } = await import('../services/api');
          const response = await authAPI.getMe();
          if (response.success && response.data) {
            const freshUser = response.data;
            setUser(freshUser);
            setEmployee(freshUser.employee || null);
            await storage.setUser(freshUser);
            console.log('✅ [EmployeeScreen] Loaded fresh user data from backend', {
              hasEmployee: !!freshUser.employee,
              employeeName: freshUser.employee?.name,
            });
          }
        } catch (error) {
          console.error('Error fetching user data from backend:', error);
        }
      }
    } catch (error) {
      console.error('Error loading user:', error);
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={[styles.avatarText, { color: colors.primaryText }]}>
              {(employee?.name || user?.name || user?.username || user?.phone || 'E')?.[0]?.toUpperCase()}
            </Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={[styles.headerName, { color: colors.text }]}>
              {employee?.name || user?.name || user?.username || user?.phone || 'Employee'}
            </Text>
            <Text style={[styles.headerRole, { color: colors.textSecondary }]}>
              Employee
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.headerButton, currentView === 'profile' && { backgroundColor: colors.primary + '20' }]}
            onPress={() => setCurrentView(currentView === 'profile' ? 'ocr' : 'profile')}
          >
            <User 
              size={20} 
              color={currentView === 'profile' ? colors.primary : colors.textSecondary} 
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleLogout}
          >
            <LogOut size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {currentView === 'ocr' ? (
          <OCRScreen patterns={[]} />
        ) : (
          <ScrollView style={styles.profileContainer}>
            <View style={styles.profileHeader}>
              <View style={[styles.profileAvatar, { backgroundColor: colors.primary }]}>
                <Text style={[styles.profileAvatarText, { color: colors.primaryText }]}>
                  {(employee?.name || user?.name || user?.username || user?.phone || 'E')?.[0]?.toUpperCase()}
                </Text>
              </View>
              <Text style={[styles.profileName, { color: colors.text }]}>
                {employee?.name || user?.name || user?.username || user?.phone || 'Employee'}
              </Text>
              {employee?.business && (
                <Text style={[styles.profileBusiness, { color: colors.textSecondary }]}>
                  {employee.business.name}
                </Text>
              )}
              <Text style={[styles.profileRole, { color: colors.textSecondary }]}>
                Employee
              </Text>
            </View>

            <View style={[styles.section, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Account Information</Text>
              
              {(employee?.name || user?.name) && (
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Name</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>{employee?.name || user?.name}</Text>
                </View>
              )}
              
              {employee?.business && (
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Business</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>{employee.business.name}</Text>
                </View>
              )}
              
              {user?.username && (
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Username</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>{user.username}</Text>
                </View>
              )}
              
              {user?.phone && (
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Phone</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>{user.phone}</Text>
                </View>
              )}
              
              {user?.email && (
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Email</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>{user.email}</Text>
                </View>
              )}
            </View>

            <View style={[styles.section, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Actions</Text>
              
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.primary }]}
                onPress={() => setCurrentView('ocr')}
              >
                <ScanLine size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Scan Transaction</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.logoutButton, { borderColor: colors.border }]}
                onPress={handleLogout}
              >
                <LogOut size={20} color="#ef4444" />
                <Text style={[styles.actionButtonText, { color: '#ef4444' }]}>Logout</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </View>
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
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingTop: 50,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerRole: {
    fontSize: 12,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  profileContainer: {
    flex: 1,
    padding: 20,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 32,
    paddingTop: 20,
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileAvatarText: {
    fontSize: 32,
    fontWeight: '700',
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 14,
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  logoutButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

