import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { storage } from '../services/storage';
import { installationService } from '../services/installation';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  apiKey: string;
  onLogout: () => void;
}

export default function SettingsScreen({ apiKey, onLogout }: Props) {
  const { colors, theme, toggleTheme } = useTheme();
  const [smsMonitoring, setSmsMonitoring] = useState(false);
  const [installationDate, setInstallationDate] = useState<Date | null>(null);

  React.useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const date = await installationService.getInstallationDate();
    setInstallationDate(date);
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
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
      </View>

      <View style={[styles.section, { borderTopColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Appearance</Text>
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

      <View style={[styles.section, { borderTopColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>SMS Monitoring</Text>
        <View style={styles.settingItem}>
          <View style={styles.settingContent}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>Enable SMS Monitoring</Text>
            <Text style={[styles.settingHint, { color: colors.textSecondary }]}>
              Automatically process incoming SMS (requires permissions)
            </Text>
          </View>
          <Switch
            value={smsMonitoring}
            onValueChange={setSmsMonitoring}
            trackColor={{ false: '#767577', true: colors.primary }}
            thumbColor={smsMonitoring ? colors.primary : '#f4f3f4'}
          />
        </View>
      </View>

      <View style={[styles.section, { borderTopColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>App Information</Text>
        {installationDate && (
          <View style={[styles.infoItem, { borderBottomColor: colors.border }]}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Installed:</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {installationDate.toLocaleDateString()}
            </Text>
          </View>
        )}
        <View style={[styles.infoItem, { borderBottomColor: colors.border }]}>
          <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Version:</Text>
          <Text style={[styles.infoValue, { color: colors.text }]}>1.0.0</Text>
        </View>
      </View>

      <View style={[styles.section, { borderTopColor: colors.border }]}>
        <TouchableOpacity 
          style={[styles.logoutButton, { backgroundColor: colors.primary }]} 
          onPress={handleLogout}
        >
          <Text style={[styles.logoutText, { color: colors.primaryText }]}>Logout</Text>
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
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
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
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
  },
  logoutButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
