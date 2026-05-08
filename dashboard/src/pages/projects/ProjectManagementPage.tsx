import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { projectAPI, vendorAPI } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { FolderKanban, Plus, Search, RefreshCw, Eye, Key, Users, Trash2 } from 'lucide-react';

function LoadingSkeleton() {
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Project</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead>Vendors</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
      <TableBody>{[...Array(5)].map((_, i) => (<TableRow key={i}>{[...Array(5)].map((_, j) => (<TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>))}</TableRow>))}</TableBody>
    </Table>
  );
}

type ProjectType = 'STANDALONE' | 'CLUSTER' | 'TRANSFERABLE';

export default function ProjectManagementPage() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [newProjectType, setNewProjectType] = useState<ProjectType>('STANDALONE');
  const [creating, setCreating] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorOwnerCode, setNewVendorOwnerCode] = useState('');
  const [creatingVendor, setCreatingVendor] = useState(false);

  useEffect(() => { loadProjects(); }, []);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const response = await projectAPI.getAll();
      setProjects(response.data.data || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.response?.data?.error || "Failed to load projects", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      toast({ title: "Error", description: "Project name is required", variant: "destructive" });
      return;
    }

    setCreating(true);
    try {
      await projectAPI.create({
        name: newProjectName,
        description: newProjectDescription,
        type: newProjectType,
      });
      
      toast({ title: "Success", description: "Project created successfully" });
      setDialogOpen(false);
      setNewProjectName('');
      setNewProjectDescription('');
      setNewProjectType('STANDALONE');
      loadProjects();
    } catch (error: any) {
      toast({ title: "Error", description: error.response?.data?.error || "Failed to create project", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const loadVendors = async (project: any) => {
    setSelectedProject(project);
    setLoadingVendors(true);
    setVendorDialogOpen(true);
    try {
      const response = await vendorAPI.getAll(project.id);
      setVendors(response.data.data || []);
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to load vendors", variant: "destructive" });
    } finally {
      setLoadingVendors(false);
    }
  };

  const handleCreateVendor = async () => {
    if (!newVendorName.trim() || !selectedProject) return;

    if (selectedProject.type === 'CLUSTER' && newVendorOwnerCode.length !== 6) {
      toast({ title: "Error", description: "Cluster vendors require a valid 6-digit Owner ID", variant: "destructive" });
      return;
    }

    setCreatingVendor(true);
    try {
      const response = await vendorAPI.create(selectedProject.id, {
        name: newVendorName,
        ownerCode: newVendorOwnerCode || undefined,
      });

      const clusterRequestStatus = response.data?.data?.clusterRequestStatus;
      
      toast({
        title: "Success",
        description:
          clusterRequestStatus === 'ACCEPTED'
            ? "Vendor is already linked to this owner"
            : selectedProject.type === 'CLUSTER'
              ? "Vendor saved and owner request sent"
              : "Vendor created",
      });
      setNewVendorName('');
      setNewVendorOwnerCode('');
      loadVendors(selectedProject);
    } catch (error: any) {
      toast({ title: "Error", description: error.response?.data?.error || "Failed to create vendor", variant: "destructive" });
    } finally {
      setCreatingVendor(false);
    }
  };

  const handleDeleteVendor = async (vendorId: string) => {
    if (!selectedProject) return;
    
    try {
      await vendorAPI.delete(selectedProject.id, vendorId);
      toast({ title: "Success", description: "Vendor deleted" });
      loadVendors(selectedProject);
    } catch (error: any) {
      toast({ title: "Error", description: error.response?.data?.error || "Failed to delete vendor", variant: "destructive" });
    }
  };

  const getTypeBadge = (type: ProjectType) => {
    switch (type) {
      case 'CLUSTER': return <Badge variant="outline" className="bg-purple-100 text-purple-800">Cluster</Badge>;
      case 'TRANSFERABLE': return <Badge variant="outline" className="bg-blue-100 text-blue-800">Transferable</Badge>;
      default: return <Badge variant="outline">Standalone</Badge>;
    }
  };

  const getRequestBadge = (status?: string | null) => {
    switch (status) {
      case 'ACCEPTED':
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Accepted</Badge>;
      case 'PENDING':
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pending</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'EXPIRED':
        return <Badge variant="secondary">Expired</Badge>;
      case 'CANCELED':
        return <Badge variant="secondary">Canceled</Badge>;
      default:
        return <Badge variant="outline">No request</Badge>;
    }
  };

  const filteredProjects = projects.filter(p => 
    p.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Projects</h1>
            <p className="text-muted-foreground mt-1">Manage your API projects</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadProjects}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
            <Button size="sm" onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />New Project</Button>
          </div>
        </div>

        <Separator />

        <Card>
          <CardContent className="pt-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search projects..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-0">
            <CardTitle>My Projects</CardTitle>
            <CardDescription>{filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <LoadingSkeleton /> : filteredProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FolderKanban className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No projects found</p>
                <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />Create your first project
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Vendors</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProjects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell>
                        <p className="font-medium">{project.name}</p>
                        <p className="text-sm text-muted-foreground">{project.description}</p>
                      </TableCell>
                      <TableCell>{getTypeBadge(project.type)}</TableCell>
                      <TableCell><Badge variant={project.status === 'ACTIVE' ? "default" : "secondary"}>{project.status || 'SETUP'}</Badge></TableCell>
                      <TableCell>
                        {project.type === 'CLUSTER' && (
                          <Button variant="ghost" size="sm" onClick={() => loadVendors(project)}>
                            <Users className="h-4 w-4 mr-1" /> {project._count?.vendors || 0}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" asChild><a href={`/dashboard/projects/${project.id}`}><Eye className="h-4 w-4" /></a></Button>
                          <Button variant="ghost" size="icon"><Key className="h-4 w-4" /></Button>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>Create a new API project to manage your transactions.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                placeholder="My API Project"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-description">Description (Optional)</Label>
              <Input
                id="project-description"
                placeholder="Brief description of your project"
                value={newProjectDescription}
                onChange={(e) => setNewProjectDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Project Type</Label>
              <Select value={newProjectType} onValueChange={(v: ProjectType) => setNewProjectType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STANDALONE">Standalone - Single project</SelectItem>
                  <SelectItem value="CLUSTER">Cluster - Multiple vendors</SelectItem>
                  <SelectItem value="TRANSFERABLE">Transferable - Can be transferred to client</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateProject} disabled={creating}>
              {creating ? 'Creating...' : 'Create Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={vendorDialogOpen} onOpenChange={setVendorDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Vendors - {selectedProject?.name}</DialogTitle>
            <DialogDescription>Manage vendors for this cluster project</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Input
                placeholder="Vendor name"
                value={newVendorName}
                onChange={(e) => setNewVendorName(e.target.value)}
              />
              <Input
                placeholder="Owner ID (6 digits)"
                value={newVendorOwnerCode}
                onChange={(e) => setNewVendorOwnerCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              <Button
                onClick={handleCreateVendor}
                disabled={
                  creatingVendor ||
                  !newVendorName.trim() ||
                  (selectedProject?.type === 'CLUSTER' && newVendorOwnerCode.length !== 6)
                }
              >
                {creatingVendor ? '...' : <Plus className="h-4 w-4" />}
              </Button>
            </div>
            {selectedProject?.type === 'CLUSTER' && (
              <p className="text-xs text-muted-foreground">Adding a vendor sends a cluster request to that Owner ID in the mobile app.</p>
            )}
            {loadingVendors ? (
              <Skeleton className="h-20 w-full" />
            ) : vendors.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No vendors yet</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {vendors.map((vendor) => (
                  <div key={vendor.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <p className="font-medium">{vendor.name}</p>
                      {(vendor.ownerCode || vendor.phone) && (
                        <p className="text-xs text-muted-foreground">Owner ID: {vendor.ownerCode || vendor.phone}</p>
                      )}
                      <div className="mt-1">{getRequestBadge(vendor.clusterRequestStatus)}</div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteVendor(vendor.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVendorDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
