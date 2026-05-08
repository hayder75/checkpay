import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { dashboardAPI, businessAPI } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { TrendingUp, DollarSign, FileText, Building2 } from 'lucide-react';

export default function AnalyticsPage() {
  const { toast } = useToast();
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>('');
  const [stats, setStats] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBusinesses();
  }, []);

  useEffect(() => {
    if (selectedBusinessId) {
      loadAnalytics();
    }
  }, [selectedBusinessId]);

  const loadBusinesses = async () => {
    try {
      const res = await businessAPI.getAll();
      const businessList = res.data.data || [];
      setBusinesses(businessList);
      if (businessList.length > 0 && !selectedBusinessId) {
        setSelectedBusinessId(businessList[0].id);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to load businesses',
        variant: 'destructive',
      });
    }
  };

  const loadAnalytics = async () => {
    if (!selectedBusinessId) return;
    setLoading(true);
    try {
      const [statsRes, transactionsRes] = await Promise.all([
        dashboardAPI.getStats(selectedBusinessId),
        dashboardAPI.getTransactions({ businessId: selectedBusinessId, limit: 100 }),
      ]);
      setStats(statsRes.data.data);
      setTransactions(transactionsRes.data.data?.transactions || []);
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

  // Calculate analytics
  const totalAmount = transactions.reduce((sum, txn) => sum + (txn.amount || 0), 0);
  const avgAmount = transactions.length > 0 ? totalAmount / transactions.length : 0;
  const todayCount = transactions.filter(txn => {
    const txnDate = new Date(txn.receivedAt || txn.createdAt);
    const today = new Date();
    return txnDate.toDateString() === today.toDateString();
  }).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Analytics</h1>
            <p className="text-muted-foreground">Business performance and insights</p>
          </div>
          {businesses.length > 0 && (
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              <select
                value={selectedBusinessId}
                onChange={(e) => setSelectedBusinessId(e.target.value)}
                className="px-3 py-2 border rounded-md"
              >
                {businesses.map((business) => (
                  <option key={business.id} value={business.id}>
                    {business.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {!selectedBusinessId ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground">Please create a business first</p>
            </CardContent>
          </Card>
        ) : loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Loading analytics...</div>
          </div>
        ) : (
          <>
            {/* Key Metrics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.transactions?.total || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats?.transactions?.thisMonth || 0} this month
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {totalAmount.toLocaleString()} ETB
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Average: {avgAmount.toFixed(2)} ETB
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Today</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{todayCount}</div>
                  <p className="text-xs text-muted-foreground">
                    Transactions today
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">This Month</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.transactions?.thisMonth || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats?.transactions?.today || 0} today
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Recent Transactions */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Transactions</CardTitle>
                <CardDescription>Latest transaction activity</CardDescription>
              </CardHeader>
              <CardContent>
                {transactions.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No transactions yet</p>
                ) : (
                  <div className="space-y-2">
                    {transactions.slice(0, 10).map((txn) => (
                      <div key={txn.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">{txn.txnId}</div>
                          <div className="text-sm text-muted-foreground">
                            {txn.sender} • {new Date(txn.receivedAt || txn.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{txn.amount?.toLocaleString()} ETB</div>
                          <div className="text-xs text-muted-foreground">{txn.source}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

