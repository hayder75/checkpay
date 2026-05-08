import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { patternsAPI, auth } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { Sparkles, CheckCircle2, AlertCircle, Globe } from 'lucide-react';
import { COUNTRIES_LIST } from '@/utils/countries';

export default function PatternBuilderPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [smsTexts, setSmsTexts] = useState<string[]>(['']); // Array for multi-language support
  const [patternName, setPatternName] = useState('');
  const [description, setDescription] = useState('');
  const [countryCode, setCountryCode] = useState<string>(''); // Country for this pattern
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [usingAI, setUsingAI] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  // Security fields
  const [allowedSenders, setAllowedSenders] = useState<string[]>([]);
  const [senderInput, setSenderInput] = useState('');
  const [requireSenderVerification, setRequireSenderVerification] = useState(true);
  const [requireContactCheck, setRequireContactCheck] = useState(true);

  // Initialize country from user's profile
  useEffect(() => {
    const currentUser = auth.getUser();
    if (currentUser?.country) {
      setCountryCode(currentUser.country);
    }
  }, []);

  // Generate pattern using regex generator (default)
  const handleGeneratePattern = async () => {
    const validTexts = smsTexts.filter(text => text.trim().length > 0);

    if (validTexts.length === 0 || !patternName) {
      toast({
        title: 'Error',
        description: 'Please enter at least one SMS text and pattern name',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Use first SMS for validation/preview
      const response = await patternsAPI.validate({ 
        smsText: validTexts[0], 
        name: patternName
      });
      
      setPreview({
        ...response.data.data,
        method: response.data.data.method || 'rule-based',
        canUseAI: response.data.data.canUseAI ?? true,
        aiSuggested: response.data.data.aiSuggested ?? false,
      });
      
      if (response.data.data.validation.valid) {
        toast({
          title: 'Success',
          description: 'Pattern generated successfully! Review and save.',
        });
      } else {
        toast({
          title: 'Warning',
          description: 'Pattern generated but some fields are missing. Consider using AI if needed.',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to generate pattern',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Use AI as fallback
  const handleUseAI = async () => {
    const validTexts = smsTexts.filter(text => text.trim().length > 0);
    
    if (validTexts.length === 0 || !patternName) {
      toast({
        title: 'Error',
        description: 'Please enter at least one SMS text and pattern name',
        variant: 'destructive',
      });
      return;
    }

    setAiLoading(true);
    try {
      // Use the main create endpoint with useAI flag
      const response = await patternsAPI.create({ 
        smsTexts: validTexts, 
        name: patternName, 
        description,
        countryCode: countryCode || undefined, // Include country if selected
        useAI: true,
        // Security fields
        allowedSenders: allowedSenders.length > 0 ? allowedSenders : [],
        requireSenderVerification,
        requireContactCheck,
      });
      
      const extracted = Array.isArray(response.data.extracted) 
        ? response.data.extracted[0] 
        : response.data.extracted;
      
      setPreview({
        pattern: response.data.data,
        validation: { valid: true, errors: [] },
        extractedValues: extracted,
        allExtracted: response.data.extracted,
        method: 'ai',
      });
      setUsingAI(true);
      toast({
        title: 'Success',
        description: 'Pattern created using AI! Review and save.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to create pattern with AI',
        variant: 'destructive',
      });
    } finally {
      setAiLoading(false);
    }
  };

  const addAnotherLanguage = () => {
    setSmsTexts([...smsTexts, '']);
  };

  const removeLanguage = (index: number) => {
    if (smsTexts.length > 1) {
      setSmsTexts(smsTexts.filter((_, i) => i !== index));
    }
  };

  const updateSmsText = (index: number, value: string) => {
    const updated = [...smsTexts];
    updated[index] = value;
    setSmsTexts(updated);
  };

  const handleSave = async () => {
    const validTexts = smsTexts.filter(text => text.trim().length > 0);
    
    if (validTexts.length === 0 || !patternName) {
      toast({
        title: 'Error',
        description: 'Please enter at least one SMS text and pattern name',
        variant: 'destructive',
      });
      return;
    }

      // If we used AI, the pattern is already created, just navigate
      if (usingAI && preview?.pattern) {
        toast({
          title: 'Success',
          description: 'Pattern created successfully!',
        });
        navigate('/dashboard/patterns');
        return;
      }

    // Otherwise, create pattern using regex generator (default)
    setSaving(true);
    try {
      await patternsAPI.create({ 
        smsTexts: validTexts,
        name: patternName, 
        description,
        countryCode: countryCode || undefined, // Include country if selected
        useAI: false, // Use regex generator by default
        // Security fields
        allowedSenders: allowedSenders.length > 0 ? allowedSenders : [],
        requireSenderVerification,
        requireContactCheck,
      });
      
      toast({
        title: 'Success',
        description: 'Pattern created successfully!',
      });
      navigate('/dashboard/patterns');
    } catch (error: any) {
        toast({
          title: 'Error',
          description: error.response?.data?.error || 'Failed to save pattern',
          variant: 'destructive',
        });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold">Pattern Builder</h1>
          <p className="text-muted-foreground">
            Paste SMS messages to generate regex patterns. Use AI generation if needed.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Input Section */}
          <Card>
            <CardHeader>
              <CardTitle>Input SMS</CardTitle>
              <CardDescription>Paste SMS messages (add multiple languages if the same bank sends in different languages)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Multi-language SMS inputs */}
              {smsTexts.map((text, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`sms-${index}`}>
                      SMS Text {index === 0 ? '(Primary)' : `(Language ${index + 1})`}
                    </Label>
                    {index > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLanguage(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                <Textarea
                    id={`sms-${index}`}
                    placeholder={
                      index === 0
                        ? "You received KES 500 from JOHN DOE. Ref: MP123456789"
                        : "ውድ Ayantu፣ 5.00 ብር ከGemechu Girma Bekele..."
                    }
                    value={text}
                    onChange={(e) => updateSmsText(index, e.target.value)}
                    rows={4}
                />
              </div>
              ))}
              
              <Button
                type="button"
                variant="outline"
                onClick={addAnotherLanguage}
                className="w-full"
              >
                + Add Another Language
              </Button>

              <div className="space-y-2">
                <Label htmlFor="name">Pattern Name</Label>
                <Input
                  id="name"
                  placeholder="mpesa_receive"
                  value={patternName}
                  onChange={(e) => setPatternName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Input
                  id="description"
                  placeholder="M-Pesa receive transaction"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="countryCode" className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[#F37100]" />
                  Country (Optional)
                </Label>
                <select
                  id="countryCode"
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">Use my profile country (default)</option>
                  {COUNTRIES_LIST.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Select a country for this pattern. If not selected, your profile country will be used.
                </p>
              </div>

              {/* Security Settings */}
              <div className="space-y-4 pt-4 border-t">
                <div>
                  <Label className="text-base font-semibold">Security Settings</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Configure sender verification to prevent fraudulent SMS
                  </p>
                </div>

                {/* Allowed Senders */}
                <div className="space-y-2">
                  <Label htmlFor="sender">Allowed Senders (Phone/Name)</Label>
                  <p className="text-xs text-muted-foreground">
                    Add phone numbers or sender names that can send SMS for this pattern
                  </p>
                  <div className="flex gap-2">
                    <Input
                      id="sender"
                      placeholder="e.g., +251911234567 or CBE"
                      value={senderInput}
                      onChange={(e) => setSenderInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && senderInput.trim()) {
                          setAllowedSenders([...allowedSenders, senderInput.trim()]);
                          setSenderInput('');
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (senderInput.trim()) {
                          setAllowedSenders([...allowedSenders, senderInput.trim()]);
                          setSenderInput('');
                        }
                      }}
                    >
                      Add
                    </Button>
                  </div>
                  {allowedSenders.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {allowedSenders.map((sender, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md text-sm"
                        >
                          <span>{sender}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setAllowedSenders(allowedSenders.filter((_, i) => i !== index));
                            }}
                            className="ml-1 hover:text-primary/70"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Security Toggles */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Require Sender Verification</Label>
                      <p className="text-xs text-muted-foreground">
                        Only accept SMS from allowed senders
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRequireSenderVerification(!requireSenderVerification)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        requireSenderVerification ? 'bg-primary' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          requireSenderVerification ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Reject SMS from Contacts</Label>
                      <p className="text-xs text-muted-foreground">
                        Reject SMS from numbers in your contacts (prevents spoofing)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRequireContactCheck(!requireContactCheck)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        requireContactCheck ? 'bg-primary' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          requireContactCheck ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
              
              <Button
                onClick={handleGeneratePattern}
                className="w-full bg-[#F37100] hover:bg-[#F37100]/90"
                disabled={loading || smsTexts.every(t => !t.trim()) || !patternName}
              >
                {loading ? 'Generating Pattern...' : 'Generate Pattern'}
              </Button>
              
              {preview?.aiSuggested && preview?.canUseAI && (
                <Button
                  onClick={handleUseAI}
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={aiLoading}
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                  {aiLoading ? 'Creating with AI...' : 'Use AI Generation Instead'}
                  </Button>
                )}
            </CardContent>
          </Card>

          {/* Preview Section */}
          <Card>
            <CardHeader>
              <CardTitle>Pattern Preview</CardTitle>
              <CardDescription>What the system detected and extracted</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {preview ? (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {preview.validation.valid ? (
                          <>
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                            <span className="text-sm font-medium">Pattern Valid</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-5 w-5 text-yellow-500" />
                            <span className="text-sm font-medium">Validation Warnings</span>
                          </>
                        )}
                      </div>
                      {preview.method && (
                        <span className="text-xs px-2 py-1 rounded bg-muted">
                          {preview.method === 'ai' ? '🤖 AI' : '⚡ Rule-Based'}
                        </span>
                      )}
                    </div>
                    {preview.aiSuggested && preview.canUseAI && (
                      <div className="p-3 bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-md">
                        <div className="flex items-start gap-2">
                          <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
                              Rule-based extraction may not be accurate
                            </p>
                            <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                              Try using AI for better pattern accuracy and extraction results.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    {preview.validation.errors.length > 0 && (
                      <ul className="list-disc list-inside text-sm text-muted-foreground">
                        {preview.validation.errors.map((error: string, i: number) => (
                          <li key={i}>{error}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Detected Fields</Label>
                    <div className="p-3 bg-muted rounded-md space-y-1 text-sm">
                      <div><strong>Bank:</strong> {preview.extractedValues?.bank || preview.pattern.bank || 'Not detected'}</div>
                      <div><strong>Currency:</strong> {preview.extractedValues?.currency || preview.pattern.currency || 'Not detected'}</div>
                      <div className="mt-2"><strong>Extracted Values:</strong></div>
                      <div className="text-xs space-y-1 mt-1">
                        <div><strong>Amount:</strong> {preview.extractedValues?.amount ? `${preview.extractedValues.currency || ''} ${preview.extractedValues.amount}` : 'Not detected'}</div>
                        <div><strong>Transaction ID:</strong> {preview.extractedValues?.txnId || 'Not detected'}</div>
                        <div><strong>Sender:</strong> {preview.extractedValues?.sender || 'Not detected'}</div>
                      </div>
                      <div className="mt-2 pt-2 border-t"><strong>Extract Fields (Regex Positions):</strong></div>
                      <pre className="text-xs mt-1 p-2 bg-background rounded">
                        {JSON.stringify(preview.pattern.extractFields, null, 2)}
                      </pre>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>What /api/verify will return:</Label>
                    <div className="p-3 bg-muted rounded-md">
                      <pre className="text-xs">
{JSON.stringify({
  confirmed: true,
  amount: preview.extractedValues?.amount || 0,
  sender: preview.extractedValues?.sender ? preview.extractedValues.sender.replace(/\d{4,}/g, (match: string) => {
    // Mask phone numbers in sender
    if (match.length >= 10) {
      return match.substring(0, 4) + '****' + match.substring(match.length - 2);
    }
    return match;
  }) : null,
  bank: preview.extractedValues?.bank || preview.pattern.bank || 'Unknown',
  receivedAt: new Date().toISOString(),
  txnId: preview.extractedValues?.txnId || 'TXN_ID',
}, null, 2)}
                      </pre>
                    </div>
                  </div>

                  <Button
                    onClick={handleSave}
                    className="w-full bg-[#F37100] hover:bg-[#F37100]/90"
                    disabled={saving || !preview.validation.valid}
                  >
                    {saving ? 'Saving...' : 'Save Pattern'}
                  </Button>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Enter SMS text and click "Analyze SMS" to see preview</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
