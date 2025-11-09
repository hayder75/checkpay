import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { patternsAPI } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  apiKey: string;
  onPatternCreated: () => void;
}

export default function PatternBuilderScreen({ apiKey, onPatternCreated }: Props) {
  const { colors } = useTheme();
  const [smsText, setSmsText] = useState('');
  const [patternName, setPatternName] = useState('');
  const [description, setDescription] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleAnalyze = async () => {
    if (!smsText.trim() || !patternName.trim()) {
      Alert.alert('Error', 'Please enter SMS text and pattern name');
      return;
    }

    setLoading(true);
    try {
      const response = await patternsAPI.validate({ smsText: smsText.trim(), name: patternName.trim() });
      if (response.success) {
        setPreview(response.data);
      } else {
        Alert.alert('Error', response.error || 'Failed to analyze pattern');
      }
    } catch (error: any) {
      console.error('Analyze error:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to analyze pattern');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!smsText.trim() || !patternName.trim()) {
      Alert.alert('Error', 'Please enter SMS text and pattern name');
      return;
    }

    if (preview && !preview.validation?.valid) {
      Alert.alert('Warning', 'Pattern validation failed. Please fix the issues before saving.');
      return;
    }

    setSaving(true);
    try {
      const response = await patternsAPI.create({
        smsText: smsText.trim(),
        name: patternName.trim(),
        description: description.trim() || undefined,
      });
      
      if (response.success) {
        Alert.alert('Success', 'Pattern created successfully!', [
          { text: 'OK', onPress: onPatternCreated },
        ]);
      } else {
        Alert.alert('Error', response.error || 'Failed to save pattern');
      }
    } catch (error: any) {
      console.error('Save error:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to save pattern');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Pattern Builder</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Paste an SMS and let AI build your parser pattern
          </Text>
        </View>

        {/* Input Section */}
        <View style={[styles.section, { borderTopColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Input SMS</Text>
          
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>SMS Text</Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="You received KES 500 from JOHN DOE. Ref: MP123456789"
              placeholderTextColor={colors.textSecondary}
              value={smsText}
              onChangeText={setSmsText}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Pattern Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="mpesa_receive"
              placeholderTextColor={colors.textSecondary}
              value={patternName}
              onChangeText={setPatternName}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Description (Optional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="M-Pesa receive transaction"
              placeholderTextColor={colors.textSecondary}
              value={description}
              onChangeText={setDescription}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }, (loading || !smsText || !patternName) && styles.buttonDisabled]}
            onPress={handleAnalyze}
            disabled={loading || !smsText || !patternName}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <Text style={[styles.buttonText, { color: colors.primaryText }]}>
                ✨ Analyze SMS
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Preview Section */}
        {preview && (
          <View style={[styles.section, { borderTopColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>AI Analysis Preview</Text>
            
            {/* Validation Status */}
            <View style={[styles.previewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.validationRow}>
                {preview.validation?.valid ? (
                  <>
                    <Text style={styles.checkIcon}>✓</Text>
                    <Text style={[styles.validationText, { color: '#10b981' }]}>Pattern Valid</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.alertIcon}>⚠</Text>
                    <Text style={[styles.validationText, { color: '#f59e0b' }]}>Validation Warnings</Text>
                  </>
                )}
              </View>
              {preview.validation?.errors?.length > 0 && (
                <View style={styles.errorsContainer}>
                  {preview.validation.errors.map((error: string, i: number) => (
                    <Text key={i} style={[styles.errorText, { color: colors.textSecondary }]}>
                      • {error}
                    </Text>
                  ))}
                </View>
              )}
            </View>

            {/* Detected Fields */}
            <View style={[styles.previewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.previewLabel, { color: colors.text }]}>Detected Fields</Text>
              <View style={styles.fieldRow}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Bank:</Text>
                <Text style={[styles.fieldValue, { color: colors.text }]}>
                  {preview.extractedValues?.bank || preview.pattern?.bank || 'Not detected'}
                </Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Currency:</Text>
                <Text style={[styles.fieldValue, { color: colors.text }]}>
                  {preview.extractedValues?.currency || preview.pattern?.currency || 'Not detected'}
                </Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Amount:</Text>
                <Text style={[styles.fieldValue, { color: colors.text }]}>
                  {preview.extractedValues?.amount 
                    ? `${preview.extractedValues.currency || ''} ${preview.extractedValues.amount}`
                    : 'Not detected'}
                </Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Transaction ID:</Text>
                <Text style={[styles.fieldValue, { color: colors.text }]}>
                  {preview.extractedValues?.txnId || 'Not detected'}
                </Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Sender:</Text>
                <Text style={[styles.fieldValue, { color: colors.text }]}>
                  {preview.extractedValues?.sender || 'Not detected'}
                </Text>
              </View>
            </View>

            {/* Generated Regex */}
            <View style={[styles.previewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.previewLabel, { color: colors.text }]}>Generated Regex</Text>
              <Text style={[styles.regexText, { color: colors.text, backgroundColor: colors.background }]}>
                {preview.pattern?.regex || 'N/A'}
              </Text>
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary }, (saving || !preview.validation?.valid) && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={saving || !preview.validation?.valid}
            >
              {saving ? (
                <ActivityIndicator color={colors.primaryText} />
              ) : (
                <Text style={[styles.buttonText, { color: colors.primaryText }]}>
                  Save Pattern
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {!preview && (
          <View style={[styles.emptyState, { borderTopColor: colors.border }]}>
            <Text style={styles.emptyIcon}>✨</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Enter SMS text and click "Analyze SMS" to see preview
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    padding: 20,
    paddingTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
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
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  textArea: {
    minHeight: 120,
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  button: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  previewCard: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  validationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkIcon: {
    fontSize: 20,
    color: '#10b981',
    marginRight: 8,
  },
  alertIcon: {
    fontSize: 20,
    color: '#f59e0b',
    marginRight: 8,
  },
  validationText: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorsContainer: {
    marginTop: 8,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
  },
  previewLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    width: 100,
  },
  fieldValue: {
    fontSize: 14,
    flex: 1,
  },
  regexText: {
    fontSize: 12,
    fontFamily: 'monospace',
    padding: 12,
    borderRadius: 4,
    marginTop: 8,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    borderTopWidth: 1,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
});



