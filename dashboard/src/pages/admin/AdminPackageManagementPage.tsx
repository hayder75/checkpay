import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { packageAPI } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Edit2, Save, X, Settings, Zap, RefreshCw, Package, DollarSign, Eye, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

function LoadingSkeleton() {
  return (
    <Table>
      <TableHeader>
        <TableRow><TableHead>Package</TableHead><TableHead>Tier</TableHead><TableHead>Price</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
      </TableHeader>
      <TableBody>
        {[...Array(5)].map((_, i) => (
          <TableRow key={i}>{[...Array(5)].map((_, j) => (<TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>))}</TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function AdminPackageManagementPage() {
  const { toast } = useToast();
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingPackage, setEditingPackage] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', tier: '', price: '', description: '' });

  useEffect(() => { loadPackages(); }, []);

  const loadPackages = async () => {
    setLoading(true);
    try {
      const response = await packageAPI.getAll();
      setPackages(response.data.data || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.response?.data?.error || "Failed to load packages", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (editingPackage?.id) {
        await packageAPI.update(editingPackage.id, formData);
      } else {
        await packageAPI.create(formData);
      }
      toast({ title: "Success", description: "Package saved successfully" });
      setShowDialog(false);
      loadPackages();
    } catch (error: any) {
      toast({ title: "Error", description: error.response?.data?.error || "Failed to save package", variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Package Management</h1>
            <p className="text-muted-foreground mt-1">Manage subscription packages</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadPackages}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
            <Button size="sm" onClick={() => { setEditingPackage(null); setFormData({ name: '', tier: '', price: '', description: '' }); setShowDialog(true); }}>
              <Plus className="h-4 w-4 mr-2" />Add Package
            </Button>
          </div>
        </div>

        <Separator />

        <Card>
          <CardHeader className="pb-0">
            <CardTitle>Packages</CardTitle>
            <CardDescription>{packages.length} package{packages.length !== 1 ? 's' : ''}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <LoadingSkeleton /> : packages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Package className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No packages found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Package</TableHead><TableHead>Tier</TableHead><TableHead>Price</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {packages.map((pkg) => (
                    <TableRow key={pkg.id}>
                      <TableCell><p className="font-medium">{pkg.name}</p><p className="text-sm text-muted-foreground">{pkg.description}</p></TableCell>
                      <TableCell><Badge variant="outline">{pkg.tier || '-'}</Badge></TableCell>
                      <TableCell className="font-mono">${pkg.price || 0}</TableCell>
                      <TableCell><Badge variant={pkg.isActive ? "default" : "secondary"}>{pkg.isActive ? 'Active' : 'Inactive'}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => { setEditingPackage(pkg); setFormData(pkg); setShowDialog(true); }}><Edit2 className="h-4 w-4" /></Button>
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

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingPackage ? 'Edit Package' : 'Create Package'}</DialogTitle>
              <DialogDescription>Configure package details</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={formData.name} onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))} placeholder="Package name" />
              </div>
              <div className="space-y-2">
                <Label>Tier</Label>
                <Select value={formData.tier} onValueChange={(v) => setFormData(f => ({ ...f, tier: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select tier" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FREE">Free</SelectItem>
                    <SelectItem value="STARTER">Starter</SelectItem>
                    <SelectItem value="PROFESSIONAL">Professional</SelectItem>
                    <SelectItem value="BUSINESS">Business</SelectItem>
                    <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Price</Label>
                <Input type="number" value={formData.price} onChange={(e) => setFormData(f => ({ ...f, price: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={formData.description} onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))} placeholder="Description" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button onClick={handleSave}><Save className="h-4 w-4 mr-2" />Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}