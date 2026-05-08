import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { adminAPI } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, FileText, User, Globe, Plus, RefreshCw, Eye, Edit, Trash2 } from 'lucide-react';

export default function CountryTemplatesPage() {
  const { countryCode } = useParams<{ countryCode: string }>();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', smsText: '', description: '' });

  useEffect(() => { if (countryCode) loadTemplates(); }, [countryCode]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getCountryTemplates(countryCode);
      setTemplates(response.data.data || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.response?.data?.error || "Failed to load templates", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/dashboard/admin/countries">
            <Button variant="ghost" size="sm" className="mb-2"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
            <span>🌍</span> Templates - {countryCode}
          </h1>
          <p className="text-muted-foreground mt-1">Manage templates for {countryCode}</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}><Plus className="h-4 w-4 mr-2" />Add Template</Button>
      </div>

      <Separator />

      {loading ? (
        <Table><TableHeader><TableRow><TableHead>Template</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>{[...Array(5)].map((_, i) => (<TableRow key={i}>{[...Array(3)].map((_, j) => (<TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>))}</TableRow>))}</TableBody></Table>
      ) : templates.length === 0 ? (
        <Card><CardContent className="pt-6"><p className="text-center text-muted-foreground">No templates found</p></CardContent></Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow><TableHead>Template</TableHead><TableHead>Preview</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((template) => (
              <TableRow key={template.id}>
                <TableCell><p className="font-medium">{template.name}</p><p className="text-sm text-muted-foreground">{template.description}</p></TableCell>
                <TableCell className="max-w-xs"><p className="truncate text-sm">{template.smsText}</p></TableCell>
                <TableCell><Badge variant={template.isActive ? "default" : "secondary"}>{template.isActive ? 'Active' : 'Inactive'}</Badge></TableCell>
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
    </div>
  );
}