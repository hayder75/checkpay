import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { adminAPI } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { Search, FileText, RefreshCw, User, Globe } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PatternManagementPage() {
  const { toast } = useToast();
  const [patterns, setPatterns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    search: '',
    bank: '',
    currency: '',
  });

  useEffect(() => {
    loadPatterns();
  }, [page, filters]);

  const loadPatterns = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 20 };
      if (filters.search) params.search = filters.search;
      if (filters.bank) params.bank = filters.bank;
      if (filters.currency) params.currency = filters.currency;

      const response = await adminAPI.getPatterns(params);
      setPatterns(response.data.data.patterns);
      setTotalPages(response.data.data.pagination.pages);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to load patterns',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Pattern Management</h1>
            <p className="text-sm text-muted-foreground">Manage all user patterns</p>
          </div>
          <Link to="/admin/dashboard">
            <Button variant="outline">Back to Dashboard</Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Pattern name, bank..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    className="pl-8"
                  />
                </div>
              </div>
              <div>
                <Label>Bank</Label>
                <Input
                  placeholder="Bank name"
                  value={filters.bank}
                  onChange={(e) => setFilters({ ...filters, bank: e.target.value })}
                />
              </div>
              <div>
                <Label>Currency</Label>
                <Input
                  placeholder="Currency code"
                  value={filters.currency}
                  onChange={(e) => setFilters({ ...filters, currency: e.target.value.toUpperCase() })}
                  maxLength={3}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Patterns List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Patterns ({patterns.length})</CardTitle>
              <Button onClick={loadPatterns} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : patterns.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No patterns found</div>
            ) : (
              <div className="space-y-4">
                {patterns.map((pattern: any) => (
                  <Card key={pattern.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold">{pattern.name}</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-muted-foreground">
                          {pattern.bank && (
                            <div>Bank: <span className="font-medium">{pattern.bank}</span></div>
                          )}
                          {pattern.currency && (
                            <div>Currency: <span className="font-medium">{pattern.currency}</span></div>
                          )}
                          <div>Transactions: <span className="font-medium">{pattern._count?.transactions || 0}</span></div>
                          {pattern.user && (
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {pattern.user.username || pattern.user.email || pattern.user.phone || 'N/A'}
                            </div>
                          )}
                        </div>
                        {pattern.description && (
                          <div className="mt-2 text-sm text-muted-foreground">{pattern.description}</div>
                        )}
                        <div className="mt-2 text-xs text-muted-foreground">
                          Created: {new Date(pattern.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}



