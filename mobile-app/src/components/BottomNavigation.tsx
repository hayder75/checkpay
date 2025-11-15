import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Home, Building2, CreditCard, User } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';

export type Tab = 'home' | 'banks' | 'transactions' | 'profile';

interface Props {
  currentTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export default function BottomNavigation({ currentTab, onTabChange }: Props) {
  const { colors } = useTheme();

  const tabs: { id: Tab; label: string; Icon: any }[] = [
    { id: 'home', label: 'Home', Icon: Home },
    { id: 'banks', label: 'Banks', Icon: Building2 },
    { id: 'transactions', label: 'Transactions', Icon: CreditCard },
    { id: 'profile', label: 'Profile', Icon: User },
  ];

  return (
    <View style={styles.wrapper}>
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          const IconComponent = tab.Icon;
          
          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tab}
              onPress={() => onTabChange(tab.id)}
              activeOpacity={0.7}
            >
              <IconComponent
                size={24}
                color={isActive ? '#000000' : colors.textSecondary}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <Text
                style={[
                  styles.label,
                  {
                    color: isActive ? '#000000' : colors.textSecondary,
                    fontWeight: isActive ? '600' : '400',
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
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 70,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 60,
  },
  label: {
    fontSize: 11,
    marginTop: 2,
  },
});

