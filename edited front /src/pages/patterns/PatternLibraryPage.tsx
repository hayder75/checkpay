import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { patternsAPI, authAPI } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Trash2, Edit, Store } from 'lucide-react';

export default function PatternLibraryPage() {
  const { toast } = useToast();
  const [patterns, setPatterns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userPlan, setUserPlan] = useState<'FREE' | 'PREMIUM'>('FREE');
  const [patternCount, setPatternCount] = useState(0);

  useEffect(() => {
    loadPatterns();
    loadUserInfo();
  }, []);

  const loadUserInfo = async () => {
    try {
      const response = await authAPI.getMe();
      setUserPlan(response.data.data.plan);
    } catch (error) {
      // Ignore error
    }
  };

  const loadPatterns = async () => {
    try {
      const response = await patternsAPI.getAll();
      setPatterns(response.data.data);
      setPatternCount(response.data.data.length);
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

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this pattern?')) return;

    try {
      await patternsAPI.delete(id);
      toast({
        title: 'Success',
        description: 'Pattern deleted successfully',
      });
      loadPatterns();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to delete pattern',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  const maxPatterns = userPlan === 'PREMIUM' ? null : 4;
  const canCreateMore = userPlan === 'PREMIUM' || patternCount < 4;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Pattern Library</h1>
            <p className="text-muted-foreground">Manage your SMS parsing patterns</p>
            {maxPatterns !== null && (
              <div className="mt-2">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${patternCount >= maxPatterns
                    ? 'bg-destructive text-destructive-foreground'
                    : 'bg-secondary text-secondary-foreground'
                  }`}>
                  Patterns: {patternCount}/{maxPatterns} {userPlan === 'FREE' && '(FREE)'}
                </span>
                {patternCount >= maxPatterns && (
                  <p className="text-sm text-muted-foreground mt-1">
                    You've reached the free limit. <Link to="/dashboard/premium" className="text-[#F37100] hover:underline">Upgrade to Premium</Link> for unlimited patterns!
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Link to="/dashboard/patterns/marketplace">
              <Button variant="outline">
                <Store className="mr-2 h-4 w-4" />
                Browse Templates
              </Button>
            </Link>
            <Link to="/dashboard/patterns/new">
              <Button
                className="bg-[#F37100] hover:bg-[#F37100]/90"
                disabled={!canCreateMore}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Pattern
              </Button>
            </Link>
          </div>
        </div>

        {patterns.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground mb-4">No patterns yet</p>
              <Link to="/dashboard/patterns/new">
                <Button className="bg-[#F37100] hover:bg-[#F37100]/90">
                  Create Your First Pattern
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {patterns.map((pattern) => (
              <Card key={pattern.id}>
                <CardHeader>
                  <CardTitle>{pattern.name}</CardTitle>
                  <CardDescription>
                    {pattern.bank || 'Unknown Bank'} • {pattern.currency || 'No currency'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                    >
                      <Link to={`/dashboard/patterns/${pattern.id}/edit`}>
                        <Edit className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(pattern.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
