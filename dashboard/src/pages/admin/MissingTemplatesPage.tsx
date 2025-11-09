import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { adminAPI, countriesAPI } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { AlertCircle, Plus, X, Crown } from 'lucide-react';

export default function MissingTemplatesPage() {
  const { toast } = useToast();
  const [missingTemplates, setMissingTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [countries, setCountries] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [addFormData, setAddFormData] = useState({
    countryCode: '',
    name: '',
    description: '',
    requiredPlan: 'FREE' as 'FREE' | 'PREMIUM',
  });

  useEffect(() => {
    loadMissingTemplates();
    loadCountries();
  }, []);

  const loadCountries = async () => {
    try {
      const response = await countriesAPI.getAll();
      setCountries(response.data.data);
    } catch (error) {
      // Ignore error
    }
  };

  const loadMissingTemplates = async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getMissingTemplates();
      setMissingTemplates(response.data.data);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to load missing templates',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddTemplate = async (patternId: string) => {
    if (!addFormData.countryCode || !addFormData.name || !addFormData.description) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      await adminAPI.addMissingTemplate(patternId, addFormData);
      toast({
        title: 'Success',
        description: 'Template added to library',
      });
      setSelectedGroup(null);
      setAddFormData({ countryCode: '', name: '', description: '', requiredPlan: 'FREE' });
      loadMissingTemplates();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to add template',
        variant: 'destructive',
      });
    }
  };

  const handleDismiss = async (patternId: string) => {
    if (!confirm('Are you sure you want to dismiss this flagged pattern?')) return;

    try {
      await adminAPI.dismissMissingTemplate(patternId, { reason: 'Dismissed by admin' });
      toast({
        title: 'Success',
        description: 'Pattern flag dismissed',
      });
      loadMissingTemplates();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to dismiss pattern',
        variant: 'destructive',
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Missing Templates</h1>
            <p className="text-muted-foreground">
              Patterns used by multiple users but not in template library
            </p>
          </div>
          <Button onClick={loadMissingTemplates} variant="outline">
            Refresh
          </Button>
        </div>

        {loading ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground">Loading missing templates...</p>
            </CardContent>
          </Card>
        ) : missingTemplates.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No missing templates detected</p>
              <p className="text-sm text-muted-foreground mt-2">
                All popular patterns are already in the template library!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {missingTemplates.map((group, index) => (
              <Card key={index}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>
                        {group.bank || 'Unknown Bank'} → {group.currency || 'Unknown Currency'}
                      </CardTitle>
                      <CardDescription>
                        Used by {group.userCount} user{group.userCount !== 1 ? 's' : ''}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedGroup(selectedGroup === String(index) ? null : String(index))}
                      >
                        {selectedGroup === String(index) ? (
                          <>
                            <X className="mr-2 h-4 w-4" />
                            Cancel
                          </>
                        ) : (
                          <>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Template
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium mb-1">Similar Patterns:</p>
                      <div className="space-y-1">
                        {group.patterns.slice(0, 3).map((pattern: any) => (
                          <div key={pattern.id} className="text-sm text-muted-foreground">
                            • {pattern.name} (User: {pattern.user?.username || pattern.userId?.substring(0, 8)})
                          </div>
                        ))}
                        {group.patterns.length > 3 && (
                          <div className="text-sm text-muted-foreground">
                            ... and {group.patterns.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>

                    {selectedGroup === String(index) && (
                      <div className="mt-4 p-4 bg-muted rounded-lg space-y-4">
                        <div>
                          <Label>Country *</Label>
                          <select
                            value={addFormData.countryCode}
                            onChange={(e) => setAddFormData({ ...addFormData, countryCode: e.target.value })}
                            className="w-full px-3 py-2 border rounded-md"
                          >
                            <option value="">Select country...</option>
                            {countries.map((country) => (
                              <option key={country.code} value={country.code}>
                                {country.name} ({country.code})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <Label>Template Name *</Label>
                          <Input
                            value={addFormData.name}
                            onChange={(e) => setAddFormData({ ...addFormData, name: e.target.value })}
                            placeholder="e.g., CBE to Telebirr"
                          />
                        </div>
                        <div>
                          <Label>Description *</Label>
                          <Textarea
                            value={addFormData.description}
                            onChange={(e) => setAddFormData({ ...addFormData, description: e.target.value })}
                            placeholder="e.g., Receive money from Commercial Bank of Ethiopia to your Telebirr account"
                            rows={2}
                          />
                        </div>
                        <div>
                          <Label>Required Plan</Label>
                          <select
                            value={addFormData.requiredPlan}
                            onChange={(e) => setAddFormData({ ...addFormData, requiredPlan: e.target.value as 'FREE' | 'PREMIUM' })}
                            className="w-full px-3 py-2 border rounded-md"
                          >
                            <option value="FREE">FREE</option>
                            <option value="PREMIUM">PREMIUM</option>
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleAddTemplate(group.patterns[0].id)}
                            className="bg-[#F37100] hover:bg-[#F37100]/90"
                          >
                            Add to Template Library
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => handleDismiss(group.patterns[0].id)}
                          >
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

