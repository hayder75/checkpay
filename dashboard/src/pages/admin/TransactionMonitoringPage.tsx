import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { adminAPI } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { 
  Search, RefreshCw, DollarSign, Calendar, Building2, User, Activity, 
  CheckCircle, XCircle, Clock, Filter, Eye 
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';

const COLORS = ['#F37100', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const statusConfig = {
  COMPLETED: { variant: 'default' as const, color: 'green' },
  PENDING: { variant: 'outline' as const, color: 'yellow' },
  FAILED: { variant: 'destructive' as const, color: 'red' },
  PROCESSING: { variant: 'secondary' as const, color: 'blue' },
};

function LoadingSkeleton() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>User</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Date</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...Array(5)].map((_, i) => (
          <TableRow key={i}>
            {[...Array(6)].map((_, j) => (
              <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function TransactionMonitoringPage() {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({ txnId: '', bank: '', userId: '', fromDate: '', toDate: '', status: '' });

  useEffect(() => { loadTransactions(true); }, [page, filters]);

  const loadTransactions = async (includeAnalytics: boolean = false) => {
    setLoading(true);
    try {
      const params: any = { page, limit: 20, analytics: includeAnalytics };
      if (filters.txnId) params.txnId = filters.txnId;
      if (filters.bank) params.bank = filters.bank;
      if (filters.userId) params.userId = filters.userId;
      if (filters.fromDate) params.fromDate = filters.fromDate;
      if (filters.toDate) params.toDate = filters.toDate;
      if (filters.status) params.status = filters.status;

      const response = await adminAPI.getTransactions(params);
      setTransactions(response.data.data.transactions || []);
      if (includeAnalytics) setAnalytics(response.data.data.analytics);
      setTotalPages(response.data.data.pagination?.pages || 1);
    } catch (error: any) {
      toast({ title: "Error", description: error.response?.data?.error || "Failed to load transactions", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => loadTransactions(true);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Transaction Monitor</h1>
            <p className="text-muted-foreground mt-1">Monitor all platform transactions</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <Separator />

        {/* Analytics Cards */}
        {analytics && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Transactions</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{analytics.total || 0}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Amount</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">${analytics.totalAmount?.toLocaleString() || 0}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Success Rate</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold text-green-500">{analytics.successRate || 0}%</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Avg Amount</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">${analytics.avgAmount?.toFixed(2) || 0}</div></CardContent>
            </Card>
          </div>
        )}

        <Separator />

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by transaction ID..." className="pl-10" value={filters.txnId} onChange={(e) => setFilters(f => ({ ...f, txnId: e.target.value }))} />
                </div>
              </div>
              <Input placeholder="User ID" className="w-full sm:w-40" value={filters.userId} onChange={(e) => setFilters(f => ({ ...f, userId: e.target.value }))} />
              <Input type="date" className="w-full sm:w-40" value={filters.fromDate} onChange={(e) => setFilters(f => ({ ...f, fromDate: e.target.value }))} />
              <Input type="date" className="w-full sm:w-40" value={filters.toDate} onChange={(e) => setFilters(f => ({ ...f, toDate: e.target.value }))} />
              <Select value={filters.status} onValueChange={(v) => setFilters(f => ({ ...f, status: v }))}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                  <SelectItem value="PROCESSING">Processing</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Transactions Table */}
        <Card>
          <CardHeader className="pb-0">
            <CardTitle>Transactions</CardTitle>
            <CardDescription>{transactions.length} transaction{transactions.length !== 1 ? 's' : ''}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <LoadingSkeleton />
            ) : transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No transactions found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((txn) => (
                    <TableRow key={txn.id}>
                      <TableCell className="font-mono text-sm">{txn.txnId?.slice(0, 12)}...</TableCell>
                      <TableCell>{txn.user?.username || txn.userId || '-'}</TableCell>
                      <TableCell className="font-mono">${txn.amount || 0}</TableCell>
                      <TableCell>
                        <Badge variant={statusConfig[txn.status]?.variant || 'outline'}>{txn.status}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {txn.createdAt ? new Date(txn.createdAt).toLocaleString() : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {transactions.length > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}