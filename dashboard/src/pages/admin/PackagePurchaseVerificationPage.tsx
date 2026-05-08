import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { packageAPI } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { CheckCircle, XCircle, Clock, Package, User, RefreshCw, Eye, Check, X } from 'lucide-react';

const statusConfig = {
  PENDING: { variant: 'outline', icon: Clock, color: 'yellow' },
  VERIFIED: { variant: 'default', icon: CheckCircle, color: 'green' },
  REJECTED: { variant: 'destructive', icon: XCircle, color: 'red' },
};

export default function PackagePurchaseVerificationPage() {
  const { toast } = useToast();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => { loadPurchases(); }, []);

  const loadPurchases = async () => {
    setLoading(true);
    try {
      const response = await packageAPI.getPendingPurchases();
      setPurchases(response.data.data || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.response?.data?.error || "Failed to load purchases", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (id: string, status: 'VERIFIED' | 'REJECTED') => {
    try {
      await packageAPI.verifyPurchase(id, { status, notes });
      toast({ title: "Success", description: `Purchase ${status.toLowerCase()}` });
      setSelected(null);
      setNotes('');
      loadPurchases();
    } catch (error: any) {
      toast({ title: "Error", description: error.response?.data?.error || "Failed to verify", variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Package Purchases</h1>
            <p className="text-muted-foreground mt-1">Verify package purchase transactions</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadPurchases}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
        </div>

        <Separator />

        <Card>
          <CardHeader className="pb-0">
            <CardTitle>Pending Verifications</CardTitle>
            <CardDescription>{purchases.filter(p => p.status === 'PENDING').length} pending</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Table>
                <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Package</TableHead><TableHead>Transaction</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>{[...Array(3)].map((_, i) => (<TableRow key={i}>{[...Array(5)].map((_, j) => (<TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>))}</TableRow>))}</TableBody>
              </Table>
            ) : purchases.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                <p className="text-muted-foreground">No pending verifications</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow><TableHead>User</TableHead><TableHead>Package</TableHead><TableHead>Transaction #</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.map((purchase) => (
                    <TableRow key={purchase.id}>
                      <TableCell><p className="font-medium">{purchase.user?.username || purchase.userId}</p></TableCell>
                      <TableCell><Badge variant="outline">{purchase.package?.name || purchase.packageId}</Badge></TableCell>
                      <TableCell className="font-mono text-sm">{purchase.transactionNumber}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{purchase.createdAt ? new Date(purchase.createdAt).toLocaleDateString() : '-'}</TableCell>
                      <TableCell>
                        <Badge variant={statusConfig[purchase.status]?.variant || 'outline'}>
                          {purchase.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setSelected(purchase)}><Eye className="h-4 w-4" /></Button>
                          {purchase.status === 'PENDING' && (
                            <>
                              <Button variant="ghost" size="icon" className="text-green-500" onClick={() => handleVerify(purchase.id, 'VERIFIED')}><Check className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleVerify(purchase.id, 'REJECTED')}><X className="h-4 w-4" /></Button>
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

        {selected && (
          <Card>
            <CardHeader>
              <CardTitle>Purchase Details</CardTitle>
              <CardDescription>Transaction: {selected.transactionNumber}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div><p className="text-sm text-muted-foreground">User</p><p className="font-medium">{selected.user?.username || selected.userId}</p></div>
                <div><p className="text-sm text-muted-foreground">Package</p><p className="font-medium">{selected.package?.name}</p></div>
                <div><p className="text-sm text-muted-foreground">Date</p><p className="font-medium">{selected.createdAt ? new Date(selected.createdAt).toLocaleString() : '-'}</p></div>
                <div><p className="text-sm text-muted-foreground">Status</p><Badge variant={statusConfig[selected.status]?.variant}>{selected.status}</Badge></div>
              </div>
              <div className="space-y-2">
                <Label>Admin Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add notes (optional)" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
                <Button className="bg-green-500 hover:bg-green-600" onClick={() => handleVerify(selected.id, 'VERIFIED')}><CheckCircle className="h-4 w-4 mr-2" />Verify</Button>
                <Button variant="destructive" onClick={() => handleVerify(selected.id, 'REJECTED')}><XCircle className="h-4 w-4 mr-2" />Reject</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}