import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { patternsAPI } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { Sparkles, CheckCircle2, AlertCircle, Save } from 'lucide-react';

export default function PatternEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);


  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [regex, setRegex] = useState('');
  const [bank, setBank] = useState('');
  const [currency, setCurrency] = useState('');
  const [smsText, setSmsText] = useState('');
  const [preview, setPreview] = useState<any>(null);

  useEffect(() => {
    if (id) {
      loadPattern();
    }
  }, [id]);

  const loadPattern = async () => {
    try {
      const response = await patternsAPI.getOne(id!);
      const data = response.data.data;

      setName(data.name);
      setDescription(data.description || '');
      setRegex(data.regex);
      setBank(data.bank || '');
      setCurrency(data.currency || '');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to load pattern',
        variant: 'destructive',
      });
      navigate('/dashboard/patterns');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!smsText || !name) {
      toast({
        title: 'Error',
        description: 'Please enter SMS text and pattern name',
        variant: 'destructive',
      });
      return;
    }

    setAnalyzing(true);
    try {
      const response = await patternsAPI.validate({ smsText, name });
      setPreview(response.data.data);
      // Update fields with detected values
      if (response.data.data.pattern.bank) {
        setBank(response.data.data.pattern.bank);
      }
      if (response.data.data.pattern.currency) {
        setCurrency(response.data.data.pattern.currency);
      }
      if (response.data.data.pattern.regex) {
        setRegex(response.data.data.pattern.regex);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to analyze pattern',
        variant: 'destructive',
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!name || !regex) {
      toast({
        title: 'Error',
        description: 'Name and regex are required',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const updateData: any = {
        name,
        regex,
        description: description || undefined,
        bank: bank || undefined,
        currency: currency || undefined,
      };

      // If preview exists and has extractFields, include it
      if (preview?.pattern?.extractFields) {
        updateData.extractFields = preview.pattern.extractFields;
      }

      await patternsAPI.update(id!, updateData);
      toast({
        title: 'Success',
        description: 'Pattern updated successfully!',
      });
      navigate('/dashboard/patterns');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to update pattern',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading pattern...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold">Edit Pattern</h1>
          <p className="text-muted-foreground">Update your SMS parsing pattern</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Edit Form */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Pattern Details</CardTitle>
                <CardDescription>Update pattern information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Pattern Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Input
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank">Bank/Service</Label>
                  <Input
                    id="bank"
                    value={bank}
                    onChange={(e) => setBank(e.target.value)}
                    placeholder="M-Pesa"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Input
                    id="currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    placeholder="KES"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="regex">Regex Pattern</Label>
                  <Textarea
                    id="regex"
                    value={regex}
                    onChange={(e) => setRegex(e.target.value)}
                    rows={4}
                    className="font-mono text-sm"
                    required
                  />
                </div>
              </CardContent>
            </Card>

            {/* Test with SMS */}
            <Card>
              <CardHeader>
                <CardTitle>Test Pattern</CardTitle>
                <CardDescription>Test this pattern with a sample SMS</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sms">Sample SMS</Label>
                  <Textarea
                    id="sms"
                    placeholder="You received KES 500 from JOHN DOE. Ref: MP123456789"
                    value={smsText}
                    onChange={(e) => setSmsText(e.target.value)}
                    rows={4}
                  />
                </div>
                <Button
                  onClick={handleAnalyze}
                  variant="outline"
                  className="w-full"
                  disabled={analyzing || !smsText}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  {analyzing ? 'Analyzing...' : 'Test Pattern'}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Preview Section */}
          <Card>
            <CardHeader>
              <CardTitle>Preview & Validation</CardTitle>
              <CardDescription>Pattern analysis and validation results</CardDescription>
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
                      <div><strong>Bank:</strong> {preview.pattern.bank || 'Not detected'}</div>
                      <div><strong>Currency:</strong> {preview.pattern.currency || 'Not detected'}</div>
                      <div><strong>Extract Fields:</strong></div>
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
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Enter a sample SMS and click "Test Pattern" to see preview</p>
                </div>
              )}

              <div className="pt-4 border-t">
                <Button
                  onClick={handleSave}
                  className="w-full bg-[#F37100] hover:bg-[#F37100]/90"
                  disabled={saving || !name || !regex}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  variant="outline"
                  className="w-full mt-2"
                  onClick={() => navigate('/dashboard/patterns')}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
