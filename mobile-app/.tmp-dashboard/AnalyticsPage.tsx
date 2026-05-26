import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { adminAPI } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { Users, Globe, Activity, RefreshCw, DollarSign, Package, Target, Wallet } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import DashboardLayout from '@/components/layouts/DashboardLayout';

const COLORS = ['#F37100', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

const formatCurrency = (value: number | undefined) => {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
};

export default function AdminAnalyticsPage() {
  const { toast } = useToast();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getAnalytics();
      setStats(response.data.data);
    } catch (error: any) {
      toast({ title: "Error", description: error.response?.data?.error || "Failed to load analytics", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const overview = stats?.overview || {};
  const users = stats?.users || {};
  const transactions = stats?.transactions || {};
  const countries = stats?.countries || {};
  const packages = stats?.packages || {};
  const referrals = stats?.referrals || {};
  const cashPayments = stats?.cashPayments || {};
  const userData = users?.daily || [];
  const txnData = transactions?.daily || [];
  const txStatusData = [
    { name: 'Validated', value: transactions?.growthWeek !== undefined ? Number(transactions?.thisWeek || 0) : 0 },
    { name: 'Today', value: Number(transactions?.today || 0) },
    { name: 'Month', value: Number(transactions?.thisMonth || 0) },
  ].filter((item) => item.value > 0);
  const roleData = stats?.distribution?.usersByRole || [];
  const bankData = (stats?.distribution?.transactionsByBank || []).slice(0, 6);
  const topUsers = stats?.topUsers || [];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Platform Analytics</h1>
            <p className="text-muted-foreground mt-1">Platform-wide statistics and insights</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadStats}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
        </div>

        <Separator />

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => <Card key={i}><CardHeader><Skeleton className="h-4 w-24" /></CardHeader><CardContent><Skeleton className="h-8 w-16" /></CardContent></Card>)}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Users</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{users?.total || overview?.totalUsers || 0}</div><p className="text-xs text-muted-foreground">{users?.active || 0} active in last 30 days</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Transactions</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{transactions?.total || overview?.totalTransactions || 0}</div><p className="text-xs text-muted-foreground">Today: {transactions?.today || 0} • Month: {transactions?.thisMonth || 0}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Cash Collected</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(cashPayments?.totalAmount)}</div><p className="text-xs text-muted-foreground">Today: {formatCurrency(cashPayments?.todayAmount)}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Referral Conversions</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{referrals?.paidConversions || 0}</div><p className="text-xs text-muted-foreground">Signups: {referrals?.signups || 0}</p></CardContent></Card>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>User Growth</CardTitle><CardDescription>New users over time</CardDescription></CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={userData}>
                    <defs><linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#F37100" stopOpacity={0.3} /><stop offset="95%" stopColor="#F37100" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                    <Area type="monotone" dataKey="count" stroke="#F37100" fillOpacity={1} fill="url(#colorUsers)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>User Roles</CardTitle><CardDescription>Current user distribution</CardDescription></CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={roleData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="count" nameKey="role">
                      {roleData.map((_: any, i: number) => (<Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Transaction Trend</CardTitle><CardDescription>Daily volume over the last 30 days</CardDescription></CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={txnData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" hide />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3B82F6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Top Banks</CardTitle><CardDescription>Most active transaction sources</CardDescription></CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bankData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" className="text-xs" />
                    <YAxis dataKey="bank" type="category" width={90} className="text-xs" />
                    <Tooltip />
                    <Bar dataKey="count" fill="#10B981" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Package className="h-4 w-4" />Active Packages</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{packages?.active || 0}</div>
              <p className="text-xs text-muted-foreground">Purchases: {packages?.totalPurchases || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Target className="h-4 w-4" />Referral Signups</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{referrals?.signups || 0}</div>
              <p className="text-xs text-muted-foreground">Paid conversions: {referrals?.paidConversions || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Wallet className="h-4 w-4" />Monthly Transactions</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{transactions?.thisMonth || 0}</div>
              <p className="text-xs text-muted-foreground">Growth: {transactions?.growthMonth || 0}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Globe className="h-4 w-4" />Active Countries</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{countries?.active || 0}</div>
              <p className="text-xs text-muted-foreground">Patterns: {overview?.totalPatterns || 0}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Top Users by Transactions</CardTitle>
            <CardDescription>Users generating the highest transaction activity</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Transactions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">No activity data available yet.</TableCell>
                  </TableRow>
                ) : topUsers.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.username || item.email || 'Unknown user'}</TableCell>
                    <TableCell>{item.role}</TableCell>
                    <TableCell className="text-right">{item.transactionCount || 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}