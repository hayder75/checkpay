import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { adminAPI } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Trash2, ArrowLeft, Crown, RefreshCw, Edit, Eye } from 'lucide-react';
import DashboardLayout from '@/components/layouts/DashboardLayout';

function LoadingSkeleton() {
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Preview</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
      <TableBody>{[...Array(5)].map((_, i) => (<TableRow key={i}>{[...Array(4)].map((_, j) => (<TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>))}</TableRow>))}</TableBody>
    </Table>
  );
}

export default function TemplateManagementPage() {
  const { countryCode } = useParams<{ countryCode: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', smsText: '', description: '', useAI: false });

  useEffect(() => { if (countryCode) loadTemplates(); }, [countryCode]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getTemplates(countryCode);
      setTemplates(response.data.data || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.response?.data?.error || "Failed to load templates", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await adminAPI.createTemplate({ ...formData, countryCode });
      toast({ title: "Success", description: "Template created" });
      setShowForm(false);
      setFormData({ name: '', smsText: '', description: '', useAI: false });
      loadTemplates();
    } catch (error: any) {
      toast({ title: "Error", description: error.response?.data?.error || "Failed to create", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    try {
      await adminAPI.deleteTemplate(id);
      toast({ title: "Template deleted" });
      loadTemplates();
    } catch (error: any) {
      toast({ title: "Error", description: error.response?.data?.error || "Failed to delete", variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/admin/countries')} className="mb-2">
              <ArrowLeft className="h-4 w-4 mr-2" />Back
            </Button>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
              <span>🌍</span> Templates - {countryCode}
            </h1>
            <p className="text-muted-foreground mt-1">Manage SMS templates for {countryCode}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadTemplates}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
            <Button size="sm" onClick={() => setShowForm(true)}><Plus className="h-4 w-4 mr-2" />Add Template</Button>
          </div>
        </div>

        <Separator />

        {loading ? <LoadingSkeleton /> : templates.length === 0 ? (
          <Card><CardContent className="pt-6"><p className="text-center text-muted-foreground">No templates yet</p></CardContent></Card>
        ) : (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Name</TableHead><TableHead>Preview</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
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
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(template.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>Create Template</CardTitle>
              <CardDescription>Add new SMS template for {countryCode}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Template Name</Label>
                <Input value={formData.name} onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))} placeholder="Verification code" />
              </div>
              <div className="space-y-2">
                <Label>SMS Text</Label>
                <Textarea value={formData.smsText} onChange={(e) => setFormData(f => ({ ...f, smsText: e.target.value }))} placeholder="Your verification code is {code}" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={formData.description} onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))} placeholder="Description" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="useAI" checked={formData.useAI} onChange={(e) => setFormData(f => ({ ...f, useAI: e.target.checked }))} />
                <Label htmlFor="useAI">Use AI to generate</Label>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button onClick={handleCreate}>Create Template</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}