import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { adminAPI } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { Globe, RefreshCw, CheckCircle, XCircle, Search, Plus, FileText, ArrowRight } from 'lucide-react';
import DashboardLayout from '@/components/layouts/DashboardLayout';

export default function CountryManagementPage() {
  const { toast } = useToast();
  const [countries, setCountries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { loadCountries(); }, []);

  const loadCountries = async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getCountries();
      setCountries(response.data.data || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.response?.data?.error || "Failed to load countries", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filteredCountries = countries.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()) || c.code?.includes(search));

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Country Management</h1>
            <p className="text-muted-foreground mt-1">Manage supported countries</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadCountries}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
        </div>

        <Separator />

        <Card>
          <CardContent className="pt-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search countries..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {loading ? (
            [...Array(8)].map((_, i) => (
              <Card key={i}><CardContent className="pt-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
            ))
          ) : filteredCountries.length === 0 ? (
            <Card className="md:col-span-2 lg:col-span-3"><CardContent className="pt-6"><p className="text-center text-muted-foreground">No countries found</p></CardContent></Card>
          ) : filteredCountries.map((country) => (
            <Card key={country.code} className="hover:border-primary/50 transition-colors">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{country.flag || '🌍'}</div>
                    <div>
                      <p className="font-medium">{country.name}</p>
                      <p className="text-sm text-muted-foreground">{country.code}</p>
                    </div>
                  </div>
                  <Badge variant={country.isActive ? "default" : "secondary"}>
                    {country.isActive ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                    {country.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="mt-4 flex gap-2">
                  <Link to={`/dashboard/admin/countries/${country.code}/templates`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <FileText className="h-4 w-4 mr-2" />Templates
                    </Button>
                  </Link>
                  <Button variant="ghost" size="sm">Edit</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}