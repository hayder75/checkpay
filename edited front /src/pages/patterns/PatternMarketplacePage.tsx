import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { templatesAPI, authAPI } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { Check, Plus, Crown, AlertCircle } from 'lucide-react';

export default function PatternMarketplacePage() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userPlan, setUserPlan] = useState<'FREE' | 'PREMIUM'>('FREE');
  const [limits, setLimits] = useState<{ current: number; max: number | null; canAddMore: boolean }>({
    current: 0,
    max: 4,
    canAddMore: true,
  });

  useEffect(() => {
    loadTemplates();
    loadUserInfo();
  }, []);

  const loadUserInfo = async () => {
    try {
      const response = await authAPI.getMe();
      setUserPlan(response.data.data.plan);
    } catch (error) {
      // Ignore error
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await templatesAPI.getAvailable();
      setTemplates(response.data.data);
      if (response.data.limits) {
        setLimits(response.data.limits);
      }
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

  const handleAddTemplate = async (templateId: string) => {
    try {
      await templatesAPI.add(templateId);
      toast({
        title: 'Success',
        description: 'Template added to your patterns',
      });
      loadTemplates(); // Reload to update status
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to add template',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveTemplate = async (templateId: string) => {
    try {
      await templatesAPI.remove(templateId);
      toast({
        title: 'Success',
        description: 'Template removed from your patterns',
      });
      loadTemplates(); // Reload to update status
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to remove template',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading templates...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Pattern Marketplace</h1>
            <p className="text-muted-foreground">Browse and add pre-built patterns to your system</p>
            {limits.max !== null && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Patterns: {limits.current}/{limits.max} {userPlan === 'FREE' && '(FREE)'}
                </span>
                {!limits.canAddMore && (
                  <span className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    Limit reached
                  </span>
                )}
              </div>
            )}
          </div>
          <Link to="/dashboard/patterns">
            <Button variant="outline">Back to Patterns</Button>
          </Link>
        </div>

        {!limits.canAddMore && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <p className="font-medium">You've reached the free limit ({limits.max} patterns)</p>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Upgrade to Premium for unlimited patterns!{' '}
                <Link to="/dashboard/premium" className="text-[#F37100] hover:underline">
                  Upgrade now
                </Link>
              </p>
            </CardContent>
          </Card>
        )}

        {templates.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground mb-4">No templates available for your country</p>
              <p className="text-sm text-muted-foreground">
                Templates will appear here once admins create them for your country.
              </p>
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
                    {template.userCount > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Used by {template.userCount} user{template.userCount !== 1 ? 's' : ''}
                      </p>
                    )}
                    <div className="flex gap-2">
                      {template.isAdded ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            disabled
                          >
                            <Check className="mr-2 h-4 w-4" />
                            Added
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveTemplate(template.id)}
                          >
                            Remove
                          </Button>
                        </>
                      ) : (
                        <Button
                          className="flex-1 bg-[#F37100] hover:bg-[#F37100]/90"
                          size="sm"
                          onClick={() => handleAddTemplate(template.id)}
                          disabled={!template.canAdd || !limits.canAddMore}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          {template.requiredPlan === 'PREMIUM' && userPlan === 'FREE'
                            ? 'Upgrade to Add'
                            : 'Add Pattern'}
                        </Button>
                      )}
                    </div>
                    {template.requiredPlan === 'PREMIUM' && userPlan === 'FREE' && !template.isAdded && (
                      <p className="text-xs text-muted-foreground">
                        Premium template -{' '}
                        <Link to="/dashboard/premium" className="text-[#F37100] hover:underline">
                          upgrade to access
                        </Link>
                      </p>
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

