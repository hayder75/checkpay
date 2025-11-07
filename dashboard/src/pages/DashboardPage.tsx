import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { dashboardAPI, authAPI } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { TrendingUp, FileText, History, Zap } from 'lucide-react';

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
              <CardTitle className="text-sm font-medium">Rate Limit</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.rateLimit?.remaining || 0} / {stats?.rateLimit?.max || 100}
              </div>
              <p className="text-xs text-muted-foreground">Remaining requests</p>
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
