import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { dashboardAPI, authAPI, userPackageAPI } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { FileText, History, Package, CheckCircle, Calendar, ArrowUp, ArrowDown, BarChart3 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#F37100', '#22c55e', '#3b82f6', '#a855f7', '#ef44444'];

function StatCard({ title, value, icon: Icon, trend, description }: { title: string; value: string | number; icon: any; trend?: string; description?: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {trend && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            {trend.startsWith('+') ? <ArrowUp className="h-3 w-3 text-green-500" /> : <ArrowDown className="h-3 w-3 text-red-500" />}
            {trend} <span className="text-muted-foreground/70">from last month</span>
          </p>
        )}
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  );
}

function LoadingStatCard() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4 rounded" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16 mb-2" />
        <Skeleton className="h-3 w-20" />
      </CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  const { toast } = useToast();
  const [stats, setStats] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [userPackage, setUserPackage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, userRes] = await Promise.all([
        dashboardAPI.getStats(),
        authAPI.getMe(),
      ]);
      
      setStats(statsRes.data.data);
      setUser(userRes.data.data);

      if (statsRes.data.data?.packageId) {
        try {
          const packageRes = await userPackageAPI.getOne(statsRes.data.data.packageId);
          setUserPackage(packageRes.data?.data);
        } catch {
          setUserPackage(null);
        }
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Failed to load analytics';
      if (errorMessage.includes('no transactions') || errorMessage.includes('No data')) {
        setError('no_data');
      } else {
        setError(errorMessage);
        toast({ title: "Error", description: errorMessage, variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const transactionData = stats?.transactions?.chartData || [
    { date: 'Mon', transactions: 12 },
    { date: 'Tue', transactions: 19 },
    { date: 'Wed', transactions: 15 },
    { date: 'Thu', transactions: 25 },
    { date: 'Fri', transactions: 22 },
    { date: 'Sat', transactions: 30 },
    { date: 'Sun', transactions: 28 },
  ];

  const hasChartData = stats && Object.keys(stats).length > 0;
  const hasTokenData = stats?.tokens?.phone?.used > 0 || stats?.tokens?.verified?.used > 0;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Analytics</h1>
              <p className="text-muted-foreground mt-1">Track your usage and performance insights</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm"><Calendar className="h-4 w-4 mr-2" />Last 7 days</Button>
            </div>
          </div>
          <Separator />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => <LoadingStatCard key={i} />)}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error === 'no_data' || !stats) {
    return (
      <DashboardLayout>
        <div className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Analytics</h1>
              <p className="text-muted-foreground mt-1">Track your usage and performance insights</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm"><Calendar className="h-4 w-4 mr-2" />Last 7 days</Button>
            </div>
          </div>
          <Separator />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Total Transactions" value={0} icon={History} />
            <StatCard title="Active Patterns" value={0} icon={FileText} />
            <StatCard title="Phone Tokens" value="∞" icon={Package} description="0 used" />
            <StatCard title="Verified Tokens" value="∞" icon={CheckCircle} description="0 used" />
          </div>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <BarChart3 className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No data yet</h3>
              <p className="text-muted-foreground max-w-md">
                Start receiving transactions to see your analytics here. Your charts and statistics will appear once you have transaction data.
              </p>
              <Button variant="outline" className="mt-4" onClick={loadData}>
                Refresh
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Analytics</h1>
            <p className="text-muted-foreground mt-1">Track your usage and performance insights</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadData}><Calendar className="h-4 w-4 mr-2" />Last 7 days</Button>
          </div>
        </div>

        <Separator />

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Transactions" value={stats?.transactions?.thisMonth || 0} icon={History} trend="+12%" />
          <StatCard title="Active Patterns" value={stats?.patterns?.total || 0} icon={FileText} />
          <StatCard title="Phone Tokens" value={stats?.tokens?.phone?.remaining ?? "∞"} icon={Package} description={`${stats?.tokens?.phone?.used} used`} />
          <StatCard title="Verified Tokens" value={stats?.tokens?.verified?.remaining ?? "∞"} icon={CheckCircle} description={`${stats?.tokens?.verified?.used} used`} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Transaction Trend</CardTitle>
              <CardDescription>Your transaction activity over the past week</CardDescription>
            </CardHeader>
            <CardContent>
              {hasChartData ? (
                <div style={{ minHeight: 300, minWidth: 400 }}>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={transactionData}>
                      <defs>
                        <linearGradient id="colorTransactions" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#F37100" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#F37100" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                      <Area type="monotone" dataKey="transactions" stroke="#F37100" fillOpacity={1} fill="url(#colorTransactions)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-80 text-center">
                  <History className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No transaction data available</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Token Usage</CardTitle>
              <CardDescription>Distribution of tokens used</CardDescription>
            </CardHeader>
            <CardContent>
              {hasTokenData ? (
                <div style={{ minHeight: 200, minWidth: 200 }}>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={[
                        { name: 'Phone', value: stats?.tokens?.phone?.used || 0 },
                        { name: 'Verified', value: stats?.tokens?.verified?.used || 0 },
                      ]} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                        {[0, 1].map((_, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <Package className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No token usage data</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Current Package</CardTitle>
              <CardDescription>{userPackage?.name || 'Free Plan'}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm font-medium">Phone Tokens</span>
                  <Badge variant={stats?.tokens?.phone?.remaining > 0 ? "default" : "destructive"}>{stats?.tokens?.phone?.remaining ?? "Unlimited"}</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm font-medium">Verified Tokens</span>
                  <Badge variant={stats?.tokens?.verified?.remaining > 0 ? "default" : "destructive"}>{stats?.tokens?.verified?.remaining ?? "Unlimited"}</Badge>
                </div>
                <Button className="w-full" variant="outline">View Package Details</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}