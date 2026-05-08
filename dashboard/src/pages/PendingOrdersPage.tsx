import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { dashboardAPI } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { Clock, CheckCircle, XCircle, RefreshCw, MoreVertical, Eye } from 'lucide-react';

interface PendingVerification {
  id: string;
  txnId: string;
  status: 'PENDING' | 'VERIFIED' | 'FAILED' | 'EXPIRED';
  retryCount: number;
  maxRetries: number;
  expiresAt: string;
  verifiedAt?: string;
  createdAt: string;
  business?: { id: string; name: string };
  project?: { id: string; name: string };
}

const statusConfig = {
  PENDING: { label: 'Pending', variant: 'outline' as const, icon: Clock, color: 'yellow' },
  VERIFIED: { label: 'Verified', variant: 'default' as const, icon: CheckCircle, color: 'green' },
  FAILED: { label: 'Failed', variant: 'destructive' as const, icon: XCircle, color: 'red' },
  EXPIRED: { label: 'Expired', variant: 'secondary' as const, icon: Clock, color: 'gray' },
};

function StatusBadge({ status }: { status: keyof typeof statusConfig }) {
  const config = statusConfig[status];
  const Icon = config.icon;
  return (
    <Badge variant={config.variant}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}

function LoadingSkeleton() {
  return (
    <Card>
      <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
      <CardContent>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-6 w-20" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function PendingOrdersPage() {
  const { toast } = useToast();
  const [verifications, setVerifications] = useState<PendingVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  const loadVerifications = async () => {
    setLoading(true);
    try {
      const response = await dashboardAPI.getPendingVerifications();
      setVerifications(response.data.data || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.response?.data?.error || "Failed to load pending orders", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadVerifications(); }, []);

  const pendingCount = verifications.filter(v => v.status === 'PENDING').length;
  const filteredVerifications = verifications.filter(v => filter === 'all' || v.status === filter);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Pending Orders</h1>
            <p className="text-muted-foreground mt-1">
              Manage pending transaction verifications
            </p>
          </div>
          <Button onClick={loadVerifications} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <Separator />

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{verifications.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Pending</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-yellow-600">{pendingCount}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Verified</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-green-600">{verifications.filter(v => v.status === 'VERIFIED').length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Failed</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-red-600">{verifications.filter(v => v.status === 'FAILED').length}</div></CardContent>
          </Card>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {['all', 'PENDING', 'VERIFIED', 'FAILED', 'EXPIRED'].map((status) => (
            <Button
              key={status}
              variant={filter === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(status)}
              className="capitalize"
            >
              {status === 'all' ? 'All' : statusConfig[status as keyof typeof statusConfig].label}
              {status !== 'all' && (
                <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-current/20">
                  {verifications.filter(v => v.status === status).length}
                </span>
              )}
            </Button>
          ))}
        </div>

        {/* Table */}
        <Card>
          <CardHeader className="pb-0">
            <CardTitle>Verifications</CardTitle>
            <CardDescription>
              {filteredVerifications.length} verification{filteredVerifications.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <LoadingSkeleton />
            ) : filteredVerifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No verifications found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction ID</TableHead>
                    <TableHead>Business</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Retries</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVerifications.map((verification) => (
                    <TableRow key={verification.id}>
                      <TableCell className="font-mono text-sm">{verification.txnId.slice(0, 12)}...</TableCell>
                      <TableCell>{verification.business?.name || verification.project?.name || '-'}</TableCell>
                      <TableCell className="text-sm">
                        {new Date(verification.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-sm">
                        {verification.status === 'VERIFIED' 
                          ? verification.verifiedAt 
                            ? new Date(verification.verifiedAt).toLocaleDateString()
                            : '-'
                          : new Date(verification.expiresAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <span className={verification.retryCount >= verification.maxRetries ? "text-red-500" : ""}>
                          {verification.retryCount}/{verification.maxRetries}
                        </span>
                      </TableCell>
                      <TableCell><StatusBadge status={verification.status} /></TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}