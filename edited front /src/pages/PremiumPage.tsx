import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { premiumAPI } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { Crown, Check } from 'lucide-react';

export default function PremiumPage() {
  const { toast } = useToast();
  const [status, setStatus] = useState<any>(null);
  const [txnId, setTxnId] = useState('');
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const response = await premiumAPI.getStatus();
      setStatus(response.data.data);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to load status',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpgrading(true);

    try {
      await premiumAPI.upgrade(txnId);
      toast({
        title: 'Success',
        description: 'Successfully upgraded to Premium!',
      });
      setTxnId('');
      loadStatus();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to upgrade',
        variant: 'destructive',
      });
    } finally {
      setUpgrading(false);
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

  const isPremium = status?.plan === 'PREMIUM';

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold">Premium Upgrade</h1>
          <p className="text-muted-foreground">Unlock unlimited transactions</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-[#F37100]" />
                Premium Plan
              </CardTitle>
              <CardDescription>$15/month - Unlimited transactions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Unlimited transactions</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Priority support</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Advanced analytics</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Current Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground">Plan</div>
                <div className="text-2xl font-bold">{status?.plan || 'FREE'}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Usage</div>
                <div className="text-lg">
                  {status?.usage?.used || 0} / {status?.usage?.limit || 100}
                </div>
                <div className="text-sm text-muted-foreground">
                  {status?.usage?.remaining || 0} remaining
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {!isPremium && (
          <Card>
            <CardHeader>
              <CardTitle>Upgrade to Premium</CardTitle>
              <CardDescription>
                Send $15 via mobile money, then enter the transaction ID below
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpgrade} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="txnId">Transaction ID</Label>
                  <Input
                    id="txnId"
                    placeholder="MP123456789"
                    value={txnId}
                    onChange={(e) => setTxnId(e.target.value)}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-[#F37100] hover:bg-[#F37100]/90"
                  disabled={upgrading}
                >
                  {upgrading ? 'Upgrading...' : 'Upgrade to Premium'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {isPremium && (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <Crown className="h-12 w-12 mx-auto mb-4 text-[#F37100]" />
                <h3 className="text-xl font-bold mb-2">You're Premium!</h3>
                <p className="text-muted-foreground">
                  Enjoy unlimited transactions and all premium features.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
