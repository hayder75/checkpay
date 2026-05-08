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
import { Save } from 'lucide-react';

export default function PatternEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [, setPattern] = useState<any>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [bank, setBank] = useState('');
  const [currency, setCurrency] = useState('');
  // Security fields
  const [allowedSenders, setAllowedSenders] = useState<string[]>([]);
  const [senderInput, setSenderInput] = useState('');
  const [requireSenderVerification, setRequireSenderVerification] = useState(true);
  const [requireContactCheck, setRequireContactCheck] = useState(true);

  useEffect(() => {
    if (id) {
      loadPattern();
    }
  }, [id]);

  const loadPattern = async () => {
    try {
      const response = await patternsAPI.getOne(id!);
      const data = response.data.data;
      setPattern(data);
      setName(data.name);
      setDescription(data.description || '');
      setBank(data.bank || '');
      setCurrency(data.currency || '');
      // Security fields
      setAllowedSenders(Array.isArray(data.allowedSenders) ? data.allowedSenders : []);
      setRequireSenderVerification(data.requireSenderVerification !== false);
      setRequireContactCheck(data.requireContactCheck !== false);
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


  const handleSave = async () => {
    if (!name) {
      toast({
        title: 'Error',
        description: 'Pattern name is required',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const updateData: any = {
        name,
        description: description || undefined,
        bank: bank || undefined,
        currency: currency || undefined,
        // Security fields
        allowedSenders: allowedSenders.length > 0 ? allowedSenders : [],
        requireSenderVerification,
        requireContactCheck,
      };

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
              </CardContent>
            </Card>

          </div>

          {/* Save Button Section */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <Button
                  onClick={handleSave}
                  className="w-full bg-[#F37100] hover:bg-[#F37100]/90"
                  disabled={saving || !name}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
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
