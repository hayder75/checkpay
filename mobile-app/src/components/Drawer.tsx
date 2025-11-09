import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface DrawerProps {
  visible: boolean;
  onClose: () => void;
  onNavigate: (screen: string) => void;
  currentScreen: string;
  onLogout: () => void;
}

export default function Drawer({
  visible,
  onClose,
  onNavigate,
  currentScreen,
  onLogout,
}: DrawerProps) {
  const { colors } = useTheme();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
    { id: 'patterns', label: 'Pattern Library', icon: '📋' },
    { id: 'create-pattern', label: 'Create Pattern', icon: '➕' },
    { id: 'transactions', label: 'Transactions', icon: '📊' },
    { id: 'analytics', label: 'Analytics', icon: '📈' },
    { id: 'test-sms', label: 'Test SMS Parser', icon: '🧪' },
    { id: 'premium', label: 'Premium Upgrade', icon: '👑' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  const handleItemPress = (screenId: string) => {
    onNavigate(screenId);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.drawer, { backgroundColor: colors.surface }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>CheckPay</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={[styles.closeText, { color: colors.text }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.menu}>
            {menuItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.menuItem,
                  currentScreen === item.id && {
                    backgroundColor: colors.primary + '20',
                  },
                ]}
                onPress={() => handleItemPress(item.id)}
              >
                <Text style={styles.icon}>{item.icon}</Text>
                <Text style={[styles.menuLabel, { color: colors.text }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.logoutButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                onLogout();
                onClose();
              }}
            >
              <Text style={[styles.logoutText, { color: colors.primaryText }]}>
                Logout
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  drawer: {
    width: 280,
    height: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  closeText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  menu: {
    flex: 1,
    paddingTop: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingLeft: 20,
  },
  icon: {
    fontSize: 24,
    marginRight: 16,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
  },
  logoutButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
  },
});



