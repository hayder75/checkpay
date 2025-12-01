import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { adminAPI } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { Globe, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function CountryManagementPage() {
  const { toast } = useToast();
  const [countries, setCountries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCountry, setEditingCountry] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});

  useEffect(() => {
    loadCountries();
  }, []);

  const loadCountries = async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getCountries();
      setCountries(response.data.data);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to load countries',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCountry = async (code: string) => {
    try {
      await adminAPI.updateCountry(code, editData);
      toast({ title: 'Success', description: 'Country updated successfully' });
      setEditingCountry(null);
      setEditData({});
      loadCountries();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to update country',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Country Management</h1>
            <p className="text-sm text-muted-foreground">Manage country templates and patterns</p>
          </div>
          <Link to="/admin/dashboard">
            <Button variant="outline">Back to Dashboard</Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Countries ({countries.length})</CardTitle>
              <Button onClick={loadCountries} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : countries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No countries found</div>
            ) : (
              <div className="space-y-4">
                {countries.map((country: any) => (
                  <Card key={country.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold">{country.name}</span>
                          <span className="text-sm text-muted-foreground">({country.code})</span>
                          {country.isActive ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <div className="font-medium mb-1">Banks:</div>
                            <div className="text-muted-foreground">
                              {country.banks.length > 0 ? country.banks.join(', ') : 'None'}
                            </div>
                          </div>
                          <div>
                            <div className="font-medium mb-1">Currencies:</div>
                            <div className="text-muted-foreground">
                              {country.currencies.length > 0 ? country.currencies.join(', ') : 'None'}
                            </div>
                          </div>
                          <div>
                            <div className="font-medium mb-1">Patterns:</div>
                            <div className="text-muted-foreground">
                              {country._count?.patterns || 0} patterns
                            </div>
                          </div>
                        </div>
                        {country.commonPhrases && country.commonPhrases.length > 0 && (
                          <div className="mt-2 text-sm">
                            <div className="font-medium mb-1">Common Phrases:</div>
                            <div className="text-muted-foreground">
                              {country.commonPhrases.join(', ')}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        {editingCountry === country.code ? (
                          <div className="space-y-2">
                            <Button
                              size="sm"
                              onClick={() => handleUpdateCountry(country.code)}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingCountry(null);
                                setEditData({});
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingCountry(country.code);
                              setEditData({
                                name: country.name,
                                banks: country.banks,
                                currencies: country.currencies,
                                commonPhrases: country.commonPhrases,
                                isActive: country.isActive,
                              });
                            }}
                          >
                            Edit
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="mt-2">
                      <Link to={`/admin/countries/${country.code}/templates`}>
                        <Button variant="outline" size="sm">
                          Manage Templates
                        </Button>
                      </Link>
                    </div>
                    {editingCountry === country.code && (
                      <div className="mt-4 p-4 bg-muted rounded-lg space-y-4">
                        <div>
                          <Label>Name</Label>
                          <Input
                            value={editData.name || ''}
                            onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Banks (comma-separated)</Label>
                          <Input
                            value={Array.isArray(editData.banks) ? editData.banks.join(', ') : ''}
                            onChange={(e) => setEditData({ ...editData, banks: e.target.value.split(',').map(s => s.trim()) })}
                          />
                        </div>
                        <div>
                          <Label>Currencies (comma-separated)</Label>
                          <Input
                            value={Array.isArray(editData.currencies) ? editData.currencies.join(', ') : ''}
                            onChange={(e) => setEditData({ ...editData, currencies: e.target.value.split(',').map(s => s.trim()) })}
                          />
                        </div>
                        <div>
                          <Label>
                            <input
                              type="checkbox"
                              checked={editData.isActive !== undefined ? editData.isActive : country.isActive}
                              onChange={(e) => setEditData({ ...editData, isActive: e.target.checked })}
                              className="mr-2"
                            />
                            Active
                          </Label>
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}



