import { useEffect, useMemo, useState, useCallback } from "react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { authAPI, clustersAPI, projectAPI } from "@/lib";
import { useToast } from "@/components/ui/use-toast";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Download, Smartphone, RefreshCw, CheckCircle } from "lucide-react";

export default function MobileAppPage() {
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [incoming, setIncoming] = useState<any[]>([]);
  const [outgoing, setOutgoing] = useState<any[]>([]);
  const [ownerCode, setOwnerCode] = useState("");
  const [projectId, setProjectId] = useState("none");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkExpired, setLinkExpired] = useState(false);
  const [linkSuccess, setLinkSuccess] = useState(false);
  const [countdown, setCountdown] = useState(300);

  const apkUrl = "https://checkpay.com/download/CheckPay.apk";

  const pendingIncoming = useMemo(() => incoming.filter((r) => r.status === "PENDING"), [incoming]);
  const manageableOutgoing = useMemo(() => outgoing, [outgoing]);

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (!linkToken) return;
    setLinkExpired(false);
    setCountdown(300);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setLinkExpired(true);
          setLinkToken(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [linkToken]);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [meRes, projRes, inRes, outRes] = await Promise.all([
        authAPI.getMe(),
        projectAPI.getAll().catch(() => ({ data: { data: [] } })),
        clustersAPI.getIncomingRequests().catch(() => ({ data: { data: [] } })),
        clustersAPI.getOutgoingRequests().catch(() => ({ data: { data: [] } })),
      ]);

      setUser(meRes.data.data);
      setProjects(Array.isArray(projRes?.data?.data) ? projRes.data.data : []);
      setIncoming(Array.isArray(inRes?.data?.data) ? inRes.data.data : []);
      setOutgoing(Array.isArray(outRes?.data?.data) ? outRes.data.data : []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.response?.data?.error || "Failed to load mobile integration data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateLinkQR = async () => {
    try {
      setLinkLoading(true);
      setLinkSuccess(false);
      setLinkExpired(false);
      const res = await authAPI.generateQrSignup();
      setLinkToken(res.data.token);
      toast({ title: "QR Code Generated", description: "Scan with your mobile app within 5 minutes" });
    } catch (error: any) {
      toast({ title: "Error", description: error?.response?.data?.error || "Failed to generate QR code", variant: "destructive" });
    } finally {
      setLinkLoading(false);
    }
  };

  const checkLinkStatus = useCallback(async () => {
    if (!linkToken) return;
    try {
      const res = await authAPI.getMe();
      const freshUser = res.data.data;
      if (freshUser?.linkedMobile) {
        setLinkSuccess(true);
        setLinkToken(null);
        setUser(freshUser);
        toast({ title: "Mobile Linked", description: "Your mobile device is now linked as a developer" });
      }
    } catch {
    }
  }, [linkToken]);

  useEffect(() => {
    if (!linkToken) return;
    const interval = setInterval(checkLinkStatus, 3000);
    return () => clearInterval(interval);
  }, [linkToken, checkLinkStatus]);

  const submitClusterRequest = async () => {
    if (!ownerCode || ownerCode.length !== 6) {
      toast({ title: "Owner ID Required", description: "Enter a valid 6-digit owner ID", variant: "destructive" });
      return;
    }

    try {
      setSending(true);
      await clustersAPI.createRequest({
        ownerCode,
        projectId: projectId && projectId !== "none" ? projectId : undefined,
      });
      toast({ title: "Request Sent", description: "Cluster request sent to business owner" });
      setOwnerCode("");
      await loadAll();
    } catch (error: any) {
      toast({ title: "Error", description: error?.response?.data?.error || "Failed to send cluster request", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const acceptIncoming = async (id: string) => {
    try {
      await clustersAPI.acceptRequest(id);
      toast({ title: "Accepted", description: "Cluster request accepted" });
      await loadAll();
    } catch (error: any) {
      toast({ title: "Error", description: error?.response?.data?.error || "Failed to accept request", variant: "destructive" });
    }
  };

  const rejectIncoming = async (id: string) => {
    try {
      await clustersAPI.rejectRequest(id);
      toast({ title: "Rejected", description: "Cluster request rejected" });
      await loadAll();
    } catch (error: any) {
      toast({ title: "Error", description: error?.response?.data?.error || "Failed to reject request", variant: "destructive" });
    }
  };

  const cancelOutgoing = async (id: string) => {
    try {
      await clustersAPI.cancelRequest(id);
      toast({ title: "Canceled", description: "Cluster request canceled" });
      await loadAll();
    } catch (error: any) {
      toast({ title: "Error", description: error?.response?.data?.error || "Failed to cancel request", variant: "destructive" });
    }
  };

  const deleteOutgoing = async (id: string) => {
    try {
      await clustersAPI.deleteRequest(id);
      toast({ title: "Deleted", description: "Cluster link deleted" });
      await loadAll();
    } catch (error: any) {
      toast({ title: "Error", description: error?.response?.data?.error || "Failed to delete cluster link", variant: "destructive" });
    }
  };

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
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
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Mobile Integration</h1>
            <p className="text-muted-foreground">APK setup, owner ID linking, and cluster request management</p>
          </div>
          <Button variant="outline" onClick={loadAll}>
            <RefreshCw className="mr-2 h-4 w-4" />Refresh
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />Download APK
              </CardTitle>
              <CardDescription>Scan QR code or download directly</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-center p-4 bg-white rounded-md">
                <QRCodeSVG value={apkUrl} size={190} />
              </div>
              <Button className="w-full" onClick={() => window.open(apkUrl, "_blank")}>
                <Download className="mr-2 h-4 w-4" />Download APK
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Developer Access Keys</CardTitle>
              <CardDescription>Use these in the mobile app</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>API Key</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-muted rounded-md text-sm break-all">{user?.apiKey || "-"}</code>
                  <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(user?.apiKey || "")}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Your Owner ID (if business owner)</Label>
                <code className="block px-3 py-2 bg-muted rounded-md text-sm">{user?.ownerCode || "Not assigned"}</code>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Link Mobile as Developer</CardTitle>
            <CardDescription>Generate a QR code to link your mobile app as a developer device</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!linkToken && !linkSuccess && !user?.linkedMobile && (
              <Button onClick={generateLinkQR} disabled={linkLoading} className="w-full">
                {linkLoading ? "Generating..." : "Generate Login QR Code"}
              </Button>
            )}
            {linkToken && (
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 bg-white rounded-md">
                  <QRCodeSVG value={linkToken} size={200} />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium">Scan with CheckPay Mobile App</p>
                  <p className={`text-2xl font-mono font-bold ${countdown <= 60 ? "text-destructive" : "text-primary"}`}>
                    {formatCountdown(countdown)}
                  </p>
                  <p className="text-xs text-muted-foreground">Expires in {formatCountdown(countdown)}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => { setLinkToken(null); setCountdown(0); }}>
                  Cancel
                </Button>
              </div>
            )}
            {linkSuccess && (
              <div className="flex flex-col items-center gap-3 p-6 border rounded-md bg-green-50 dark:bg-green-950/20">
                <CheckCircle className="h-12 w-12 text-green-500" />
                <p className="text-lg font-medium text-green-700 dark:text-green-400">Mobile Linked Successfully!</p>
                <p className="text-sm text-muted-foreground">Your mobile device is now linked as a developer</p>
                <Button variant="outline" onClick={() => { setLinkSuccess(false); }}>
                  Link Another Device
                </Button>
              </div>
            )}
            {user?.linkedMobile && !linkSuccess && (
              <div className="flex flex-col items-center gap-3 p-6 border rounded-md bg-green-50 dark:bg-green-950/20">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <p className="font-medium text-green-700 dark:text-green-400">Mobile Device Linked</p>
                <p className="text-sm text-muted-foreground">Your mobile app is connected as developer</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Send Cluster Request by Owner ID</CardTitle>
            <CardDescription>Developers can link a project to a business owner using their 6-digit owner ID</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Business Owner ID</Label>
              <Input value={ownerCode} onChange={(e) => setOwnerCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" />
            </div>
            <div className="space-y-2">
              <Label>Project (optional)</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button disabled={sending} className="w-full" onClick={submitClusterRequest}>
                {sending ? "Sending..." : "Send Request"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Incoming Requests</CardTitle>
              <CardDescription>Approve requests if you are a business owner</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingIncoming.length === 0 && <p className="text-sm text-muted-foreground">No pending incoming requests</p>}
              {pendingIncoming.map((req) => (
                <div key={req.id} className="border rounded-md p-3 space-y-2">
                  <p className="text-sm font-medium">From: {req.developer?.username || req.developer?.email || "Developer"}</p>
                  <p className="text-xs text-muted-foreground">Project: {req.project?.name || "No project"}</p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => acceptIncoming(req.id)}>Accept</Button>
                    <Button size="sm" variant="outline" onClick={() => rejectIncoming(req.id)}>Reject</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Outgoing Requests</CardTitle>
              <CardDescription>Track requests sent to owners</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {manageableOutgoing.length === 0 && <p className="text-sm text-muted-foreground">No outgoing cluster links</p>}
              {manageableOutgoing.map((req) => (
                <div key={req.id} className="border rounded-md p-3 space-y-2">
                  <p className="text-sm font-medium">Owner ID: {req.ownerCode}</p>
                  <p className="text-xs text-muted-foreground">Project: {req.project?.name || "No project"} | Status: {req.status}</p>
                  <div className="flex gap-2">
                    {req.status === "PENDING" && (
                      <Button size="sm" variant="outline" onClick={() => cancelOutgoing(req.id)}>Cancel</Button>
                    )}
                    <Button size="sm" variant="destructive" onClick={() => deleteOutgoing(req.id)}>Delete Link</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
