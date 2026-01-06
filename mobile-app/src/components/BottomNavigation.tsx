import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Home, Building2, History, User, ScanLine } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';

export type Tab = 'home' | 'banks' | 'transactions' | 'ocr' | 'profile' | 'employee-management';

interface Props {
  currentTab: Tab;
  onTabChange: (tab: Tab) => void;
  isEmployee?: boolean;
}

export default function BottomNavigation({ currentTab, onTabChange, isEmployee = false }: Props) {
  const { colors } = useTheme();

  const allTabs: { id: Tab; label: string; Icon: any }[] = [
    { id: 'home', label: 'Home', Icon: Home },
    { id: 'transactions', label: 'History', Icon: History },
    { id: 'banks', label: 'Banks', Icon: Building2 },
    { id: 'ocr', label: 'Scan', Icon: ScanLine },
  ];

  // For employees, only show OCR tab
  const tabs = isEmployee 
    ? allTabs.filter(tab => tab.id === 'ocr')
    : allTabs;

  const handleTabChange = (tab: Tab) => {
    // If employee tries to access non-OCR tab, force OCR
    if (isEmployee && tab !== 'ocr') {
      onTabChange('ocr');
    } else {
      onTabChange(tab);
    }
  };

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.background }]}>
      <View style={[styles.container, { backgroundColor: colors.surface, shadowColor: colors.text }]}>
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          const IconComponent = tab.Icon;
          
          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tab}
              onPress={() => handleTabChange(tab.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, isActive && { backgroundColor: colors.primary + '15' }]}>
                <IconComponent
                  size={24}
                  color={isActive ? colors.primary : colors.textSecondary}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              </View>
              <Text
                style={[
                  styles.label,
                  {
                    color: isActive ? colors.primary : colors.textSecondary,
                    fontWeight: isActive ? '600' : '500',
                  },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    paddingHorizontal: 20,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderRadius: 30,
    paddingVertical: 8,
    paddingHorizontal: 8,
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'rgba(255, 255, 255, 0.7)', // Glassy effect
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  iconContainer: {
    padding: 6,
    borderRadius: 20,
  },
  label: {
    fontSize: 10,
    marginTop: 0,
  },
});

