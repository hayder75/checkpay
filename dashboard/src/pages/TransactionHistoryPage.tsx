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
import { downloadCSV, downloadExcel } from "@/utils/export";
import { Search, Filter, Download, ArrowUpDown, Eye, CheckCircle, RefreshCw } from "lucide-react";

function LoadingTable() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date/Time</TableHead>
          <TableHead>Txn ID</TableHead>
          <TableHead>Sender</TableHead>
          <TableHead>Sender Name</TableHead>
          <TableHead>Receiver</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Currency</TableHead>
          <TableHead>Bank/Source</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Source Type</TableHead>
          <TableHead>Pattern</TableHead>
          <TableHead>Business</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...Array(5)].map((_, i) => (
          <TableRow key={i}>
            {[...Array(13)].map((_, j) => (
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
  verified: "default",
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

const formatFullDateTime = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
};

interface VerificationAttempt {
  id?: string;
  timestamp?: string;
  status?: string;
  notes?: string;
  verifiedBy?: string;
}

interface TransactionDetailsDialogProps {
  transaction: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  verificationAttempts?: VerificationAttempt[];
}

function TransactionDetailsDialog({ transaction, open, onOpenChange, verificationAttempts = [] }: TransactionDetailsDialogProps) {
  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Transaction Details</DialogTitle>
          <DialogDescription>Complete information for this transaction</DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-muted-foreground text-xs">Transaction ID</Label>
              <p className="font-mono text-xs break-all">{transaction.transactionId || transaction.txnId || "-"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Date/Time</Label>
              <p className="text-sm">{formatFullDateTime(transaction.createdAt)}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Sender (Phone)</Label>
              <p className="font-mono text-sm">{transaction.sender || transaction.from || "-"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Sender Name</Label>
              <p className="text-sm">{transaction.senderName || transaction.fromName || transaction.sender_name || "-"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Receiver</Label>
              <p className="font-mono text-sm">{transaction.to || transaction.receiver || "-"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Amount</Label>
              <p className="font-mono text-sm font-semibold">{transaction.amount ? `${Number(transaction.amount).toLocaleString()} ${transaction.currency || "ETB"}` : "-"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Currency</Label>
              <p className="text-sm">{transaction.currency || "ETB"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Bank/Source</Label>
              <p className="text-sm">{transaction.bank || transaction.senderBank || transaction.receiverBank || "-"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Status</Label>
              <p className="text-sm"><Badge variant={statusVariants[transaction.status] || "outline"}>{transaction.status}</Badge></p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Source Type</Label>
              <p className="text-sm">{transaction.source || transaction.inputSource || transaction.sourceType || "-"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Pattern Used</Label>
              <p className="text-sm">{transaction.pattern?.pattern || transaction.patternUsed || transaction.patternId || "-"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Business</Label>
              <p className="text-sm">{transaction.businessName || transaction.projectName || transaction.business || "-"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Verification Status</Label>
              <p className="text-sm">
                {transaction._isPending ? (
                  <span className="text-yellow-600 font-medium">Pending Verification</span>
                ) : transaction.verifiedAt ? (
                  <span className="text-green-600 font-medium">Verified</span>
                ) : (
                  <span className="text-gray-500">Unverified</span>
                )}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Verified At</Label>
              <p className="text-sm">{transaction.verifiedAt ? formatFullDateTime(transaction.verifiedAt) : "-"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Verified By</Label>
              <p className="text-sm">{transaction.verifiedBy || transaction.verified_by || "-"}</p>
            </div>
            {transaction.message && (
              <div className="col-span-2 md:col-span-3">
                <Label className="text-muted-foreground text-xs">Message</Label>
                <p className="text-sm">{transaction.message}</p>
              </div>
            )}
            {transaction.reference && (
              <div>
                <Label className="text-muted-foreground text-xs">Reference</Label>
                <p className="font-mono text-xs">{transaction.reference}</p>
              </div>
            )}
          </div>

          {verificationAttempts.length > 0 && (
            <div className="border-t pt-4">
              <Label className="text-muted-foreground text-sm font-medium mb-3 block">Verification History</Label>
              <div className="space-y-3">
                {verificationAttempts.map((attempt, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="mt-1">
                      {attempt.status === "verified" ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : attempt.status === "failed" ? (
                        <RefreshCw className="h-4 w-4 text-red-600" />
                      ) : (
                        <RefreshCw className="h-4 w-4 text-yellow-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium capitalize">{attempt.status}</span>
                        <span className="text-xs text-muted-foreground">{formatFullDateTime(attempt.timestamp)}</span>
                      </div>
                      {attempt.notes && <p className="text-xs text-muted-foreground mt-1">{attempt.notes}</p>}
                      {attempt.verifiedBy && <p className="text-xs text-muted-foreground">By: {attempt.verifiedBy}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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
  const [verifying, setVerifying] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [bankFilter, setBankFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [amountMin, setAmountMin] = useState<string>("");
  const [amountMax, setAmountMax] = useState<string>("");
  
  const [page, setPage] = useState(1);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [verificationAttempts, setVerificationAttempts] = useState<VerificationAttempt[]>([]);

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

  const allTransactions = useMemo(() => {
    return [
      ...transactions,
      ...pendingVerifications.map((p) => ({
        ...(p.transaction || p),
        _isPending: true,
        status: "pending",
        type: "verification",
      })),
    ];
  }, [transactions, pendingVerifications]);

  const availableBanks = useMemo(() => {
    const banks = new Set<string>();
    allTransactions.forEach((t) => {
      const bank = (t.bank || t.senderBank || t.receiverBank || "").toString().trim();
      if (bank) banks.add(bank);
    });
    return Array.from(banks).sort((a, b) => a.localeCompare(b));
  }, [allTransactions]);

  const availableSources = useMemo(() => {
    const sources = new Set<string>();
    allTransactions.forEach((t) => {
      const source = (t.source || t.inputSource || t.sourceType || "").toString().trim();
      if (source) sources.add(source.toUpperCase());
    });
    return Array.from(sources).sort((a, b) => a.localeCompare(b));
  }, [allTransactions]);

  const filteredTransactions = allTransactions.filter((t) => {
    const search = searchTerm.toLowerCase();
    const txBank = String(t.bank || t.senderBank || t.receiverBank || "").trim();

    const senderPhone = String(t.sender || t.from || t.sendFrom || "").toLowerCase();
    const receiver = String(t.to || t.receiver || "").toLowerCase();
    const txnId = String(t.transactionId || t.txnId || "").toLowerCase();
    const amount = Number(t.amount) || 0;

    const matchesSearch =
      !search ||
      senderPhone.includes(search) ||
      receiver.includes(search) ||
      txnId.includes(search) ||
      String(amount).includes(search);

    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    const sourceValue = (t.source || t.inputSource || t.sourceType || "").toString().toUpperCase();
    const matchesSource = sourceFilter === "all" || sourceValue === sourceFilter;
    const matchesBank = bankFilter === "all" || txBank === bankFilter;

    const txDate = t.createdAt ? new Date(t.createdAt).getTime() : 0;
    const fromDate = dateFrom ? new Date(dateFrom).getTime() : 0;
    const toDate = dateTo ? new Date(dateTo).getTime() + 86400000 : Number.MAX_SAFE_INTEGER;
    const matchesDateRange = (!dateFrom || txDate >= fromDate) && (!dateTo || txDate <= toDate);

    const matchesAmountRange = 
      (!amountMin || amount >= Number(amountMin)) && 
      (!amountMax || amount <= Number(amountMax));

    return matchesSearch && matchesStatus && matchesSource && matchesBank && matchesDateRange && matchesAmountRange;
  });

  const handleRowClick = (transaction: any) => {
    setSelectedTransaction(transaction);
    const attempts: VerificationAttempt[] = [];
    if (transaction.verificationHistory) {
      attempts.push(...transaction.verificationHistory);
    }
    if (transaction.verifiedAt) {
      attempts.push({
        timestamp: transaction.verifiedAt,
        status: "verified",
        verifiedBy: transaction.verifiedBy,
        notes: "Transaction verified",
      });
    }
    if (transaction._isPending) {
      attempts.push({
        timestamp: transaction.createdAt,
        status: "pending",
        notes: "Awaiting verification",
      });
    }
    setVerificationAttempts(attempts);
    setDetailsDialogOpen(true);
  };

  const handleVerify = async (transaction: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setVerifying(transaction.id || transaction.transactionId || transaction.txnId);
    try {
      await dashboardAPI.verifyTransaction(transaction.id || transaction.transactionId || transaction.txnId);
      toast({ title: "Success", description: "Transaction verified successfully", variant: "default" });
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.response?.data?.error || "Failed to verify transaction", variant: "destructive" });
    } finally {
      setVerifying(null);
    }
  };

  const handleExport = (type: 'csv' | 'excel') => {
    const exportData = filteredTransactions.map(t => ({
      'Txn ID': t.transactionId || t.txnId || '-',
      'Date/Time': formatFullDateTime(t.createdAt),
      'Sender': t.sender || t.from || t.sendFrom || '-',
      'Sender Name': t.senderName || t.fromName || t.sender_name || '-',
      'Receiver': t.to || t.receiver || '-',
      'Amount': t.amount || '-',
      'Currency': t.currency || 'ETB',
      'Bank/Source': t.bank || t.senderBank || t.receiverBank || '-',
      'Status': t.status || '-',
      'Source Type': t.source || t.inputSource || t.sourceType || '-',
      'Pattern Used': t.pattern?.pattern || t.patternUsed || t.patternId || '-',
      'Business': t.businessName || t.projectName || t.business || '-',
      'Verified': t.verifiedAt ? 'Yes' : t._isPending ? 'Pending' : 'No',
    }));

    if (type === 'csv') {
      downloadCSV(exportData, `transactions_${new Date().toISOString().split('T')[0]}`);
    } else {
      downloadExcel(exportData, `transactions_${new Date().toISOString().split('T')[0]}`);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setSourceFilter("all");
    setBankFilter("all");
    setDateFrom("");
    setDateTo("");
    setAmountMin("");
    setAmountMax("");
  };

  const hasActiveFilters = searchTerm || statusFilter !== "all" || sourceFilter !== "all" || bankFilter !== "all" || dateFrom || dateTo || amountMin || amountMax;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Transactions</h1>
            <p className="text-muted-foreground mt-1">View and manage your transaction history</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('excel')}>
              <Download className="h-4 w-4 mr-2" />
              Excel
            </Button>
          </div>
        </div>

        <Separator />

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by phone, Txn ID, amount..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {availableSources.map((source) => (
                    <SelectItem key={source} value={source}>{source}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={bankFilter} onValueChange={setBankFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Bank" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Banks</SelectItem>
                  {availableBanks.map((bank) => (
                    <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">From:</Label>
                <Input
                  type="date"
                  className="w-36"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">To:</Label>
                <Input
                  type="date"
                  className="w-36"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">Min:</Label>
                <Input
                  type="number"
                  placeholder="0"
                  className="w-24"
                  value={amountMin}
                  onChange={(e) => setAmountMin(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">Max:</Label>
                <Input
                  type="number"
                  placeholder="Any"
                  className="w-24"
                  value={amountMax}
                  onChange={(e) => setAmountMax(e.target.value)}
                />
              </div>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear Filters
                </Button>
              )}
              {userRole === "DEVELOPER" && projects.length > 0 && (
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger className="w-full sm:w-48">
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
            <div className="overflow-x-auto">
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
                      <TableHead className="whitespace-nowrap">
                        <Button variant="ghost" size="sm" className="-ml-4 h-8 font-normal">
                          Date/Time <ArrowUpDown className="ml-2 h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead className="whitespace-nowrap">Txn ID</TableHead>
                      <TableHead className="whitespace-nowrap">Sender</TableHead>
                      <TableHead className="whitespace-nowrap">Sender Name</TableHead>
                      <TableHead className="whitespace-nowrap">Receiver</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Amount</TableHead>
                      <TableHead className="whitespace-nowrap">Currency</TableHead>
                      <TableHead className="whitespace-nowrap">Bank/Source</TableHead>
                      <TableHead className="whitespace-nowrap">Status</TableHead>
                      <TableHead className="whitespace-nowrap">Source Type</TableHead>
                      <TableHead className="whitespace-nowrap">Pattern</TableHead>
                      <TableHead className="whitespace-nowrap">Business</TableHead>
                      <TableHead className="whitespace-nowrap">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.map((transaction) => (
                      <TableRow
                        key={transaction.id || transaction.transactionId || transaction.txnId}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleRowClick(transaction)}
                      >
                        <TableCell className="font-mono text-xs whitespace-nowrap">{formatReadableDate(transaction.createdAt)}</TableCell>
                        <TableCell><code className="text-xs font-mono">{transaction.transactionId || transaction.txnId || "-"}</code></TableCell>
                        <TableCell className="font-medium whitespace-nowrap">{transaction.sender || transaction.from || transaction.sendFrom || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{transaction.senderName || transaction.fromName || transaction.sender_name || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{transaction.to || transaction.receiver || "-"}</TableCell>
                        <TableCell className="text-right font-mono font-semibold whitespace-nowrap">{transaction.amount ? Number(transaction.amount).toLocaleString() : "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{transaction.currency || "ETB"}</TableCell>
                        <TableCell className="whitespace-nowrap">{transaction.bank || transaction.senderBank || transaction.receiverBank || transaction.pattern?.bank || "-"}</TableCell>
                        <TableCell><Badge variant={statusVariants[transaction.status] || "outline"}>{transaction.status}</Badge></TableCell>
                        <TableCell className="whitespace-nowrap">{transaction.source || transaction.inputSource || transaction.sourceType || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{transaction.pattern?.pattern || transaction.patternUsed || transaction.patternId || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{transaction.businessName || transaction.projectName || transaction.business || "-"}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            {transaction._isPending && (
                              <Button
                                variant="default"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={(e) => handleVerify(transaction, e)}
                                disabled={verifying === (transaction.id || transaction.transactionId || transaction.txnId)}
                              >
                                {verifying === (transaction.id || transaction.transactionId || transaction.txnId) ? (
                                  <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                                ) : (
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                )}
                                Verify
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>

        <TransactionDetailsDialog 
          transaction={selectedTransaction} 
          open={detailsDialogOpen} 
          onOpenChange={setDetailsDialogOpen}
          verificationAttempts={verificationAttempts}
        />

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