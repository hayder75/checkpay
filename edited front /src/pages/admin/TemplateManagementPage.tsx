import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { adminAPI } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Trash2, ArrowLeft, Crown } from 'lucide-react';
import DashboardLayout from '@/components/layouts/DashboardLayout';

export default function TemplateManagementPage() {
  const { countryCode } = useParams<{ countryCode: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    smsText: '',
    name: '',
    description: '',
    requiredPlan: 'FREE' as 'FREE' | 'PREMIUM',
  });

  useEffect(() => {
    if (countryCode) {
      loadTemplates();
    }
  }, [countryCode]);

  const loadTemplates = async () => {
    if (!countryCode) return;
    setLoading(true);
    try {
      const response = await adminAPI.getTemplates(countryCode);
      setTemplates(response.data.data);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to load templates',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!countryCode) return;
    if (!formData.smsText || !formData.name || !formData.description) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      await adminAPI.createTemplate(countryCode, formData);
      toast({
        title: 'Success',
        description: 'Template created successfully',
      });
      setShowCreateForm(false);
      setFormData({ smsText: '', name: '', description: '', requiredPlan: 'FREE' });
      loadTemplates();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to create template',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await adminAPI.deleteTemplate(templateId);
      toast({
        title: 'Success',
        description: 'Template deleted successfully',
      });
      loadTemplates();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to delete template',
        variant: 'destructive',
      });
    }
  };

  if (!countryCode) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">No country selected</p>
            <Button onClick={() => navigate('/admin/countries')} className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Countries
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Templates for {countryCode}</h1>
            <p className="text-muted-foreground">Manage pattern templates for this country</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate('/admin/countries')} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button onClick={() => setShowCreateForm(!showCreateForm)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Template
            </Button>
          </div>
        </div>

        {showCreateForm && (
          <Card>
            <CardHeader>
              <CardTitle>Create New Template</CardTitle>
              <CardDescription>Add a pre-built pattern template for users</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Example SMS Text *</Label>
                <Textarea
                  value={formData.smsText}
                  onChange={(e) => setFormData({ ...formData, smsText: e.target.value })}
                  placeholder="Paste an example SMS message..."
                  rows={5}
                />
              </div>
              <div>
                <Label>Template Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., CBE to Telebirr"
                />
              </div>
              <div>
                <Label>Description *</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g., Receive money from Commercial Bank of Ethiopia to your Telebirr account"
                  rows={2}
                />
              </div>
              <div>
                <Label>Required Plan</Label>
                <select
                  value={formData.requiredPlan}
                  onChange={(e) => setFormData({ ...formData, requiredPlan: e.target.value as 'FREE' | 'PREMIUM' })}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="FREE">FREE</option>
                  <option value="PREMIUM">PREMIUM</option>
                </select>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreateTemplate} className="bg-[#F37100] hover:bg-[#F37100]/90">
                  Create Template
                </Button>
                <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground">Loading templates...</p>
            </CardContent>
          </Card>
        ) : templates.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground mb-4">No templates yet</p>
              <Button onClick={() => setShowCreateForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create First Template
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <Card key={template.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle>{template.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {template.description || 'No description'}
                      </CardDescription>
                    </div>
                    {template.requiredPlan === 'PREMIUM' && (
                      <Crown className="h-5 w-5 text-yellow-500" />
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{template.bank || 'Unknown Bank'}</span>
                      <span>•</span>
                      <span>{template.currency || 'No currency'}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Used by {template.userCount || 0} user{template.userCount !== 1 ? 's' : ''}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="w-full"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
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

