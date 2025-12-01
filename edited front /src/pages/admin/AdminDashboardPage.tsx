import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { authAPI } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { Users, FileText, TrendingUp, Shield, Globe, Activity, AlertCircle } from 'lucide-react';

export default function AdminDashboardPage() {
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const response = await authAPI.getMe();
      setUser(response.data.data);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to load user data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">CheckPay Admin</h1>
            <p className="text-sm text-muted-foreground">Administration Dashboard</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {user?.username || user?.email || 'Admin'}
            </span>
            <Button variant="outline" size="sm" onClick={() => {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              window.location.href = '/auth/login';
            }}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold">Admin Dashboard</h2>
            <p className="text-muted-foreground">Manage your CheckPay platform</p>
          </div>

          {/* Admin Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* User Management */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  User Management
                </CardTitle>
                <CardDescription>
                  View, manage, and suspend users
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/admin/users" className="w-full">
                  <Button className="w-full" variant="outline">
                    Manage Users
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Analytics */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Analytics
                </CardTitle>
                <CardDescription>
                  View platform statistics and insights
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/admin/analytics" className="w-full">
                  <Button className="w-full" variant="outline">
                    View Analytics
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Pattern Management */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Pattern Management
                </CardTitle>
                <CardDescription>
                  Manage all user patterns and templates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/admin/patterns" className="w-full">
                  <Button className="w-full" variant="outline">
                    Manage Patterns
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Transaction Monitoring */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Transaction Monitoring
                </CardTitle>
                <CardDescription>
                  Monitor all platform transactions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/admin/transactions" className="w-full">
                  <Button className="w-full" variant="outline">
                    View Transactions
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Country Management */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Country Management
                </CardTitle>
                <CardDescription>
                  Manage country templates and patterns
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link to="/admin/countries" className="w-full">
                  <Button className="w-full" variant="outline">
                    Manage Countries
                  </Button>
                </Link>
                <Link to="/admin/missing-templates" className="w-full">
                  <Button className="w-full" variant="outline">
                    Missing Templates
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Security & Audit */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security & Audit
                </CardTitle>
                <CardDescription>
                  View audit logs and security events
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/admin/audit-logs" className="w-full">
                  <Button className="w-full" variant="outline">
                    View Logs
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* System Health */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  System Health
                </CardTitle>
                <CardDescription>
                  Monitor system status and health
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/admin/system-health" className="w-full">
                  <Button className="w-full" variant="outline">
                    View Health
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* Quick Stats - Load from Analytics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Users</CardDescription>
                <CardTitle className="text-2xl">Loading...</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Transactions</CardDescription>
                <CardTitle className="text-2xl">Loading...</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Patterns</CardDescription>
                <CardTitle className="text-2xl">Loading...</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Active Countries</CardDescription>
                <CardTitle className="text-2xl">Loading...</CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Note */}
          <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-yellow-900 dark:text-yellow-100">
                    Admin Features Coming Soon
                  </h3>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
                    The admin dashboard features are being built. This is the initial admin interface.
                    Full functionality will be available soon.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

