import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { patternsAPI } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Trash2, Edit } from 'lucide-react';

export default function PatternLibraryPage() {
  const { toast } = useToast();
  const [patterns, setPatterns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPatterns();
  }, []);

  const loadPatterns = async () => {
    try {
      const response = await patternsAPI.getAll();
      setPatterns(response.data.data);
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Pattern Library</h1>
            <p className="text-muted-foreground">Manage your SMS parsing patterns</p>
          </div>
          <Link to="/dashboard/patterns/new">
            <Button className="bg-[#F37100] hover:bg-[#F37100]/90">
              <Plus className="mr-2 h-4 w-4" />
              Create Pattern
            </Button>
          </Link>
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
