import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { adminAPI } from '@/lib';
import { COUNTRIES_LIST } from '@/utils/countries';
import { useToast } from '@/components/ui/use-toast';
import { AlertCircle, Plus, X, RefreshCw, Globe, Search, Edit, Trash2 } from 'lucide-react';

export default function MissingTemplatesPage() {
  const { toast } = useToast();
  const [missingTemplates, setMissingTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ countryCode: '', name: '', smsText: '', description: '' });

  useEffect(() => { loadMissing(); }, []);

  const loadMissing = async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getMissingTemplates();
      setMissingTemplates(response.data.data || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.response?.data?.error || "Failed to load", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      await adminAPI.createTemplate(formData);
      toast({ title: "Success", description: "Template created" });
      setShowForm(false);
      setFormData({ countryCode: '', name: '', smsText: '', description: '' });
      loadMissing();
    } catch (error: any) {
      toast({ title: "Error", description: error.response?.data?.error || "Failed to create", variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Missing Templates</h1>
            <p className="text-muted-foreground mt-1">Countries with missing SMS templates</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadMissing}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
            <Button size="sm" onClick={() => setShowForm(true)}><Plus className="h-4 w-4 mr-2" />Add Template</Button>
          </div>
        </div>

        <Separator />

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            [...Array(6)].map((_, i) => <Card key={i}><CardContent className="pt-6"><Skeleton className="h-24 w-full" /></CardContent></Card>)
          ) : missingTemplates.length === 0 ? (
            <Card className="md:col-span-2 lg:col-span-3"><CardContent className="pt-6"><p className="text-center text-green-500">No missing templates!</p></CardContent></Card>
          ) : missingTemplates.map((item) => (
            <Card key={item.countryCode} className="border-yellow-500/30">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{item.flag}</span>
                  <div>
                    <p className="font-medium">{item.countryName}</p>
                    <p className="text-sm text-muted-foreground">{item.countryCode}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-yellow-600">{item.missingCount} missing</Badge>
              </CardContent>
            </Card>
          ))}
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>Add Missing Template</CardTitle>
              <CardDescription>Create a new template</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Country</Label>
                <Select value={formData.countryCode} onValueChange={(v) => setFormData(f => ({ ...f, countryCode: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                  <SelectContent>
                    {COUNTRIES_LIST.map((c) => (<SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Template Name</Label>
                <Input value={formData.name} onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))} placeholder="Template name" />
              </div>
              <div className="space-y-2">
                <Label>SMS Text</Label>
                <Textarea value={formData.smsText} onChange={(e) => setFormData(f => ({ ...f, smsText: e.target.value }))} placeholder="Your verification code is {code}" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={formData.description} onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))} placeholder="Description" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button onClick={handleSubmit}>Create Template</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}