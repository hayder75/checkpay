import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableRow } from "@/components/ui/table";
import { Link } from "react-router-dom";
import { dashboardAPI, authAPI, businessAPI } from "@/lib";
import { useToast } from "@/components/ui/use-toast";
import { TrendingUp, History, Zap, AlertCircle, Building2, Package, Copy, Key, Plus, X } from "lucide-react";

function StatsCard({ title, value, icon: Icon, description, trend }: { title: string; value: string | number; icon: any; description?: string; trend?: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
        {trend && <p className="text-xs text-muted-foreground mt-1">{trend}</p>}
      </CardContent>
    </Card>
  );
}

function TokenAlert({ tokens }: { tokens: any; userPlan?: string }) {
  const phoneRemaining = tokens?.phone?.remaining;
  const verifiedRemaining = tokens?.verified?.remaining;
  const phoneMax = tokens?.phone?.max;
  const verifiedMax = tokens?.verified?.max;

  const isPhoneExhausted = phoneRemaining !== null && phoneRemaining !== undefined && phoneRemaining <= 0;
  const isVerifiedExhausted = verifiedRemaining !== null && verifiedRemaining !== undefined && verifiedRemaining <= 0;
  const isAnyExhausted = isPhoneExhausted || isVerifiedExhausted;

  const phonePercent = phoneMax && phoneMax > 0 ? (phoneRemaining / phoneMax) * 100 : 100;
  const verifiedPercent = verifiedMax && verifiedMax > 0 ? (verifiedRemaining / verifiedMax) * 100 : 100;
  const isLow = (phonePercent < 20 && phoneRemaining !== null) || (verifiedPercent < 20 && verifiedRemaining !== null);

  if (!isAnyExhausted && !isLow) return null;

  return (
    <Card variant={isAnyExhausted ? "destructive" : "warning"}>
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <AlertCircle className={`h-5 w-5 mt-0.5 ${isAnyExhausted ? "text-destructive" : "text-yellow-600"}`} />
          <div className="flex-1">
            <h3 className="font-semibold mb-1">{isAnyExhausted ? "Tokens Exhausted" : "Low Token Balance"}</h3>
            <p className="text-sm text-muted-foreground mb-3">
              {isAnyExhausted
                ? "Transactions are blocked. Upgrade your package to continue."
                : `Phone: ${phoneRemaining === null ? "Unlimited" : phoneRemaining} remaining, Verified: ${verifiedRemaining === null ? "Unlimited" : verifiedRemaining} remaining.`}
            </p>
            <div className="flex gap-2">
              <Link to="/dashboard/packages">
                <Button size="sm">Upgrade Package</Button>
              </Link>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-64" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

const BANKS_STORAGE_PREFIX = "checkpay_dashboard_selected_banks_";

const normalizeBank = (value: any): string | null => {
  if (!value) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "object") {
    const candidate = value.institution || value.bank || value.name || value.label;
    return normalizeBank(candidate);
  }
  return null;
};

const extractBanks = (statsData: any, businessData: any): string[] => {
  const banks = new Set<string>();

  const push = (value: any) => {
    const normalized = normalizeBank(value);
    if (normalized) banks.add(normalized);
  };

  (businessData?.businessPatterns || []).forEach((bp: any) => {
    push(bp?.institution);
    push(bp?.bank);
    push(bp?.name);
  });

  const txCollections = [
    statsData?.recentTransactions,
    statsData?.transactions?.recent,
    statsData?.transactions?.items,
  ];

  txCollections.forEach((collection) => {
    (Array.isArray(collection) ? collection : []).forEach((tx: any) => {
      push(tx?.bank);
      push(tx?.senderBank);
      push(tx?.receiverBank);
      push(tx?.pattern?.bank);
    });
  });

  return Array.from(banks).sort((a, b) => a.localeCompare(b));
};

export default function DashboardPage() {
  const { toast } = useToast();
  const [stats, setStats] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("");
  const [availableBanks, setAvailableBanks] = useState<string[]>([]);
  const [selectedBanks, setSelectedBanks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const getBanksStorageKey = () => `${BANKS_STORAGE_PREFIX}${selectedBusinessId || "default"}`;

  const persistSelectedBanks = (banks: string[]) => {
    setSelectedBanks(banks);
    try {
      localStorage.setItem(getBanksStorageKey(), JSON.stringify(banks));
    } catch {
      // Ignore localStorage issues silently for dashboard rendering.
    }
  };

  const hydrateBanks = (allBanks: string[]) => {
    setAvailableBanks(allBanks);
    try {
      const raw = localStorage.getItem(getBanksStorageKey());
      const parsed = raw ? JSON.parse(raw) : [];
      const saved = Array.isArray(parsed) ? parsed.filter((bank) => allBanks.includes(bank)) : [];
      if (saved.length > 0) {
        setSelectedBanks(saved);
      } else {
        setSelectedBanks(allBanks);
        localStorage.setItem(getBanksStorageKey(), JSON.stringify(allBanks));
      }
    } catch {
      setSelectedBanks(allBanks);
    }
  };

  const loadData = async () => {
    try {
      const [userRes, businessesRes] = await Promise.all([
        authAPI.getMe(),
        businessAPI.getAll().catch(() => ({ data: { data: [] } })),
      ]);
      setUser(userRes.data.data);
      const businessList = businessesRes.data.data || [];
      setBusinesses(businessList);
      if (businessList.length > 0 && !selectedBusinessId) {
        setSelectedBusinessId(businessList[0].id);
      } else {
        await loadStats();
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.response?.data?.error || "Failed to load dashboard", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const [statsRes, businessRes] = await Promise.all([
        dashboardAPI.getStats(selectedBusinessId || undefined),
        selectedBusinessId ? businessAPI.getOne(selectedBusinessId).catch(() => ({ data: { data: null } })) : Promise.resolve({ data: { data: null } }),
      ]);
      const statsData = statsRes.data.data;
      const businessData = businessRes?.data?.data;
      setStats(statsData);

      const banks = extractBanks(statsData, businessData);
      hydrateBanks(banks);
    } catch (error: any) {
      toast({ title: "Error", description: error.response?.data?.error || "Failed to load stats", variant: "destructive" });
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedBusinessId) {
      loadStats();
    }
  }, [selectedBusinessId]);

  const handleCopyApiKey = () => {
    if (user?.apiKey) {
      navigator.clipboard.writeText(user.apiKey);
      toast({ title: "Copied", description: "API key copied to clipboard" });
    }
  };

  const handleAddBank = (bank: string) => {
    if (selectedBanks.includes(bank)) return;
    persistSelectedBanks([...selectedBanks, bank].sort((a, b) => a.localeCompare(b)));
  };

  const handleRemoveBank = (bank: string) => {
    persistSelectedBanks(selectedBanks.filter((b) => b !== bank));
  };

  const unselectedBanks = availableBanks.filter((bank) => !selectedBanks.includes(bank));

  if (loading) {
    return (
      <DashboardLayout>
        <LoadingSkeleton />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Welcome back, {user?.username || user?.email || "User"}!</p>
          </div>
          {businesses.length > 0 && (
            <Select value={selectedBusinessId} onValueChange={setSelectedBusinessId}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue placeholder="Select business" />
              </SelectTrigger>
              <SelectContent>
                {businesses.map((business) => (
                  <SelectItem key={business.id} value={business.id}>
                    {business.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <Separator />

        {stats?.tokens && <TokenAlert tokens={stats.tokens} userPlan={user?.plan} />}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Transactions Today"
            value={stats?.transactions?.today || 0}
            icon={TrendingUp}
            description={`${stats?.transactions?.thisMonth || 0} this month`}
          />
          <StatsCard
            title="Total Banks"
            value={availableBanks.length || stats?.patterns?.total || 0}
            icon={Building2}
            description="Active banks"
          />
          <StatsCard
            title="Phone Tokens"
            value={stats?.tokens?.phone?.remaining ?? "∞"}
            icon={Package}
            description={stats?.tokens?.phone?.used ? `${stats.tokens.phone.used} used` : undefined}
          />
          <StatsCard
            title="Verified Tokens"
            value={stats?.tokens?.verified?.remaining ?? "∞"}
            icon={History}
            description={stats?.tokens?.verified?.used ? `${stats.tokens.verified.used} used` : undefined}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="hover:bg-muted/50 transition-colors">
            <CardContent className="pt-6">
              <Link to="/dashboard/transactions" className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <History className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">View Transactions</p>
                  <p className="text-sm text-muted-foreground">See your transaction history</p>
                </div>
              </Link>
            </CardContent>
          </Card>
          <Card className="hover:bg-muted/50 transition-colors">
            <CardContent className="pt-6">
              <Link to="/dashboard/pending-orders" className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Pending Orders</p>
                  <p className="text-sm text-muted-foreground">Manage pending transactions</p>
                </div>
              </Link>
            </CardContent>
          </Card>
          <Card className="hover:bg-muted/50 transition-colors">
            <CardContent className="pt-6">
              <Link to="/dashboard/analytics" className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Analytics</p>
                  <p className="text-sm text-muted-foreground">View usage insights</p>
                </div>
              </Link>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Business Banks</CardTitle>
            <CardDescription>Banks synced from mobile app and recent transactions. Add or remove banks directly here.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <p className="text-sm font-medium">Selected Banks ({selectedBanks.length})</p>
              {selectedBanks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No banks selected yet.</p>
              ) : (
                <div className="space-y-2">
                  {selectedBanks.map((bank) => (
                    <div key={bank} className="flex items-center justify-between rounded-lg border px-3 py-2">
                      <span className="text-sm">{bank}</span>
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveBank(bank)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-3">
              <p className="text-sm font-medium">Available Banks ({unselectedBanks.length})</p>
              {unselectedBanks.length === 0 ? (
                <p className="text-sm text-muted-foreground">All available banks are already selected.</p>
              ) : (
                <div className="space-y-2">
                  {unselectedBanks.map((bank) => (
                    <div key={bank} className="flex items-center justify-between rounded-lg border px-3 py-2">
                      <span className="text-sm">{bank}</span>
                      <Button variant="ghost" size="icon" onClick={() => handleAddBank(bank)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Separator />

        {user?.apiKey && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                API Key
              </CardTitle>
              <CardDescription>Use this key to authenticate API requests</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <code className="flex-1 px-4 py-3 bg-muted rounded-lg text-sm font-mono overflow-x-auto">{user.apiKey}</code>
                <Button variant="outline" size="sm" onClick={handleCopyApiKey}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {stats?.business && (
          <Card>
            <CardHeader>
              <CardTitle>Business Overview</CardTitle>
              <CardDescription>{stats.business.name}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  <TableRow>
                    <TableHead>Total Employees</TableHead>
                    <TableCell>{stats.business.employees || 0}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableHead>Total Transactions</TableHead>
                    <TableCell>{stats.business.totalTransactions || 0}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableHead>Active Banks</TableHead>
                    <TableCell>{selectedBanks.length || stats.business.activePatterns || 0}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
