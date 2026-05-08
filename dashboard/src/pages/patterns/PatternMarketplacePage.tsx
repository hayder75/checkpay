import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { patternsAPI } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { Search, FileText, Building2, Globe, Plus, Loader2 } from 'lucide-react';
import { COUNTRIES_LIST } from '@/utils/countries';

export default function PatternMarketplacePage() {
  const { toast } = useToast();
  const [patterns, setPatterns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchBank, setSearchBank] = useState('');
  const [searchCountry, setSearchCountry] = useState('');
  const [searchCountryName, setSearchCountryName] = useState('');
  const [searchText, setSearchText] = useState('');
  const [addingPatterns, setAddingPatterns] = useState<Set<string>>(new Set());
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);

  useEffect(() => {
    loadPatterns();
  }, []);

  // Filter countries based on search
  const filteredCountries = searchCountryName
    ? COUNTRIES_LIST.filter((country) =>
        country.name.toLowerCase().includes(searchCountryName.toLowerCase()) ||
        country.code.toLowerCase().includes(searchCountryName.toLowerCase())
      )
    : [];

  const handleCountrySelect = (country: any) => {
    setSearchCountry(country.code);
    setSearchCountryName(country.name);
    setShowCountryDropdown(false);
  };

  const handleCountryInputChange = (value: string) => {
    setSearchCountryName(value);
    setShowCountryDropdown(true);
    // Clear country code if input is cleared
    if (!value) {
      setSearchCountry('');
    }
  };

  const loadPatterns = async () => {
    try {
      const params: any = {};
      if (searchBank) params.bank = searchBank;
      if (searchCountry) params.countryCode = searchCountry;
      if (searchText) params.search = searchText;

      const response = await patternsAPI.browse(params);
      setPatterns(response.data.data || []);
    } catch (error: any) {
      console.error('Error loading patterns:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to load patterns',
        variant: 'destructive',
      });
      setPatterns([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setLoading(true);
    loadPatterns();
  };

  const handleAddPattern = async (pattern: any) => {
    if (addingPatterns.has(pattern.id)) return;

    setAddingPatterns(prev => new Set(prev).add(pattern.id));
    
    try {
      await patternsAPI.clone(pattern.id, {
        name: pattern.name,
      });

      toast({
        title: 'Success',
        description: `Pattern "${pattern.name}" added to your library`,
      });

      // Reload patterns to remove the added one from the list
      await loadPatterns();
    } catch (error: any) {
      console.error('Error adding pattern:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.error || error.message || 'Failed to add pattern to library',
        variant: 'destructive',
      });
    } finally {
      setAddingPatterns(prev => {
        const next = new Set(prev);
        next.delete(pattern.id);
        return next;
      });
    }
  };

  if (loading && patterns.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading patterns...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Browse Patterns</h1>
            <p className="text-muted-foreground">Search and explore all available patterns</p>
          </div>
          <Link to="/dashboard/patterns">
            <Button variant="outline">Back to My Patterns</Button>
          </Link>
        </div>

        {/* Search Section */}
        <Card>
          <CardHeader>
            <CardTitle>Search Patterns</CardTitle>
            <CardDescription>Search by bank name, country, or pattern name</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="search">Search</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Pattern name, bank..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bank">Bank Name</Label>
                <Input
                  id="bank"
                  placeholder="e.g. M-PESA, CBE"
                  value={searchBank}
                  onChange={(e) => setSearchBank(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <div className="relative">
                  <Globe className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="country"
                    placeholder="Type country name (e.g. Kenya, Ethiopia)..."
                    value={searchCountryName}
                    onChange={(e) => handleCountryInputChange(e.target.value)}
                    onFocus={() => setShowCountryDropdown(true)}
                    onBlur={() => setTimeout(() => setShowCountryDropdown(false), 200)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        if (filteredCountries.length === 1) {
                          handleCountrySelect(filteredCountries[0]);
                        }
                        handleSearch();
                      }
                    }}
                    className="pl-8"
                  />
                  {showCountryDropdown && searchCountryName && filteredCountries.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-auto">
                      {filteredCountries.slice(0, 10).map((country: any) => (
                        <button
                          key={country.code}
                          type="button"
                          onClick={() => handleCountrySelect(country)}
                          className="w-full text-left px-4 py-2 hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none flex items-center gap-2"
                        >
                          <span className="font-medium">{country.name}</span>
                          <span className="text-muted-foreground text-sm">({country.code})</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {showCountryDropdown && searchCountryName && filteredCountries.length === 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg p-4 text-sm text-muted-foreground">
                      No countries found
                    </div>
                  )}
                </div>
              </div>
            </div>
            <Button onClick={handleSearch} className="mt-4 bg-[#F37100] hover:bg-[#F37100]/90">
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
            </CardContent>
          </Card>

        {/* Patterns List */}
        {patterns.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">No patterns found</p>
              <p className="text-sm text-muted-foreground">
                Try adjusting your search criteria or create a new pattern.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div>
            <div className="mb-4 text-sm text-muted-foreground">
              Found {patterns.length} pattern{patterns.length !== 1 ? 's' : ''}
            </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {patterns.map((pattern) => (
                <Card key={pattern.id}>
                <CardHeader>
                    <CardTitle>{pattern.name}</CardTitle>
                    <CardDescription>
                      {pattern.description || 'No description available'}
                      </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        {pattern.bank && (
                          <>
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span>{pattern.bank}</span>
                          </>
                        )}
                        {pattern.countryCode && (
                          <>
                            <Globe className="h-4 w-4 text-muted-foreground ml-2" />
                            <span>{pattern.countryCode}</span>
                          </>
                        )}
                        {pattern.currency && (
                          <span className="ml-2 text-muted-foreground">
                            • {pattern.currency}
                          </span>
                        )}
                    </div>
                      {pattern.usageCount > 0 && (
                      <p className="text-xs text-muted-foreground">
                          Used {pattern.usageCount} time{pattern.usageCount !== 1 ? 's' : ''}
                      </p>
                    )}
                          <Button
                        onClick={() => handleAddPattern(pattern)}
                        className="w-full bg-[#F37100] hover:bg-[#F37100]/90"
                        disabled={addingPatterns.has(pattern.id)}
                            size="sm"
                      >
                        {addingPatterns.has(pattern.id) ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Adding...
                        </>
                      ) : (
                          <>
                          <Plus className="mr-2 h-4 w-4" />
                            Add to Library
                          </>
                        )}
                        </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
