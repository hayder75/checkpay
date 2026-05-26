import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { User, LogOut, ScanLine, Receipt, ChevronRight, Building2, Phone, Mail, CreditCard } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { usePopup } from '../contexts/PopupContext';
import { storage } from '../services/storage';
import OCRScreen from './OCRScreen';
import TransactionsScreen from './TransactionsScreen';
import ReportsCashScreen from './ReportsCashScreen';
import BottomNavigation, { Tab } from '../components/BottomNavigation';
import { getDisplayName, getUserInitials } from '../utils/userUtils';
import { useTranslation } from 'react-i18next';

interface Props {
  onLogout: () => void;
  packageRestricted?: boolean;
}

type EmployeeView = 'ocr' | 'transactions' | 'reports' | 'profile';

const { width } = Dimensions.get('window');

export default function EmployeeScreen({ onLogout, packageRestricted = false }: Props) {
  const { colors, theme } = useTheme();
  const { t } = useTranslation();
  const { showConfirm } = usePopup();
  const [currentView, setCurrentView] = useState<EmployeeView>(packageRestricted ? 'transactions' : 'ocr');
  const [user, setUser] = useState<any>(null);
  const [employee, setEmployee] = useState<any>(null);
  const [patterns, setPatterns] = useState<any[]>([]);
  
  // Animation for tab switching
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadUser();
    loadPatterns();
  }, []);

  useEffect(() => {
    if (packageRestricted && currentView === 'ocr') {
      setCurrentView('transactions');
    }
  }, [packageRestricted, currentView]);

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
          if (response.success) {
            // Robustly extract user data
            const freshUser = response.data || response.user || (response.id ? response : null);
            
            if (freshUser) {
              // Merge fresh data with stored user, preserving name fields if API doesn't return them
              const mergedUser = {
                ...storedUser,
                ...freshUser,
                username: freshUser.username || storedUser?.username,
                firstName: freshUser.firstName || freshUser.first_name || storedUser?.firstName,
                lastName: freshUser.lastName || freshUser.last_name || storedUser?.lastName,
                phone: freshUser.phone || storedUser?.phone,
                email: freshUser.email || storedUser?.email,
              };
              
              setUser(mergedUser);
              setEmployee(mergedUser.employee || null);
              await storage.setUser(mergedUser);
            }
          }
        } catch (error) {
          console.error('Error fetching user data from backend:', error);
        }
      }
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const loadPatterns = async () => {
    try {
      const { patternsAPI } = await import('../services/api');
      const response = await patternsAPI.getAll();
      if (response.success && response.data) {
        const loadedPatterns = Array.isArray(response.data) ? response.data : [];
        setPatterns(loadedPatterns);
        console.log(`✅ [EmployeeScreen] Loaded ${loadedPatterns.length} patterns`, {
          patterns: loadedPatterns.map(p => ({ id: p.id, name: p.name, bank: p.bank })),
        });
      } else {
        console.warn('⚠️ [EmployeeScreen] No patterns in response', response);
        setPatterns([]);
      }
    } catch (error) {
      console.error('❌ [EmployeeScreen] Error loading patterns:', error);
      setPatterns([]);
    }
  };

  const handleLogout = () => {
    showConfirm(
      t('employee.logoutTitle'),
      t('employee.logoutMessage'),
      onLogout
    );
  };

  const switchTab = (view: EmployeeView) => {
    if (currentView === view) return;
    
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      })
    ]).start();
    
    // Update state in the middle of animation (conceptually)
    setTimeout(() => setCurrentView(view), 100);
  };

  const renderContent = () => {
    switch (currentView) {
      case 'ocr':
        return <OCRScreen patterns={patterns} />;
      case 'transactions':
        return <TransactionsScreen apiKey={null} />;
      case 'reports':
        return <ReportsCashScreen isEmployee={true} />;
      case 'profile':
        return renderProfile();
      default:
        return packageRestricted ? <TransactionsScreen apiKey={null} /> : <OCRScreen patterns={patterns} />;
    }
  };

  const renderProfile = () => (
    <ScrollView 
      style={styles.profileContainer} 
      contentContainerStyle={{ paddingTop: Platform.OS === 'ios' ? 60 : 40 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.profileHeader}>
        <View style={[styles.profileAvatar, { backgroundColor: colors.primary }]}>
          <Text style={[styles.profileAvatarText, { color: '#fff' }]}>
            {getUserInitials(employee || user)}
          </Text>
        </View>
        <Text style={[styles.profileName, { color: colors.text }]}>
          {getDisplayName(employee || user)}
        </Text>
        <Text style={[styles.profileRole, { color: colors.textSecondary }]}>
          {employee?.business?.name ? `${employee.business.name} • ` : ''}{t('employee.account')}
        </Text>
      </View>

      <View style={styles.sectionContainer}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('employee.accountDetails')}</Text>
        
        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {(employee?.name || user?.name) && (
            <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
              <View style={styles.infoIcon}>
                <User size={18} color={colors.primary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('employee.fullName')}</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{employee?.name || user?.name}</Text>
              </View>
            </View>
          )}
          
          {employee?.business && (
            <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
              <View style={styles.infoIcon}>
                <Building2 size={18} color={colors.primary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('employee.business')}</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{employee.business.name}</Text>
              </View>
            </View>
          )}
          
          {(user?.phone || user?.username) && (
            <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
              <View style={styles.infoIcon}>
                <Phone size={18} color={colors.primary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('employee.phoneOrUsername')}</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{user?.phone || user?.username}</Text>
              </View>
            </View>
          )}

          {user?.email && (
            <View style={[styles.infoRow, { borderBottomColor: 'transparent' }]}>
              <View style={styles.infoIcon}>
                <Mail size={18} color={colors.primary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('employee.email')}</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{user.email}</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      <View style={styles.sectionContainer}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('employee.actions')}</Text>
        
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={handleLogout}
        >
          <View style={[styles.actionIconCircle, { backgroundColor: '#fee2e2' }]}>
            <LogOut size={20} color="#ef4444" />
          </View>
          <Text style={[styles.actionButtonText, { color: '#ef4444' }]}>{t('employee.logOut')}</Text>
          <ChevronRight size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      
      <View style={{ height: 100 }} />
    </ScrollView>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Content Area */}
      <View style={styles.content}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          {renderContent()}
        </Animated.View>
      </View>

      {/* Bottom Navigation */}
      <BottomNavigation 
        currentTab={currentView} 
        onTabChange={(tab) => switchTab(tab as EmployeeView)}
        isEmployee={true}
        isRestricted={packageRestricted}
      />
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
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarTextSmall: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerGreeting: {
    fontSize: 12,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerLogout: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  // Profile Styles
  profileContainer: {
    flex: 1,
    padding: 20,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 20,
  },
  profileAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  profileAvatarText: {
    fontSize: 40,
    fontWeight: '700',
  },
  profileName: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 14,
    fontWeight: '500',
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 12,
    paddingLeft: 4,
    letterSpacing: 1,
  },
  infoCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  actionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
});

