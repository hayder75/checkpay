import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { patternsAPI } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';

export default function PatternBuilderPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [smsText, setSmsText] = useState('');
  const [patternName, setPatternName] = useState('');
  const [description, setDescription] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleAnalyze = async () => {
    if (!smsText || !patternName) {
      toast({
        title: 'Error',
        description: 'Please enter SMS text and pattern name',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await patternsAPI.validate({ smsText, name: patternName });
      setPreview(response.data.data);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to analyze pattern',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!smsText || !patternName) {
      toast({
        title: 'Error',
        description: 'Please enter SMS text and pattern name',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      await patternsAPI.create({ smsText, name: patternName, description });
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
            Paste an SMS and let AI build your parser pattern
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Input Section */}
          <Card>
            <CardHeader>
              <CardTitle>Input SMS</CardTitle>
              <CardDescription>Paste a real SMS from your bank or mobile money service</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sms">SMS Text</Label>
                <Textarea
                  id="sms"
                  placeholder="You received KES 500 from JOHN DOE. Ref: MP123456789"
                  value={smsText}
                  onChange={(e) => setSmsText(e.target.value)}
                  rows={6}
                />
              </div>
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
              <Button
                onClick={handleAnalyze}
                className="w-full bg-[#F37100] hover:bg-[#F37100]/90"
                disabled={loading || !smsText || !patternName}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {loading ? 'Analyzing...' : 'Analyze SMS'}
              </Button>
            </CardContent>
          </Card>

          {/* Preview Section */}
          <Card>
            <CardHeader>
              <CardTitle>AI Analysis Preview</CardTitle>
              <CardDescription>What the system detected and extracted</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {preview ? (
                <>
                  <div className="space-y-2">
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
                    <Label>Generated Regex</Label>
                    <code className="block p-3 bg-muted rounded-md text-xs break-all">
                      {preview.pattern.regex}
                    </code>
                  </div>

                  <div className="space-y-2">
                    <Label>What /api/verify will return:</Label>
                    <div className="p-3 bg-muted rounded-md">
                      <pre className="text-xs">
{JSON.stringify({
  confirmed: true,
  amount: preview.extractedValues?.amount || 0,
  sender: preview.extractedValues?.sender ? preview.extractedValues.sender.replace(/\d{4,}/g, (match) => {
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
