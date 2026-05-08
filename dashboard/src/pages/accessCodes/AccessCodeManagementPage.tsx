import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { accessCodeAPI, businessAPI } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { Key, Plus, Search, RefreshCw, Eye, Copy, Trash2, Clock } from 'lucide-react';

function LoadingSkeleton() {
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Type</TableHead><TableHead>Uses</TableHead><TableHead>Expires</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
      <TableBody>{[...Array(5)].map((_, i) => (<TableRow key={i}>{[...Array(5)].map((_, j) => (<TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>))}</TableRow>))}</TableBody>
    </Table>
  );
}

export default function AccessCodeManagementPage() {
  const { toast } = useToast();
  const [codes, setCodes] = useState<any[]>([]);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { loadBusinesses(); }, []);

  const loadBusinesses = async () => {
    try {
      const res = await businessAPI.getAll();
      const businessList = res.data.data || [];
      setBusinesses(businessList);
      if (businessList.length > 0 && !selectedBusinessId) {
        setSelectedBusinessId(businessList[0].id);
      }
    } catch (error) { /* Ignore errors */ }
  };

  useEffect(() => { if (selectedBusinessId) loadCodes(); }, [selectedBusinessId]);

  const loadCodes = async () => {
    if (!selectedBusinessId) return;
    setLoading(true);
    try {
      const response = await accessCodeAPI.getAll(selectedBusinessId);
      setCodes(response.data.data || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.response?.data?.error || "Failed to load codes", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filteredCodes = codes.filter(c => c.code?.toLowerCase().includes(search.toLowerCase()));

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Access Codes</h1>
            <p className="text-muted-foreground mt-1">Manage employee access codes</p>
          </div>
          {businesses.length > 1 && (
            <Select value={selectedBusinessId} onValueChange={setSelectedBusinessId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select business" />
              </SelectTrigger>
              <SelectContent>
                {businesses.map((business) => (
                  <SelectItem key={business.id} value={business.id}>{business.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadCodes}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
            <Button size="sm"><Plus className="h-4 w-4 mr-2" />Generate Code</Button>
          </div>
        </div>

        <Separator />

        <Card>
          <CardContent className="pt-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search codes..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-0">
            <CardTitle>Codes</CardTitle>
            <CardDescription>{filteredCodes.length} access code{filteredCodes.length !== 1 ? 's' : ''}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <LoadingSkeleton /> : filteredCodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Key className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No access codes</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Code</TableHead><TableHead>Type</TableHead><TableHead>Uses</TableHead><TableHead>Expires</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCodes.map((code) => (
                    <TableRow key={code.id}>
                      <TableCell className="font-mono">{code.code}</TableCell>
                      <TableCell><Badge variant="outline">{code.type}</Badge></TableCell>
                      <TableCell>{code.uses || 0} / {code.maxUses || '∞'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{code.expiresAt ? new Date(code.expiresAt).toLocaleDateString() : 'Never'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon"><Copy className="h-4 w-4" /></Button>
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
    </DashboardLayout>
  );
}