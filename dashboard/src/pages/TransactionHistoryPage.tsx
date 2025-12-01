import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { dashboardAPI } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { Search, CheckCircle2, XCircle, Filter } from 'lucide-react';

export default function TransactionHistoryPage() {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page] = useState(1);
  const [search, setSearch] = useState('');
  const [verifiedFilter, setVerifiedFilter] = useState<'all' | 'verified' | 'unverified'>('all');
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadTransactions();
  }, [page, verifiedFilter, search]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const params: any = { page, limit: 100 };
      if (verifiedFilter !== 'all') {
        params.verified = verifiedFilter === 'verified';
      }
      if (search.trim()) {
        params.search = search.trim();
      }
      const response = await dashboardAPI.getTransactions(params);
      setTransactions(response.data.data.transactions);
      setStats(response.data.data.stats);
    } catch (error: any) {
      console.error('Transaction load error:', error);
      let errorMessage = 'Failed to load transactions';
      
      if (error.code === 'ERR_NETWORK' || error.message?.includes('CORS') || error.message?.includes('Network Error')) {
        errorMessage = 'Network error: Could not connect to backend. Check if backend is running on http://localhost:3000';
      } else if (error.response?.status === 401) {
        errorMessage = 'Authentication required. Please log in again.';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
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
          <h1 className="text-3xl font-bold">Transaction History</h1>
          <p className="text-muted-foreground">All your parsed transactions</p>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Transactions</CardDescription>
                <CardTitle className="text-2xl">{stats.totalCount}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Verified</CardDescription>
                <CardTitle className="text-2xl text-green-600">{stats.verifiedCount}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Unverified</CardDescription>
                <CardTitle className="text-2xl text-orange-600">{stats.unverifiedCount}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Amount</CardDescription>
                <CardTitle className="text-2xl">ETB {stats.totalAmount?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</CardTitle>
              </CardHeader>
            </Card>
          </div>
        )}

        {/* Amount Breakdown */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Verified Amount</CardTitle>
                <CardDescription className="text-2xl font-bold text-green-600">
                  ETB {stats.verifiedAmount?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Unverified Amount</CardTitle>
                <CardDescription className="text-2xl font-bold text-orange-600">
                  ETB {stats.unverifiedAmount?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Transactions</CardTitle>
                <CardDescription>Search and filter your transactions</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Search and Filter */}
            <div className="flex gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search by TXN ID, sender, or bank..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant={verifiedFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => setVerifiedFilter('all')}
                  size="sm"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  All
                </Button>
                <Button
                  variant={verifiedFilter === 'verified' ? 'default' : 'outline'}
                  onClick={() => setVerifiedFilter('verified')}
                  size="sm"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Verified
                </Button>
                <Button
                  variant={verifiedFilter === 'unverified' ? 'default' : 'outline'}
                  onClick={() => setVerifiedFilter('unverified')}
                  size="sm"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Unverified
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {search || verifiedFilter !== 'all' ? 'No transactions match your filters' : 'No transactions yet'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">Date</th>
                      <th className="text-left p-2">Amount</th>
                      <th className="text-left p-2">Sender</th>
                      <th className="text-left p-2">Bank</th>
                      <th className="text-left p-2">TXN ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((txn) => (
                      <tr key={txn.id} className="border-b hover:bg-muted/50">
                        <td className="p-2">
                          {txn.verified ? (
                            <span className="inline-flex items-center gap-1 text-green-600">
                              <CheckCircle2 className="h-4 w-4" />
                              <span className="text-xs font-medium">Verified</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-orange-600">
                              <XCircle className="h-4 w-4" />
                              <span className="text-xs font-medium">Unverified</span>
                            </span>
                          )}
                        </td>
                        <td className="p-2">
                          {new Date(txn.receivedAt).toLocaleString()}
                        </td>
                        <td className="p-2 font-medium">ETB {txn.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="p-2">{txn.sender}</td>
                        <td className="p-2">{txn.bank || '-'}</td>
                        <td className="p-2 font-mono text-sm">{txn.txnId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
