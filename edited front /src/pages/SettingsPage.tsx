import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authAPI, auth } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { Copy, RefreshCw, Plus, Trash2, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function SettingsPage() {
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [simCards, setSimCards] = useState<any[]>([]);
  const [addingSim, setAddingSim] = useState(false);
  const [newSimIccid, setNewSimIccid] = useState('');
  const [newSimPhone, setNewSimPhone] = useState('');

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const response = await authAPI.getMe();
      setUser(response.data.data);
      auth.setUser(response.data.data);
      setSimCards(response.data.data.simCards || []);
      
      // Also load SIM cards separately
      try {
        const simsResponse = await authAPI.getSimCards();
        setSimCards(simsResponse.data.data || []);
      } catch (err) {
        // Ignore if endpoint doesn't exist yet
      }
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

  const handleAddSim = async () => {
    if (!newSimIccid.trim() || !newSimPhone.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter both ICCID and phone number',
        variant: 'destructive',
      });
      return;
    }

    setAddingSim(true);
    try {
      await authAPI.addSimCard({
        iccid: newSimIccid.trim(),
        phoneNumber: newSimPhone.trim(),
      });
      toast({
        title: 'Success',
        description: 'SIM card added successfully',
      });
      setNewSimIccid('');
      setNewSimPhone('');
      await loadUser();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to add SIM card',
        variant: 'destructive',
      });
    } finally {
      setAddingSim(false);
    }
  };

  const handleRemoveSim = async (id: string) => {
    if (!confirm('Are you sure you want to remove this SIM card?')) {
      return;
    }

    try {
      await authAPI.removeSimCard(id);
      toast({
        title: 'Success',
        description: 'SIM card removed successfully',
      });
      await loadUser();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to remove SIM card',
        variant: 'destructive',
      });
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
              <div className="text-lg flex items-center gap-2">
                {user?.plan || 'FREE'}
                {user?.plan === 'FREE' && (
                  <Link to="/dashboard/premium">
                    <Button size="sm" className="bg-[#F37100] hover:bg-[#F37100]/90">
                      Upgrade to Premium
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Registered SIM Cards</CardTitle>
            <CardDescription>
              {user?.plan === 'FREE' 
                ? 'Free plan allows 1 SIM card. Upgrade to Premium to add more.'
                : 'Premium plan allows up to 10 SIM cards.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {simCards.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No SIM cards registered yet.</p>
                <p className="text-sm mt-2">SIM cards are registered automatically when you verify OTP from the mobile app.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {simCards.map((sim) => (
                  <div
                    key={sim.id}
                    className="flex items-center justify-between p-3 border rounded-md"
                  >
                    <div>
                      <div className="font-medium">{sim.phoneNumber}</div>
                      <div className="text-sm text-muted-foreground">
                        ICCID: {sim.iccid.substring(0, 8)}...
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Added: {new Date(sim.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    {sim.isActive && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveSim(sim.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {(user?.plan === 'PREMIUM' || simCards.length === 0) && (
              <div className="pt-4 border-t space-y-4">
                <div className="space-y-2">
                  <Label>Add New SIM Card</Label>
                  <Input
                    placeholder="SIM ICCID (from mobile app)"
                    value={newSimIccid}
                    onChange={(e) => setNewSimIccid(e.target.value)}
                  />
                  <Input
                    placeholder="Phone Number"
                    value={newSimPhone}
                    onChange={(e) => setNewSimPhone(e.target.value)}
                  />
                  <Button
                    onClick={handleAddSim}
                    disabled={addingSim}
                    className="bg-[#F37100] hover:bg-[#F37100]/90"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {addingSim ? 'Adding...' : 'Add SIM Card'}
                  </Button>
                </div>
                {user?.plan === 'FREE' && simCards.length >= 1 && (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      Free plan allows only 1 SIM card. <Link to="/dashboard/premium" className="underline font-medium">Upgrade to Premium</Link> to add more.
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
