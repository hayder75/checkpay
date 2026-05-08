import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { adminAPI } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { Search, FileText, RefreshCw, User, Eye, Check, XCircle, AlertTriangle, Plus, Shield, Trash2, Globe, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import DashboardLayout from '@/components/layouts/DashboardLayout';

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-500',
  APPROVED: 'bg-green-500',
  REJECTED: 'bg-red-500',
  FLAGGED: 'bg-orange-500',
};

function LoadingSkeleton() {
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Pattern</TableHead><TableHead>Developer</TableHead><TableHead>Country</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
      <TableBody>{[...Array(5)].map((_, i) => (<TableRow key={i}>{[...Array(5)].map((_, j) => (<TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>))}</TableRow>))}</TableBody>
    </Table>
  );
}

export default function PatternManagementPage() {
  const { toast } = useToast();
  const [patterns, setPatterns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({ search: '', status: '', country: '' });
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => { loadPatterns(); }, [page, filters]);

  const loadPatterns = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 20 };
      if (filters.search) params.search = filters.search;
      if (filters.status) params.status = filters.status;
      if (filters.country) params.country = filters.country;

      const response = await adminAPI.getPatterns(params);
      setPatterns(response.data.data || []);
      setTotalPages(response.data.data?.pagination?.pages || 1);
    } catch (error: any) {
      toast({ title: "Error", description: error.response?.data?.error || "Failed to load patterns", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await adminAPI.approvePattern(id);
      toast({ title: "Success", description: "Pattern approved" });
      loadPatterns();
    } catch (error: any) {
      toast({ title: "Error", description: error.response?.data?.error || "Failed to approve", variant: "destructive" });
    }
  };

  const handleReject = async (id: string) => {
    try {
      await adminAPI.rejectPattern(id);
      toast({ title: "Pattern rejected" });
      loadPatterns();
    } catch (error: any) {
      toast({ title: "Error", description: error.response?.data?.error || "Failed to reject", variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Pattern Management</h1>
            <p className="text-muted-foreground mt-1">Review and manage SMS patterns</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadPatterns}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
        </div>

        <Separator />

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search patterns..." className="pl-10" value={filters.search} onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))} />
                </div>
              </div>
              <Select value={filters.status} onValueChange={(v) => setFilters(f => ({ ...f, status: v }))}>
                <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="All Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-0">
            <CardTitle>Patterns</CardTitle>
            <CardDescription>{patterns.length} pattern{patterns.length !== 1 ? 's' : ''}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <LoadingSkeleton /> : patterns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No patterns found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Pattern</TableHead><TableHead>Developer</TableHead><TableHead>Country</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {patterns.map((pattern) => (
                    <TableRow key={pattern.id}>
                      <TableCell><p className="font-medium">{pattern.name}</p><p className="text-sm text-muted-foreground truncate max-w-xs">{pattern.smsText}</p></TableCell>
                      <TableCell>{pattern.developer?.username || '-'}</TableCell>
                      <TableCell><span className="flex items-center gap-1"><Globe className="h-3 w-3" />{pattern.countryCode || '-'}</span></TableCell>
                      <TableCell><Badge className={`${statusColors[pattern.status] || 'bg-gray-500'} text-white`}>{pattern.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setSelected(pattern)}><Eye className="h-4 w-4" /></Button>
                          {pattern.status === 'PENDING' && (
                            <>
                              <Button variant="ghost" size="icon" className="text-green-500" onClick={() => handleApprove(pattern.id)}><Check className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleReject(pattern.id)}><XCircle className="h-4 w-4" /></Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {patterns.length > 0 && (
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