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
import { RefreshCw, Calendar, User, Activity, FileText, Search, Eye } from 'lucide-react';

const actionColors: Record<string, string> = {
  CREATE: 'bg-green-500',
  UPDATE: 'bg-blue-500',
  DELETE: 'bg-red-500',
  LOGIN: 'bg-purple-500',
  LOGOUT: 'bg-gray-500',
  PAYMENT: 'bg-orange-500',
};

function LoadingSkeleton() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Action</TableHead>
          <TableHead>User</TableHead>
          <TableHead>Details</TableHead>
          <TableHead>IP</TableHead>
          <TableHead>Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...Array(5)].map((_, i) => (
          <TableRow key={i}>
            {[...Array(5)].map((_, j) => (
              <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function AuditLogsPage() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({ action: '', fromDate: '', toDate: '' });

  useEffect(() => { loadLogs(); }, [page, filters]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 50 };
      if (filters.action) params.action = filters.action;
      if (filters.fromDate) params.fromDate = filters.fromDate;
      if (filters.toDate) params.toDate = filters.toDate;

      const response = await adminAPI.getAuditLogs(params);
      setLogs(response.data.data.logs || []);
      setTotalPages(response.data.data.pagination?.pages || 1);
    } catch (error: any) {
      toast({ title: "Error", description: error.response?.data?.error || "Failed to load audit logs", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Audit Logs</h1>
            <p className="text-muted-foreground mt-1">Platform activity logs</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadLogs}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <Separator />

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <Select value={filters.action} onValueChange={(v) => setFilters(f => ({ ...f, action: v }))}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="CREATE">Create</SelectItem>
                  <SelectItem value="UPDATE">Update</SelectItem>
                  <SelectItem value="DELETE">Delete</SelectItem>
                  <SelectItem value="LOGIN">Login</SelectItem>
                  <SelectItem value="LOGOUT">Logout</SelectItem>
                  <SelectItem value="PAYMENT">Payment</SelectItem>
                </SelectContent>
              </Select>
              <Input type="date" className="w-full sm:w-40" value={filters.fromDate} onChange={(e) => setFilters(f => ({ ...f, fromDate: e.target.value }))} />
              <Input type="date" className="w-full sm:w-40" value={filters.toDate} onChange={(e) => setFilters(f => ({ ...f, toDate: e.target.value }))} />
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card>
          <CardHeader className="pb-0">
            <CardTitle>Activity Logs</CardTitle>
            <CardDescription>{logs.length} log{logs.length !== 1 ? 's' : ''}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <LoadingSkeleton />
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No logs found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log, i) => (
                    <TableRow key={log.id || i}>
                      <TableCell>
                        <Badge className={`${actionColors[log.action] || 'bg-gray-500'} text-white`}>
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell>{log.user?.username || log.userId || '-'}</TableCell>
                      <TableCell className="text-sm">{log.details || '-'}</TableCell>
                      <TableCell className="font-mono text-sm">{log.ipAddress || '-'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.createdAt ? new Date(log.createdAt).toLocaleString() : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {logs.length > 0 && (
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