import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { businessAPI } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { Building2, Plus, Edit, Trash2, CheckCircle, XCircle, Search, RefreshCw, Eye, Globe } from 'lucide-react';

function LoadingSkeleton() {
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Business</TableHead><TableHead>Package</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
      <TableBody>{[...Array(5)].map((_, i) => (<TableRow key={i}>{[...Array(4)].map((_, j) => (<TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>))}</TableRow>))}</TableBody>
    </Table>
  );
}

export default function BusinessManagementPage() {
  const { toast } = useToast();
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newBusiness, setNewBusiness] = useState({ name: '', description: '' });

  useEffect(() => { loadBusinesses(); }, []);

  const loadBusinesses = async () => {
    setLoading(true);
    try {
      const response = await businessAPI.getAll();
      setBusinesses(response.data.data || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.response?.data?.error || "Failed to load businesses", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleAddBusiness = async () => {
    if (!newBusiness.name.trim()) {
      toast({ title: "Error", description: "Business name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await businessAPI.create(newBusiness);
      toast({ title: "Success", description: "Business created successfully" });
      setShowAddDialog(false);
      setNewBusiness({ name: '', description: '' });
      loadBusinesses();
    } catch (error: any) {
      toast({ title: "Error", description: error.response?.data?.error || "Failed to create business", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const filteredBusinesses = businesses.filter(b => b.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Businesses</h1>
            <p className="text-muted-foreground mt-1">Manage your businesses</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadBusinesses}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
            <Button size="sm" onClick={() => setShowAddDialog(true)}><Plus className="h-4 w-4 mr-2" />Add Business</Button>
          </div>
        </div>

        <Separator />

        <Card>
          <CardContent className="pt-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search businesses..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-0">
            <CardTitle>Your Businesses</CardTitle>
            <CardDescription>{filteredBusinesses.length} business{filteredBusinesses.length !== 1 ? 'es' : ''}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <LoadingSkeleton /> : filteredBusinesses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No businesses found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Business</TableHead><TableHead>Package</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBusinesses.map((business) => (
                    <TableRow key={business.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{business.name}</p>
                            <p className="text-sm text-muted-foreground">{business.description}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{business.package?.name || 'Free'}</Badge></TableCell>
                      <TableCell>
                        <Badge variant={business.isActive ? "default" : "secondary"}>
                          {business.isActive ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                          {business.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="sr-only">Add New Business</DialogTitle>
            <DialogDescription className="sr-only">Create a new business</DialogDescription>
          </DialogHeader>
          <CardHeader>
            <CardTitle>Add New Business</CardTitle>
            <CardDescription>Create a new business to manage your operations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="businessName" className="text-sm font-medium">Business Name</label>
              <Input
                id="businessName"
                placeholder="My Business"
                value={newBusiness.name}
                onChange={(e) => setNewBusiness({ ...newBusiness, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="businessDescription" className="text-sm font-medium">Description (Optional)</label>
              <Input
                id="businessDescription"
                placeholder="A brief description of your business"
                value={newBusiness.description}
                onChange={(e) => setNewBusiness({ ...newBusiness, description: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
              <Button onClick={handleAddBusiness} disabled={saving}>
                {saving ? 'Creating...' : 'Create Business'}
              </Button>
            </div>
          </CardContent>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}