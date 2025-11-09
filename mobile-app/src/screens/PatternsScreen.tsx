import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Pattern } from '../types';
import { fetchPatterns } from '../services/api';
import { storage } from '../services/storage';
import { setApiKey } from '../services/api';

interface Props {
  apiKey: string;
  patterns: Pattern[];
  onRefresh: () => void;
  onNavigate: (screen: string, patternId?: string) => void;
}

export default function PatternsScreen({ apiKey, patterns, onRefresh, onNavigate }: Props) {
  const [refreshing, setRefreshing] = useState(false);
  const [localPatterns, setLocalPatterns] = useState(patterns);

  useEffect(() => {
    setLocalPatterns(patterns);
  }, [patterns]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      setApiKey(apiKey);
      const response = await fetchPatterns(apiKey);
      if (response.success && response.data.patterns) {
        const updatedPatterns = response.data.patterns;
        await storage.setPatterns(updatedPatterns);
        setLocalPatterns(updatedPatterns);
        onRefresh();
      }
    } catch (error) {
      console.error('Error refreshing patterns:', error);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Pattern Library</Text>
        <Text style={styles.subtitle}>{localPatterns.length} pattern(s) loaded</Text>
      </View>

      {localPatterns.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No patterns found</Text>
          <Text style={styles.emptyHint}>
            Create patterns on the web dashboard first, then refresh here.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {localPatterns.map((pattern) => (
            <TouchableOpacity
              key={pattern.id}
              style={styles.patternCard}
              onPress={() => onNavigate('pattern-detail', pattern.id)}
            >
              <View style={styles.patternHeader}>
                <Text style={styles.patternName}>{pattern.name}</Text>
                {pattern.bank && (
                  <Text style={styles.patternBank}>{pattern.bank}</Text>
                )}
              </View>
              {pattern.description && (
                <Text style={styles.patternDesc} numberOfLines={2}>
                  {pattern.description}
                </Text>
              )}
              <View style={styles.patternFooter}>
                <Text style={styles.patternRegex} numberOfLines={1}>
                  {pattern.regex.substring(0, 50)}...
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  list: {
    padding: 20,
  },
  patternCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  patternHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  patternName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  patternBank: {
    fontSize: 12,
    color: '#F37100',
    backgroundColor: '#F3710020',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  patternDesc: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
  },
  patternFooter: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  patternRegex: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
});
