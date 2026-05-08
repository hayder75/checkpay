import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { adminAPI } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Server, Database, HardDrive, Activity, Clock, Zap } from 'lucide-react';
import DashboardLayout from '@/components/layouts/DashboardLayout';

const statusColors: Record<string, string> = {
  healthy: 'text-green-500',
  warning: 'text-yellow-500',
  critical: 'text-red-500',
  unknown: 'text-gray-500',
};

export default function SystemHealthPage() {
  const { toast } = useToast();
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadHealth(); }, []);

  const loadHealth = async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getHealth();
      setHealth(response.data.data);
    } catch (error: any) {
      toast({ title: "Error", description: error.response?.data?.error || "Failed to load health", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const cpuUsage = health?.cpu?.usage || 0;
  const memoryUsage = health?.memory?.used / health?.memory?.total * 100 || 0;
  const diskUsage = health?.disk?.used / health?.disk?.total * 100 || 0;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">System Health</h1>
            <p className="text-muted-foreground mt-1">Platform system status and metrics</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadHealth}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
        </div>

        <Separator />

        {loading ? (
          <div className="grid gap-4 md:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i}><CardContent className="pt-6"><Skeleton className="h-32 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : (
          <>
            {/* Overall Status */}
            <Card className={health?.status === 'healthy' ? 'border-green-500/30' : 'border-yellow-500/30'}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  {health?.status === 'healthy' ? (
                    <CheckCircle className="h-12 w-12 text-green-500" />
                  ) : health?.status === 'warning' ? (
                    <AlertTriangle className="h-12 w-12 text-yellow-500" />
                  ) : (
                    <XCircle className="h-12 w-12 text-red-500" />
                  )}
                  <div>
                    <p className="text-2xl font-bold capitalize">{health?.status || 'Unknown'}</p>
                    <p className="text-muted-foreground">Overall system status</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Resource Cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Server className="h-4 w-4" />CPU Usage</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{cpuUsage.toFixed(1)}%</div>
                  <Progress value={cpuUsage} className="mt-2" />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Database className="h-4 w-4" />Memory</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{memoryUsage.toFixed(1)}%</div>
                  <Progress value={memoryUsage} className="mt-2" />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><HardDrive className="h-4 w-4" />Disk</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{diskUsage.toFixed(1)}%</div>
                  <Progress value={diskUsage} className="mt-2" />
                </CardContent>
              </Card>
            </div>

            {/* Services */}
            <Card>
              <CardHeader><CardTitle>Services</CardTitle><CardDescription>System services status</CardDescription></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(health?.services || []).map((service: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${service.status === 'up' ? 'bg-green-500' : service.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'}`} />
                        <span className="font-medium">{service.name}</span>
                      </div>
                      <Badge variant={service.status === 'up' ? 'default' : service.status === 'degraded' ? 'outline' : 'destructive'}>
                        {service.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Database */}
            <Card>
              <CardHeader><CardTitle>Database</CardTitle><CardDescription>Database connection status</CardDescription></CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="font-medium flex items-center gap-2">
                      {health?.database?.connected ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                      {health?.database?.connected ? 'Connected' : 'Disconnected'}
                    </p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Response Time</p>
                    <p className="font-medium">{health?.database?.responseTime || '-'}ms</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}