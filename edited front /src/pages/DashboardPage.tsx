import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { dashboardAPI, authAPI } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { TrendingUp, FileText, History, Zap, AlertCircle } from 'lucide-react';

export default function DashboardPage() {
  const { toast } = useToast();
  const [stats, setStats] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, userRes] = await Promise.all([
        dashboardAPI.getStats(),
        authAPI.getMe(),
      ]);
      setStats(statsRes.data.data);
      setUser(userRes.data.data);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to load dashboard',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
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
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's your overview.</p>
        </div>

        {/* Limit Warning Banner */}
        {user?.plan === 'FREE' && stats?.usageStats && (
          (() => {
            const appRequestsMonth = stats.usageStats.appRequestsMonth || 0;
            const limit = 100;
            const percentage = (appRequestsMonth / limit) * 100;
            const isLimitReached = appRequestsMonth >= limit;
            const isNearLimit = percentage >= 80;

            if (isLimitReached || isNearLimit) {
              return (
                <Card className={isLimitReached ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'}>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <AlertCircle className={`h-5 w-5 mt-0.5 ${isLimitReached ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'}`} />
                      <div className="flex-1">
                        <h3 className={`font-semibold mb-1 ${isLimitReached ? 'text-red-900 dark:text-red-100' : 'text-yellow-900 dark:text-yellow-100'}`}>
                          {isLimitReached 
                            ? 'Free Plan Limit Reached' 
                            : 'Approaching Free Plan Limit'}
                        </h3>
                        <p className={`text-sm mb-3 ${isLimitReached ? 'text-red-800 dark:text-red-200' : 'text-yellow-800 dark:text-yellow-200'}`}>
                          {isLimitReached 
                            ? `You've used all ${limit} free transactions this month. Upgrade to Premium for unlimited transactions, or wait until next month when your limit resets.`
                            : `You've used ${appRequestsMonth} of ${limit} free transactions this month (${Math.round(percentage)}%). Upgrade to Premium for unlimited transactions.`}
                        </p>
                        <div className="flex gap-2">
                          <Link to="/dashboard/premium">
                            <Button className="bg-[#F37100] hover:bg-[#F37100]/90">
                              Upgrade to Premium
                            </Button>
                          </Link>
                          {!isLimitReached && (
                            <div className="flex items-center text-sm text-yellow-800 dark:text-yellow-200">
                              {limit - appRequestsMonth} remaining
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            }
            return null;
          })()
        )}

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Transactions Today</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.transactions?.today || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.transactions?.thisMonth || 0} this month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Patterns</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.patterns?.total || 0}</div>
              <p className="text-xs text-muted-foreground">Active patterns</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Usage</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.usageStats?.appRequestsMonth || 0} / {user?.plan === 'PREMIUM' ? '∞' : '100'}
              </div>
              <p className="text-xs text-muted-foreground">
                {user?.plan === 'PREMIUM' ? 'Unlimited' : 'Transactions this month'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Plan</CardTitle>
              <History className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.plan || 'FREE'}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.plan === 'PREMIUM' ? 'Unlimited' : '100/month'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Create Pattern</CardTitle>
              <CardDescription>Build a new SMS parser pattern</CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/dashboard/patterns/new">
                <Button className="bg-[#F37100] hover:bg-[#F37100]/90">
                  Create Pattern
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>View Transactions</CardTitle>
              <CardDescription>See all your parsed transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/dashboard/transactions">
                <Button variant="outline">View All</Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* API Key Display */}
        {user && (
          <Card>
            <CardHeader>
              <CardTitle>Your API Key</CardTitle>
              <CardDescription>Use this key to authenticate API requests</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-muted rounded-md text-sm">
                  {user.apiKey}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(user.apiKey);
                    toast({
                      title: 'Copied',
                      description: 'API key copied to clipboard',
                    });
                  }}
                >
                  Copy
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
