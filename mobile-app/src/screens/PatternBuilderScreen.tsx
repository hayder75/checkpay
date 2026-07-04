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
import { storage } from '../services/storage';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  apiKey: string;
  onPatternCreated: () => void;
  onPatternsRefreshed?: (patterns: any[]) => void;
}

export default function PatternBuilderScreen({ apiKey, onPatternCreated, onPatternsRefreshed }: Props) {
  const { colors } = useTheme();
  const [smsText, setSmsText] = useState('');
  const [patternName, setPatternName] = useState('');
  const [description, setDescription] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [useAI, setUseAI] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  // Security fields
  const [allowedSenders, setAllowedSenders] = useState<string[]>([]);
  const [senderInput, setSenderInput] = useState('');
  const [requireSenderVerification, setRequireSenderVerification] = useState(true);
  const [requireContactCheck, setRequireContactCheck] = useState(true);

  const handleAnalyze = async () => {
    if (!smsText.trim() || !patternName.trim()) {
      Alert.alert('Error', 'Please enter SMS text and pattern name');
      return;
    }

    setLoading(true);
    try {
      const response = await patternsAPI.validate({ smsText: smsText.trim(), name: patternName.trim(), useAI: false });
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

  const handleUseAI = async () => {
    if (!smsText.trim() || !patternName.trim()) {
      Alert.alert('Error', 'Please enter SMS text and pattern name');
      return;
    }

    setAiLoading(true);
    try {
      const response = await patternsAPI.createWithAI({ 
        smsText: smsText.trim(), 
        name: patternName.trim(), 
        description: description.trim() || undefined 
      });
      if (response.success) {
        setPreview({
          pattern: response.data,
          validation: { valid: true, errors: [] },
          extractedValues: response.extracted,
          method: 'ai',
          aiSuggested: false,
          canUseAI: true,
        });
        setUseAI(true);
        Alert.alert('Success', 'Pattern created using AI! Review and save.');
      } else {
        Alert.alert('Error', response.error || 'Failed to create pattern with AI');
      }
    } catch (error: any) {
      console.error('AI error:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to create pattern with AI');
    } finally {
      setAiLoading(false);
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
      let createdPattern = null;
      
      // Always create pattern via API (preview is just for validation)
      const requestData = {
        smsText: smsText.trim(),
        name: patternName.trim(),
        description: description.trim() || undefined,
        useAI: useAI,
        // Security fields - ALWAYS send the array (even if empty) so backend knows it was provided
        allowedSenders: allowedSenders.length > 0 ? allowedSenders : [],
        requireSenderVerification,
        requireContactCheck,
      };
      
      console.log('[Pattern Builder] Sending pattern creation request:', {
        name: requestData.name,
        allowedSenders: requestData.allowedSenders,
        allowedSendersLength: requestData.allowedSenders.length,
        allowedSendersType: typeof requestData.allowedSenders,
        allowedSendersIsArray: Array.isArray(requestData.allowedSenders),
        requireSenderVerification: requestData.requireSenderVerification,
        requireContactCheck: requestData.requireContactCheck,
      });
      
      const response = await patternsAPI.create(requestData);
      
      createdPattern = null;
      let method = 'rule-based';
      
      if (response.success) {
        createdPattern = response.data;
        method = response.method || (useAI ? 'ai' : 'rule-based');
        console.log('✅ Pattern created successfully:', { id: createdPattern.id, name: createdPattern.name, method });
      } else {
        Alert.alert('Error', response.error || 'Failed to save pattern');
        return;
      }
      
      // Refresh patterns from backend after creation
      try {
        console.log('🔄 Refreshing patterns from backend...');
        const patternsResponse = await patternsAPI.getAll();
        if (patternsResponse.success && patternsResponse.data) {
          const updatedPatterns = Array.isArray(patternsResponse.data) 
            ? patternsResponse.data 
            : [];
          
          // Patterns are now always fetched from backend, no local storage
          console.log(`✅ Refreshed ${updatedPatterns.length} patterns from backend`);
          
          // Notify parent component to update patterns state
          if (onPatternsRefreshed) {
            onPatternsRefreshed(updatedPatterns);
          }
        }
      } catch (refreshError) {
        console.error('Error refreshing patterns:', refreshError);
        // Continue anyway - pattern was created successfully
      }
      
      Alert.alert('Success', `Pattern created successfully using ${method} extraction!`, [
        { text: 'OK', onPress: onPatternCreated },
      ]);
    } catch (error: any) {
      console.error('Save error:', error);
      // If error suggests AI, show that
      if (error.response?.data?.canUseAI) {
        Alert.alert('Pattern Creation Failed', error.response.data.suggestion || 'Try using AI for better accuracy');
      } else {
        Alert.alert('Error', error.response?.data?.error || 'Failed to save pattern');
      }
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

          {/* Security Settings */}
          <View style={[styles.inputGroup, { marginTop: 8 }]}>
            <Text style={[styles.sectionTitle, { color: colors.text, fontSize: 16, marginBottom: 12 }]}>Security Settings</Text>
            
            {/* Allowed Senders */}
            <View style={{ marginBottom: 12 }}>
              <Text style={[styles.label, { color: colors.text }]}>Allowed Senders (Phone/Name)</Text>
              <Text style={[styles.hint, { color: colors.textSecondary, marginBottom: 8 }]}>
                Add phone numbers or sender names that can send SMS for this pattern
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  style={[styles.input, { flex: 1, backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  placeholder="e.g., +251911234567 or CBE"
                  placeholderTextColor={colors.textSecondary}
                  value={senderInput}
                  onChangeText={setSenderInput}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: colors.primary, paddingHorizontal: 16, minWidth: 60 }]}
                  onPress={() => {
                    if (senderInput.trim()) {
                      setAllowedSenders([...allowedSenders, senderInput.trim()]);
                      setSenderInput('');
                    }
                  }}
                >
                  <Text style={[styles.buttonText, { color: colors.primaryText }]}>Add</Text>
                </TouchableOpacity>
              </View>
              {allowedSenders.length > 0 && (
                <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {allowedSenders.map((sender, index) => (
                    <View
                      key={index}
                      style={[styles.tag, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}
                    >
                      <Text style={[styles.tagText, { color: colors.primary }]}>{sender}</Text>
                      <TouchableOpacity
                        onPress={() => {
                          setAllowedSenders(allowedSenders.filter((_, i) => i !== index));
                        }}
                        style={{ marginLeft: 6 }}
                      >
                        <Text style={[styles.tagText, { color: colors.primary }]}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Security Toggles */}
            <View style={[styles.toggleContainer, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: 8 }]}>
              <Text style={[styles.toggleLabel, { color: colors.text }]}>
                Require Sender Verification
              </Text>
              <TouchableOpacity
                style={[styles.toggle, requireSenderVerification && { backgroundColor: colors.primary }]}
                onPress={() => setRequireSenderVerification(!requireSenderVerification)}
              >
                <View style={[styles.toggleThumb, requireSenderVerification && styles.toggleThumbActive]} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.toggleHint, { color: colors.textSecondary, marginBottom: 12 }]}>
              Only accept SMS from allowed senders
            </Text>

            <View style={[styles.toggleContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.toggleLabel, { color: colors.text }]}>
                Reject SMS from Contacts
              </Text>
              <TouchableOpacity
                style={[styles.toggle, requireContactCheck && { backgroundColor: colors.primary }]}
                onPress={() => setRequireContactCheck(!requireContactCheck)}
              >
                <View style={[styles.toggleThumb, requireContactCheck && styles.toggleThumbActive]} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.toggleHint, { color: colors.textSecondary }]}>
              Reject SMS from numbers in your contacts (prevents spoofing)
            </Text>
          </View>

          {/* AI Toggle */}
          <View style={[styles.inputGroup, { marginBottom: 12 }]}>
            <View style={[styles.toggleContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.toggleLabel, { color: colors.text }]}>
                🤖 Use AI for Pattern Creation
              </Text>
              <TouchableOpacity
                style={[styles.toggle, useAI && { backgroundColor: colors.primary }]}
                onPress={() => setUseAI(!useAI)}
              >
                <View style={[styles.toggleThumb, useAI && styles.toggleThumbActive]} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.toggleHint, { color: colors.textSecondary }]}>
              {useAI 
                ? 'AI will be used to create the pattern (may take longer)'
                : 'Rule-based extraction will be tried first, AI used if needed'}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }, (loading || aiLoading || !smsText || !patternName) && styles.buttonDisabled]}
            onPress={handleAnalyze}
            disabled={loading || aiLoading || !smsText || !patternName}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <Text style={[styles.buttonText, { color: colors.primaryText }]}>
                {useAI ? '🤖 Analyze SMS (AI)' : '⚡ Analyze SMS (Rule-Based)'}
              </Text>
            )}
          </TouchableOpacity>

          {preview?.aiSuggested && preview?.canUseAI && !useAI && (
            <TouchableOpacity
              style={[styles.button, { backgroundColor: '#9333ea', marginTop: 8 }, (aiLoading || loading || !smsText || !patternName) && styles.buttonDisabled]}
              onPress={handleUseAI}
              disabled={aiLoading || loading || !smsText || !patternName}
            >
              {aiLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[styles.buttonText, { color: '#fff' }]}>
                  🤖 Use AI to Create Pattern
                </Text>
              )}
            </TouchableOpacity>
          )}
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
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ccc',
    justifyContent: 'center',
    padding: 2,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  toggleHint: {
    fontSize: 12,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  hint: {
    fontSize: 12,
    marginBottom: 4,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
  },
});



