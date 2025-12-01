import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { adminAPI } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { FileText, Globe, Activity, RefreshCw, DollarSign } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AnalyticsPage() {
  const { toast } = useToast();
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getAnalytics();
      setAnalytics(response.data.data);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to load analytics',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading analytics...</div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">No analytics data available</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Analytics</h1>
            <p className="text-sm text-muted-foreground">Platform statistics and insights</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={loadAnalytics} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Link to="/admin/dashboard">
              <Button variant="outline">Back to Dashboard</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Users</CardDescription>
                <CardTitle className="text-3xl">{analytics.users.total}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  <div>Free: {analytics.users.free}</div>
                  <div>Premium: {analytics.users.premium}</div>
                  <div>Admins: {analytics.users.admin}</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Patterns</CardDescription>
                <CardTitle className="text-3xl">{analytics.patterns.total}</CardTitle>
              </CardHeader>
              <CardContent>
                <FileText className="h-8 w-8 text-muted-foreground" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Transactions</CardDescription>
                <CardTitle className="text-3xl">{analytics.transactions.total}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  <div>Today: {analytics.transactions.today}</div>
                  <div>This Month: {analytics.transactions.thisMonth}</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>API Usage</CardDescription>
                <CardTitle className="text-lg">Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-1">
                  <div>App Today: {analytics.usage.appRequestsToday}</div>
                  <div>App Month: {analytics.usage.appRequestsMonth}</div>
                  <div>Dev Today: {analytics.usage.devRequestsToday}</div>
                  <div>Dev Month: {analytics.usage.devRequestsMonth}</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Distribution Charts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Users by Country
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analytics.distribution.usersByCountry.length > 0 ? (
                  <div className="space-y-2">
                    {analytics.distribution.usersByCountry.slice(0, 10).map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span>{item.country || 'Unknown'}</span>
                        <span className="font-medium">{item.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No data available</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Patterns by Currency
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analytics.distribution.patternsByCurrency.length > 0 ? (
                  <div className="space-y-2">
                    {analytics.distribution.patternsByCurrency.slice(0, 10).map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span>{item.currency || 'Unknown'}</span>
                        <span className="font-medium">{item.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No data available</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Transactions by Bank
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analytics.distribution.transactionsByBank.length > 0 ? (
                  <div className="space-y-2">
                    {analytics.distribution.transactionsByBank.slice(0, 10).map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span>{item.bank || 'Unknown'}</span>
                        <span className="font-medium">{item.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No data available</div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}



