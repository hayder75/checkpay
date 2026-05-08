import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { authAPI, adminAPI, auth } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { Users, FileText, TrendingUp, Shield, Globe, Activity, AlertCircle, Package, ArrowRight, Server, Crown } from 'lucide-react';

function StatCard({ title, value, icon: Icon, description, trend }: { title: string; value: number | string; icon: any; description?: string; trend?: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
        {trend && <p className="text-xs text-green-500 mt-1">{trend}</p>}
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
          <CardContent><Skeleton className="h-8 w-16" /></CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function AdminDashboardPage() {
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalTransactions: 0,
    totalPatterns: 0,
    activeCountries: 0,
  });

  const loadUser = async () => {
    try {
      const response = await authAPI.getMe();
      const userData = response.data.data;
      setUser(userData);

      if (userData.role !== 'ADMIN' && userData.role !== 'SUPER_ADMIN') {
        toast({
          title: 'Access Denied',
          description: 'You do not have admin access. Redirecting to dashboard...',
          variant: 'destructive',
        });
        setTimeout(() => { window.location.href = '/dashboard'; }, 2000);
        return;
      }
    } catch (error: any) {
      console.error('Failed to load user:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to load user data',
        variant: 'destructive',
      });
      if (error.response?.status === 401 || error.response?.status === 403) {
        setTimeout(() => { window.location.href = '/auth/login'; }, 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await adminAPI.getDashboardStats();
      setStats(response.data.data);
    } catch (error: any) {
      console.error('Failed to load stats:', error);
    }
  };

  useEffect(() => { loadUser(); loadStats(); }, []);

  const quickLinks = [
    { name: 'User Management', href: '/dashboard/admin/users', icon: Users, desc: 'Manage platform users' },
    { name: 'Pattern Management', href: '/dashboard/admin/patterns', icon: FileText, desc: 'Review & manage patterns' },
    { name: 'Transaction Monitor', href: '/dashboard/admin/transactions', icon: Activity, desc: 'Monitor all transactions' },
    { name: 'System Health', href: '/dashboard/admin/health', icon: Server, desc: 'System status & metrics' },
    { name: 'Package Management', href: '/dashboard/admin/packages', icon: Package, desc: 'Manage packages' },
    { name: 'Country Management', href: '/dashboard/admin/countries', icon: Globe, desc: 'Manage countries' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
              <Shield className="h-7 w-7 text-primary" />
              Admin Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              Platform overview and management
            </p>
          </div>
          {user?.role === 'SUPER_ADMIN' && (
            <Badge variant="secondary" className="w-fit">
              <Crown className="h-3 w-3 mr-1" />
              Super Admin
            </Badge>
          )}
        </div>

        <Separator />

        {/* Stats Grid */}
        {loading ? <LoadingSkeleton /> : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Total Users" value={stats.totalUsers} icon={Users} description={`${stats.activeUsers || 0} active`} trend="+12%" />
            <StatCard title="Transactions" value={stats.totalTransactions} icon={Activity} description="All time" trend="+8%" />
            <StatCard title="Patterns" value={stats.totalPatterns} icon={FileText} description="Total patterns" />
            <StatCard title="Countries" value={stats.activeCountries} icon={Globe} description="Active countries" />
          </div>
        )}

        <Separator />

        {/* Quick Actions */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {quickLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link key={link.name} to={link.href}>
                  <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-lg bg-primary/10">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{link.name}</p>
                          <p className="text-sm text-muted-foreground">{link.desc}</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>

        {/* System Alerts */}
        <Card className="border-yellow-500/20 bg-yellow-50/50 dark:bg-yellow-900/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-yellow-600">
              <AlertCircle className="h-5 w-5" />
              System Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.alerts?.length > 0 ? (
                stats.alerts.map((alert: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-background rounded-lg">
                    <span className="text-sm">{alert.message}</span>
                    <Badge variant={alert.severity === 'critical' ? 'destructive' : 'outline'}>
                      {alert.severity}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No active alerts</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}