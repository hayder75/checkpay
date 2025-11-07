import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { authAPI, auth } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { Copy, RefreshCw } from 'lucide-react';

export default function SettingsPage() {
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const response = await authAPI.getMe();
      setUser(response.data.data);
      auth.setUser(response.data.data);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to load user',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateKey = async () => {
    if (!confirm('Are you sure you want to regenerate your API key? This will invalidate your current key.')) {
      return;
    }

    setRegenerating(true);
    try {
      const response = await authAPI.regenerateKey();
      setUser(response.data.data);
      auth.setUser(response.data.data);
      toast({
        title: 'Success',
        description: 'API key regenerated successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to regenerate key',
        variant: 'destructive',
      });
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your account settings</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>API Key</CardTitle>
            <CardDescription>Your API key for authenticating requests</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-muted rounded-md text-sm">
                {user?.apiKey}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(user?.apiKey || '');
                  toast({
                    title: 'Copied',
                    description: 'API key copied to clipboard',
                  });
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="outline"
              onClick={handleRegenerateKey}
              disabled={regenerating}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {regenerating ? 'Regenerating...' : 'Regenerate Key'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground">Email</div>
              <div className="text-lg">{user?.email || 'Not set'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Phone</div>
              <div className="text-lg">{user?.phone || 'Not set'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Plan</div>
              <div className="text-lg">{user?.plan || 'FREE'}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
