import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { projectAPI, vendorAPI } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Copy, TrendingUp, DollarSign, CheckCircle, Activity, Trash2, Users } from 'lucide-react';

interface ProjectStats {
  project: {
    id: string;
    name: string;
    projectApiKey: string;
  };
  stats: {
    total: number;
    today: number;
    thisMonth: number;
    totalAmount: number;
    todayAmount: number;
    monthAmount: number;
    verified: number;
    daily: { date: string; count: number }[];
  };
  transactions: {
    data: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}

interface ClusterMember {
  vendorId: string;
  vendorName: string;
  ownerId: string | null;
  ownerCode: string | null;
  ownerUsername: string | null;
  requestStatus: string | null;
  linkedAt: string | null;
  isTrackingActive: boolean;
  processedTransactions: number;
  processedAmount: number;
  lastTransactionAt: string | null;
}

interface ClusterMembersResponse {
  project: {
    id: string;
    name: string;
    type: 'STANDALONE' | 'CLUSTER' | 'TRANSFERABLE';
  };
  summary: {
    totalMembers: number;
    activeMembers: number;
    totalProcessedTransactions: number;
    totalProcessedAmount: number;
  };
  members: ClusterMember[];
}

export default function ProjectDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [page, setPage] = useState(1);
  const [clusterLoading, setClusterLoading] = useState(false);
  const [clusterData, setClusterData] = useState<ClusterMembersResponse | null>(null);
  const [deletingVendorId, setDeletingVendorId] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadStats();
    }
  }, [id, page]);

  useEffect(() => {
    if (id) {
      loadClusterMembers();
    }
  }, [id]);

  const loadStats = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await projectAPI.getStats(id, { page, limit: 20 });
      setStats(res.data.data);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to load project stats',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadClusterMembers = async () => {
    if (!id) return;
    try {
      setClusterLoading(true);
      const res = await projectAPI.getClusterMembers(id);
      setClusterData(res.data.data || null);
    } catch (error: any) {
      setClusterData(null);
      toast({
        title: 'Warning',
        description: error.response?.data?.error || 'Unable to load cluster members',
      });
    } finally {
      setClusterLoading(false);
    }
  };

  const removeMember = async (member: ClusterMember) => {
    if (!id) return;

    const ownerLabel = member.ownerCode || member.ownerUsername || member.vendorName;
    const confirmed = window.confirm(`Delete cluster member ${ownerLabel}? This removes the link and tracking association.`);
    if (!confirmed) return;

    try {
      setDeletingVendorId(member.vendorId);
      await vendorAPI.delete(id, member.vendorId);
      toast({ title: 'Deleted', description: 'Cluster member removed successfully' });
      await loadClusterMembers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to remove cluster member',
        variant: 'destructive',
      });
    } finally {
      setDeletingVendorId(null);
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

  if (!stats) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Project not found</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/projects')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{stats.project.name}</h1>
            <p className="text-muted-foreground">Project statistics, cluster members, and verified transactions</p>
          </div>
        </div>

        {/* API Key Card */}
        <Card>
          <CardHeader>
            <CardTitle>Project API Key</CardTitle>
            <CardDescription>Use this key for backend integration and verification</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted px-4 py-2 rounded text-sm font-mono">
                {stats.project.projectApiKey}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(stats.project.projectApiKey);
                  toast({
                    title: 'Copied',
                    description: 'API key copied to clipboard',
                  });
                }}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.stats.total}</div>
              <p className="text-xs text-muted-foreground">
                All time verified using this project
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.stats.today}</div>
              <p className="text-xs text-muted-foreground">
                Transactions verified today
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Month</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.stats.thisMonth}</div>
              <p className="text-xs text-muted-foreground">
                Transactions this month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${stats.stats.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                All time verified amount
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Verified</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.stats.verified}</div>
              <p className="text-xs text-muted-foreground">
                Successfully verified transactions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today Amount</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${stats.stats.todayAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                Amount verified today
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Month Amount</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${stats.stats.monthAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                Amount this month
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" />Cluster Members</CardTitle>
            <CardDescription>Owners linked to this project, what they processed, and remove controls</CardDescription>
          </CardHeader>
          <CardContent>
            {clusterLoading ? (
              <div className="text-sm text-muted-foreground">Loading cluster members...</div>
            ) : !clusterData || clusterData.project.type !== 'CLUSTER' ? (
              <div className="text-sm text-muted-foreground">This project is not a cluster project.</div>
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-4 mb-4">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Members</div>
                    <div className="text-xl font-bold">{clusterData.summary.totalMembers}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Active Links</div>
                    <div className="text-xl font-bold">{clusterData.summary.activeMembers}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Processed Txns</div>
                    <div className="text-xl font-bold">{clusterData.summary.totalProcessedTransactions}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Processed Amount</div>
                    <div className="text-xl font-bold">${clusterData.summary.totalProcessedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  </div>
                </div>

                {clusterData.members.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No cluster members linked yet.</div>
                ) : (
                  <div className="space-y-2">
                    {clusterData.members.map((member) => (
                      <div key={member.vendorId} className="rounded-lg border p-3 flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{member.vendorName}</div>
                          <div className="text-sm text-muted-foreground">Owner ID: {member.ownerCode || 'N/A'} {member.ownerUsername ? `| ${member.ownerUsername}` : ''}</div>
                          <div className="text-sm text-muted-foreground">Status: {member.requestStatus || 'UNLINKED'} {member.isTrackingActive ? '| Tracking active' : ''}</div>
                          <div className="text-sm text-muted-foreground">
                            Processed: {member.processedTransactions} txns | ${Number(member.processedAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-xs text-muted-foreground">Last: {member.lastTransactionAt ? new Date(member.lastTransactionAt).toLocaleString() : 'No transactions yet'}</div>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removeMember(member)}
                          disabled={deletingVendorId === member.vendorId}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          {deletingVendorId === member.vendorId ? 'Deleting...' : 'Delete'}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Verified Transactions</CardTitle>
            <CardDescription>
              Transactions verified using this project's API key
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats.transactions.data.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No transactions verified yet using this project's API key
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {stats.transactions.data.map((txn) => (
                    <div
                      key={txn.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="font-medium">TXN: {txn.txnId}</div>
                        <div className="text-sm text-muted-foreground">
                          Amount: ${txn.amount.toFixed(2)} | Sender: {txn.sender}
                          {txn.bank && ` | Bank: ${txn.bank}`}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {new Date(txn.receivedAt).toLocaleString()}
                          {txn.verifiedAt && (
                            <span className="ml-2 text-green-600">✓ Verified</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {stats.transactions.pagination.pages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {page} of {stats.transactions.pagination.pages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= stats.transactions.pagination.pages}
                      onClick={() => setPage(page + 1)}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}















