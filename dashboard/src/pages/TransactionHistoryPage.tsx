import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { dashboardAPI, projectAPI, authAPI } from "@/lib";
import { useToast } from "@/components/ui/use-toast";
import { Search, Filter, Download, ArrowUpDown, Eye } from "lucide-react";

function LoadingTable() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Txn ID</TableHead>
          <TableHead>Sender</TableHead>
          <TableHead>Bank</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Confirmation</TableHead>
          <TableHead>Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...Array(5)].map((_, i) => (
          <TableRow key={i}>
            {[...Array(8)].map((_, j) => (
              <TableCell key={j}>
                <Skeleton className="h-4 w-20" />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  completed: "default",
  pending: "outline",
  failed: "destructive",
  processing: "secondary",
};

const formatReadableDate = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

function TransactionDetailsDialog({ transaction, open, onOpenChange }: { transaction: any; open: boolean; onOpenChange: (open: boolean) => void }) {
  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Transaction Details</DialogTitle>
          <DialogDescription>Complete information for this transaction</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground">Transaction ID</Label>
              <p className="font-mono text-sm break-all">{transaction.transactionId || transaction.txnId || "-"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Date/Time</Label>
              <p className="text-sm">{formatReadableDate(transaction.createdAt)}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Sender</Label>
              <p className="font-mono text-sm">{transaction.sender || transaction.from || "-"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Receiver</Label>
              <p className="font-mono text-sm">{transaction.to || transaction.receiver || "-"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Bank</Label>
              <p className="text-sm">{transaction.bank || transaction.senderBank || transaction.receiverBank || "-"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Amount</Label>
              <p className="font-mono text-sm">{transaction.amount ? `${Number(transaction.amount).toLocaleString()} ${transaction.currency || "ETB"}` : "-"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Status</Label>
              <p className="text-sm"><Badge variant={statusVariants[transaction.status] || "outline"}>{transaction.status}</Badge></p>
            </div>
            <div>
              <Label className="text-muted-foreground">Source</Label>
              <p className="text-sm">{transaction.source || transaction.inputSource || "-"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Verified</Label>
              <p className="text-sm">{transaction.verifiedAt ? <span className="text-green-600">Verified</span> : <span className="text-yellow-600">Pending</span>}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function TransactionHistoryPage() {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [pendingVerifications, setPendingVerifications] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [confirmationFilter, setConfirmationFilter] = useState<string>("all");
  const [bankFilter, setBankFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const userRes = await authAPI.getMe();
      setUserRole(userRes.data.data.role);

      if (userRes.data.data.role === "DEVELOPER") {
        const projectsRes = await projectAPI.getAll();
        setProjects(projectsRes.data.data || []);
      }

      const params: any = { page, limit: 20 };
      if (userRes.data.data.role === "DEVELOPER" && selectedProjectId) {
        params.projectId = selectedProjectId;
      }

      const [txnRes, pendingRes] = await Promise.all([
        dashboardAPI.getTransactions(params),
        dashboardAPI.getPendingVerifications(params).catch(() => ({ data: { data: [] } })),
      ]);

      setTransactions(txnRes.data.data.transactions || []);
      setPendingVerifications(pendingRes.data.data || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.response?.data?.error || "Failed to load transactions", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, selectedProjectId]);

  const allTransactions = [
    ...transactions,
    ...pendingVerifications.map((p) => ({
      ...(p.transaction || p),
      _isPending: true,
      status: "pending",
      type: "verification",
    })),
  ];

  const availableBanks = useMemo(() => {
    const banks = new Set<string>();
    allTransactions.forEach((t) => {
      const bank = (t.bank || t.senderBank || t.receiverBank || "").toString().trim();
      if (bank) banks.add(bank);
    });
    return Array.from(banks).sort((a, b) => a.localeCompare(b));
  }, [allTransactions]);

  const filteredTransactions = allTransactions.filter((t) => {
    const search = searchTerm.toLowerCase();
    const txBank = String(t.bank || t.senderBank || t.receiverBank || "").trim();

    const matchesSearch =
      !search ||
      String(t.sender || t.from || t.sendFrom || "").toLowerCase().includes(search) ||
      txBank.toLowerCase().includes(search) ||
      String(t.transactionId || t.txnId || "").toLowerCase().includes(search);

    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    const isVerified = !!t.verifiedAt || t._isPending === false;
    const matchesConfirmation =
      confirmationFilter === "all" ||
      (confirmationFilter === "verified" && isVerified) ||
      (confirmationFilter === "pending" && !isVerified);

    const matchesBank = bankFilter === "all" || txBank === bankFilter;

    return matchesSearch && matchesStatus && matchesConfirmation && matchesBank;
  });

  const handleRowClick = (transaction: any) => {
    setSelectedTransaction(transaction);
    setDetailsDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Transactions</h1>
            <p className="text-muted-foreground mt-1">View and manage your transaction history</p>
          </div>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>

        <Separator />

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by sender, bank, or transaction ID..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <Select value={bankFilter} onValueChange={setBankFilter}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="Bank" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Banks</SelectItem>
                  {availableBanks.map((bank) => (
                    <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                </SelectContent>
              </Select>
              <Select value={confirmationFilter} onValueChange={setConfirmationFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Confirmation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
              {userRole === "DEVELOPER" && projects.length > 0 && (
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger className="w-full sm:w-64">
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Projects</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-0">
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>{filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? "s" : ""} found</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <LoadingTable />
            ) : filteredTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Filter className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No transactions found</p>
                <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or filters</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-56">
                      <Button variant="ghost" size="sm" className="-ml-4 h-8 font-normal">
                        Date <ArrowUpDown className="ml-2 h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>Txn ID</TableHead>
                    <TableHead>Sender</TableHead>
                    <TableHead>Bank</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Confirmation</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((transaction) => (
                    <TableRow
                      key={transaction.id || transaction.transactionId || transaction.txnId}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(transaction)}
                    >
                      <TableCell className="font-mono text-sm">{formatReadableDate(transaction.createdAt)}</TableCell>
                      <TableCell><code className="text-xs font-mono">{transaction.transactionId || transaction.txnId || "-"}</code></TableCell>
                      <TableCell className="font-medium">{transaction.sender || transaction.from || transaction.sendFrom || "-"}</TableCell>
                      <TableCell>{transaction.bank || transaction.senderBank || transaction.receiverBank || transaction.pattern?.bank || "-"}</TableCell>
                      <TableCell className="text-right font-mono">{transaction.amount ? `${Number(transaction.amount).toLocaleString()} ${transaction.currency || "ETB"}` : "-"}</TableCell>
                      <TableCell><Badge variant={statusVariants[transaction.status] || "outline"}>{transaction.status}</Badge></TableCell>
                      <TableCell>
                        {transaction._isPending ? (
                          <Badge variant="secondary">Pending</Badge>
                        ) : transaction.verifiedAt ? (
                          <Badge variant="default">Verified</Badge>
                        ) : (
                          <Badge variant="outline">Unverified</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <TransactionDetailsDialog transaction={selectedTransaction} open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen} />

        {transactions.length > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Page {page} of {Math.ceil(transactions.length / 20) || 1}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={transactions.length < 20} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
