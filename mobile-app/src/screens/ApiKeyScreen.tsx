import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { storage } from '../services/storage';
import { fetchPatterns } from '../services/api';
import { setApiKey } from '../services/api';
import { installationService } from '../services/installation';
import { API_BASE_URL } from '../config';
import { Pattern } from '../types';

interface Props {
  onApiKeySet: (apiKey: string, patterns: Pattern[]) => void;
}

export default function ApiKeyScreen({ onApiKeySet }: Props) {
  const [apiKey, setApiKeyInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Check if API key is already stored
    checkStoredApiKey();
  }, []);

  const checkStoredApiKey = async () => {
    try {
      const stored = await storage.getApiKey();
      if (stored) {
        setApiKeyInput(stored);
        // Try to load patterns
        await loadPatterns(stored);
      }
    } catch (error) {
      console.error('Error checking stored API key:', error);
    } finally {
      setChecking(false);
    }
  };

  const loadPatterns = async (key: string) => {
    try {
      setApiKey(key);
      const response = await fetchPatterns(key);
      if (response.success && response.data.patterns) {
        await storage.setPatterns(response.data.patterns);
        await installationService.ensureInstallationDate();
        onApiKeySet(key, response.data.patterns);
      }
    } catch (error: any) {
      console.error('Error loading patterns:', error);
      // Don't show error on initial load - let user try again
      setChecking(false);
    }
  };

  const handleSubmit = async () => {
    if (!apiKey.trim()) {
      Alert.alert('Error', 'Please enter your API key');
      return;
    }

    if (!apiKey.startsWith('ckp_')) {
      Alert.alert('Error', 'Invalid API key format. Should start with "ckp_"');
      return;
    }

    setLoading(true);
    try {
      // Test API key by fetching patterns
      const response = await fetchPatterns(apiKey);
      
      if (response.success) {
        // Save API key
        await storage.setApiKey(apiKey);
        setApiKey(apiKey);
        
        // Set installation date (only process SMS from now onwards)
        await installationService.ensureInstallationDate();
        
        // Save patterns
        const patterns = response.data.patterns || [];
        await storage.setPatterns(patterns);
        
        onApiKeySet(apiKey, patterns);
        Alert.alert('Success', `Loaded ${patterns.length} pattern(s)`);
      } else {
        Alert.alert('Error', response.error || 'Failed to verify API key');
      }
    } catch (error: any) {
      console.error('API key verification error:', error);
      const errorMessage = error.response?.data?.error 
        || error.message 
        || 'Failed to connect to server.';
      
      // More helpful error message
      let userMessage = errorMessage;
      if (error.code === 'NETWORK_ERROR' || error.message?.includes('Network') || error.message?.includes('Network Error')) {
        userMessage = `Network Error: Cannot reach server at ${API_BASE_URL}\n\n` +
          `Make sure:\n` +
          `1. Backend is running on port 3000\n` +
          `2. Phone and computer are on same WiFi\n` +
          `3. Firewall allows port 3000`;
      }
      
      Alert.alert('Error', userMessage);
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#F37100" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>CheckPay</Text>
        <Text style={styles.subtitle}>Mobile Transaction Parser</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Enter your API Key</Text>
        <TextInput
          style={styles.input}
          placeholder="ckp_xxxxxxxxxxxx"
          value={apiKey}
          onChangeText={setApiKeyInput}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />
        <Text style={styles.hint}>
          Get your API key from checkpay.com/dashboard
        </Text>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Start Monitoring</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    padding: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
  },
  header: {
    marginTop: 60,
    marginBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
  },
  form: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#2a2a2a',
    color: '#fff',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  hint: {
    fontSize: 12,
    color: '#888',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#F37100',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
