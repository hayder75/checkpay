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
import { employeeAPI, businessAPI } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { Users, Plus, Edit, Trash2, CheckCircle, XCircle, Search, RefreshCw, QrCode, Copy, Eye } from 'lucide-react';

function LoadingSkeleton() {
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Status</TableHead><TableHead>Joined</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
      <TableBody>{[...Array(5)].map((_, i) => (<TableRow key={i}>{[...Array(4)].map((_, j) => (<TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>))}</TableRow>))}</TableBody>
    </Table>
  );
}

export default function EmployeeManagementPage() {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<any[]>([]);
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

  useEffect(() => { if (selectedBusinessId) loadEmployees(); }, [selectedBusinessId]);

  const loadEmployees = async () => {
    if (!selectedBusinessId) return;
    setLoading(true);
    try {
      const response = await employeeAPI.getAll(selectedBusinessId);
      setEmployees(response.data.data || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.response?.data?.error || "Failed to load employees", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filteredEmployees = employees.filter(e => 
    e.name?.toLowerCase().includes(search.toLowerCase()) || 
    e.user?.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Employees</h1>
            <p className="text-muted-foreground mt-1">Manage your team members</p>
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
            <Button variant="outline" size="sm" onClick={loadEmployees}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
            <Button size="sm" asChild><a href="/dashboard/employees/register"><Plus className="h-4 w-4 mr-2" />Add Employee</a></Button>
          </div>
        </div>

        <Separator />

        <Card>
          <CardContent className="pt-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search employees..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-0">
            <CardTitle>Team Members</CardTitle>
            <CardDescription>{filteredEmployees.length} employee{filteredEmployees.length !== 1 ? 's' : ''}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <LoadingSkeleton /> : filteredEmployees.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No employees found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Employee</TableHead><TableHead>Status</TableHead><TableHead>Joined</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                            <span className="text-sm font-medium text-primary">{(employee.name || 'E')[0].toUpperCase()}</span>
                          </div>
                          <div>
                            <p className="font-medium">{employee.name}</p>
                            <p className="text-sm text-muted-foreground">{employee.user?.email || employee.user?.phone || '-'}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={employee.isActive ? "default" : "secondary"}>
                          {employee.isActive ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                          {employee.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {employee.createdAt ? new Date(employee.createdAt).toLocaleDateString() : '-'}
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
    </DashboardLayout>
  );
}