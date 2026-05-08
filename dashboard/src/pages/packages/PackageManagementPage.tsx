import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { packageAPI, businessAPI, userPackageAPI } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { Check, Zap, RefreshCcw, Plus } from 'lucide-react';
import { auth } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';

interface Package {
  id: string;
  name: string;
  description?: string;
  transactionLimit?: number;
  employeeLimit?: number;
  businessLimit?: number;
  features: any;
  price?: number | string | null;
  isCustom: boolean;
  billingCycle?: 'ONE_TIME' | 'MONTHLY' | 'SIX_MONTH' | 'QUARTERLY' | 'YEARLY' | null;
  durationDays?: number | null;
  isDeveloperToken?: boolean;
  maxPhoneTxns?: number | null;
  maxVerifiedTxns?: number | null;
  isFreePackage?: boolean;
  tier?: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'BUSINESS' | 'ENTERPRISE' | null;
  isActive?: boolean;
}

export default function PackageManagementPage() {
  const { toast } = useToast();
  const user = auth.getUser();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const [packages, setPackages] = useState<Package[]>([]);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [active, setActive] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [purchaseTransactionNumber, setPurchaseTransactionNumber] = useState('');
  const [purchasing, setPurchasing] = useState(false);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    transactionLimit: '',
    employeeLimit: '',
    businessLimit: '',
    price: '',
    features: '{}',
    billingCycle: '',
    durationDays: '',
    isDeveloperToken: false,
    maxPhoneTxns: '',
    maxVerifiedTxns: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [packagesRes, businessesRes, activeRes] = await Promise.all([
        packageAPI.getAll(),
        businessAPI.getAll(),
        userPackageAPI.getMyPackage().catch(() => ({ data: { data: null } })),
      ]);
      setPackages(packagesRes.data.data || []);
      setBusinesses(businessesRes.data.data || []);
      setActive(activeRes.data.data);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to load packages',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const data: any = {
        name: formData.name,
        description: formData.description || undefined,
        transactionLimit: formData.transactionLimit ? parseInt(formData.transactionLimit) : undefined,
        employeeLimit: formData.employeeLimit ? parseInt(formData.employeeLimit) : undefined,
        businessLimit: formData.businessLimit ? parseInt(formData.businessLimit) : undefined,
        price: formData.price ? parseFloat(formData.price) : undefined,
        features: JSON.parse(formData.features || '{}'),
        billingCycle: formData.billingCycle ? (formData.billingCycle as any) : null,
        durationDays: formData.durationDays ? parseInt(formData.durationDays) : undefined,
        isDeveloperToken: formData.isDeveloperToken,
        maxPhoneTxns: formData.maxPhoneTxns ? parseInt(formData.maxPhoneTxns) : undefined,
        maxVerifiedTxns: formData.maxVerifiedTxns ? parseInt(formData.maxVerifiedTxns) : undefined,
      };
      await packageAPI.create(data);
      toast({
        title: 'Success',
        description: 'Package created successfully',
      });
      setShowCreateModal(false);
      resetForm();
      loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to create package',
        variant: 'destructive',
      });
    }
  };

  const handleAssign = async () => {
    if (!selectedBusinessId || !formData.name) return;
    try {
      await packageAPI.assignToBusiness(selectedBusinessId, { packageId: formData.name });
      toast({
        title: 'Success',
        description: 'Package assigned successfully',
      });
      setShowAssignModal(false);
      resetForm();
      loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to assign package',
        variant: 'destructive',
      });
    }
  };

  const handlePurchase = async () => {
    if (!selectedPackage || !purchaseTransactionNumber.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a transaction number',
        variant: 'destructive',
      });
      return;
    }

    setPurchasing(true);
    try {
      await userPackageAPI.purchase({
        packageId: selectedPackage.id,
        transactionNumber: purchaseTransactionNumber,
      });
      toast({
        title: 'Success',
        description: 'Purchase request submitted. Your package will be activated once the transaction is verified.',
      });
      setShowPurchaseModal(false);
      setPurchaseTransactionNumber('');
      setSelectedPackage(null);
      await loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to submit purchase request',
        variant: 'destructive',
      });
    } finally {
      setPurchasing(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      transactionLimit: '',
      employeeLimit: '',
      businessLimit: '',
      price: '',
      features: '{}',
      billingCycle: '',
      durationDays: '',
      isDeveloperToken: false,
      maxPhoneTxns: '',
      maxVerifiedTxns: '',
    });
    setSelectedBusinessId('');
  };

  const formatPrice = (price: number | string | null | undefined): string => {
    if (price === null || price === undefined) return 'Free';
    const priceNum = typeof price === 'string' ? parseFloat(price) : price;
    if (isNaN(priceNum as number)) return 'Free';
    return `$${(priceNum as number).toFixed(2)}`;
  };

  const formatBillingCycle = (cycle: string | null | undefined): string => {
    if (!cycle) return '';
    return cycle.toLowerCase().replace('_', '-');
  };

  // No unused variables here
  const freePackage = packages.find(pkg => pkg.isFreePackage);

  // Group non-free, active packages by tier
  const groupedPackages = packages
    .filter(pkg => !pkg.isFreePackage && pkg.isActive)
    .reduce((acc, pkg) => {
      const tier = pkg.tier || 'OTHER';
      if (!acc[tier]) acc[tier] = [];
      acc[tier].push(pkg);
      return acc;
    }, {} as Record<string, Package[]>);

  // Determine current tier status
  const currentTier = active?.package?.tier || (active?.package?.isFreePackage ? 'FREE' : null);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 py-5 space-y-8">
        {/* Super-Compact Header & Status Area */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-4">
          <div className="space-y-1 text-center md:text-left">
            <h1 className="text-2xl font-bold tracking-tight">Pricing Plans</h1>
            <p className="text-muted-foreground text-xs font-medium">Clear, simple pricing for your business.</p>
          </div>

          <div className="flex items-center gap-3">
            {active && (
              <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 bg-muted/40 rounded-lg border text-[11px] font-bold">
                <span className="text-muted-foreground uppercase tracking-tight">Active:</span>
                <span className="text-foreground">{active.package?.name}</span>
                {currentTier && <Badge variant="secondary" className="h-4 px-1.5 text-[9px] uppercase tracking-tighter">{currentTier}</Badge>}
                <div className="w-px h-3 bg-border mx-1" />
                <span className="flex items-center gap-1 text-primary"><Zap className="h-3 w-3" /> {active.phoneTxnsRemaining === -1 ? '∞' : active.phoneTxnsRemaining?.toLocaleString()} left</span>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={loadData} className="h-8 text-[11px] font-bold">
              <RefreshCcw className="h-3 w-3 mr-1.5" />
              Refresh
            </Button>
            {isAdmin && (
              <Button size="sm" onClick={() => { resetForm(); setShowCreateModal(true); }} className="h-8 text-[11px] font-bold bg-primary px-3">
                <Plus className="h-3 w-3 mr-1.5" />
                NEW
              </Button>
            )}
          </div>
        </div>

        {/* Categorized Tiered Sections */}
        <div className="space-y-12 pb-12">
          {[
            {
              name: 'Essential',
              description: 'Lightweight solutions for individual developers and testing.',
              color: 'text-slate-400',
              glow: 'hover:shadow-[0_0_25px_-5px_rgba(148,163,184,0.15)]',
              tiers: ['STARTER']
            },
            {
              name: 'Professional',
              description: 'Advanced features for growing teams needing reliability.',
              color: 'text-slate-900 dark:text-slate-100',
              glow: 'hover:shadow-[0_0_25px_-5px_rgba(15,23,42,0.1)]',
              tiers: ['PROFESSIONAL']
            },
            {
              name: 'Business',
              description: 'Standalone power for scaling commercial operations.',
              color: 'text-primary',
              glow: 'hover:shadow-[0_0_25px_-5px_rgba(243,113,0,0.2)]',
              tiers: ['BUSINESS']
            },
            {
              name: 'Enterprise',
              description: 'Bespoke high-volume packages with top-tier support.',
              color: 'text-rose-500',
              glow: 'hover:shadow-[0_0_25px_-5px_rgba(225,29,72,0.15)]',
              tiers: ['ENTERPRISE']
            }
          ].map((category) => {
            const categoryPackages = category.tiers.flatMap(tier => groupedPackages[tier] || []);
            if (categoryPackages.length === 0) return null;

            return (
              <div key={category.name} className="space-y-5">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 border-l-[4px] border-primary/30 pl-5 py-1">
                  <div className="space-y-0.5">
                    <h2 className={`text-lg font-black tracking-tight ${category.color} uppercase`}>{category.name}</h2>
                    <p className="text-muted-foreground text-xs font-medium max-w-md">{category.description}</p>
                  </div>
                  <div className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full">
                    {categoryPackages.length} available
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {categoryPackages.map((pkg) => {
                    const isCurrent = active?.package?.id === pkg.id;

                    return (
                      <div
                        key={pkg.id}
                        className={`relative group p-5 flex flex-col rounded-[20px] border transition-all duration-500 hover:-translate-y-1 bg-card ${category.glow} ${isCurrent ? 'ring-[3px] ring-primary border-transparent' : 'border-border/60'}`}
                      >
                        {isCurrent && (
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-[10px] text-white px-4 py-1 rounded-full font-black uppercase tracking-widest shadow-xl ring-4 ring-background">
                            Active
                          </div>
                        )}

                        <div className="mb-4 space-y-1">
                          <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${category.color} brightness-90`}>{pkg.tier}</span>
                          <h3 className="text-xl font-black truncate leading-tight tracking-tight">{pkg.name}</h3>
                        </div>

                        <div className="mb-4">
                          <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black tracking-tighter">{formatPrice(pkg.price)}</span>
                            {pkg.billingCycle && (
                              <span className="text-[10px] font-black text-muted-foreground/70 uppercase tracking-tighter">
                                /{formatBillingCycle(pkg.billingCycle)}
                              </span>
                            )}
                          </div>
                          <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground font-medium line-clamp-2 min-h-[2.5rem]">
                            {pkg.description || 'Enterprise-grade features and high-volume limits optimized for your business operations.'}
                          </p>
                        </div>

                        <div className="flex-1 space-y-2.5 mb-5">
                          <div className="flex items-center gap-3 text-[13px]">
                            <div className="h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Check className="h-2.5 w-2.5 text-primary" strokeWidth={4} />
                            </div>
                            <span className="font-semibold text-muted-foreground">
                              <span className="font-black text-foreground">{pkg.maxPhoneTxns === -1 ? 'Unlimited' : pkg.maxPhoneTxns?.toLocaleString()}</span> Phone TXNs
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[13px]">
                            <div className="h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Check className="h-2.5 w-2.5 text-primary" strokeWidth={4} />
                            </div>
                            <span className="font-semibold text-muted-foreground">
                              <span className="font-black text-foreground">{pkg.maxVerifiedTxns === -1 ? 'Unlimited' : pkg.maxVerifiedTxns?.toLocaleString()}</span> Verified TXNs
                            </span>
                          </div>
                          {pkg.employeeLimit !== undefined && pkg.employeeLimit !== null && (
                            <div className="flex items-center gap-3 text-[13px]">
                              <div className="h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <Check className="h-2.5 w-2.5 text-primary" strokeWidth={4} />
                              </div>
                              <span className="font-semibold text-muted-foreground">
                                <span className="font-black text-foreground">{pkg.employeeLimit === -1 ? 'Unlimited' : pkg.employeeLimit}</span> Employees
                              </span>
                            </div>
                          )}
                        </div>

                        {!isAdmin && (
                          <Button
                            disabled={isCurrent}
                            onClick={() => { setSelectedPackage(pkg); setPurchaseTransactionNumber(''); setShowPurchaseModal(true); }}
                            className={`w-full font-black text-[11px] uppercase tracking-widest h-10 rounded-xl transition-all ${isCurrent ? 'bg-muted text-muted-foreground cursor-default' : 'bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20 hover:shadow-primary/30 active:scale-[0.97]'}`}
                          >
                            {isCurrent ? 'Plan Active' : 'Start Now'}
                          </Button>
                        )}
                        {isAdmin && (
                          <Button variant="outline" className="w-full text-[10px] font-black h-10 rounded-xl border-2 uppercase tracking-widest" onClick={() => { /* Edit logic */ }}>
                            Edit Details
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer info: Free plan & Enterprise */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-8 pt-8 border-t border-dashed">
          <div className="flex items-center gap-4 text-sm max-w-xs">
            <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
              <Zap className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-bold">Free Plan Available</p>
              <p className="text-xs text-muted-foreground">Every user starts with {freePackage?.maxPhoneTxns?.toLocaleString()} free transactions.</p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm max-w-xs">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Plus className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-bold">Enterprise Needs?</p>
              <p className="text-xs text-muted-foreground">Contact our team for custom transaction limits and support.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Create Modal */}
      {showCreateModal && isAdmin && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Create Package</CardTitle>
              <CardDescription>Create a new pricing package</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="transactionLimit">Transaction Limit (-1 for unlimited)</Label>
                <Input
                  id="transactionLimit"
                  type="number"
                  value={formData.transactionLimit}
                  onChange={(e) => setFormData({ ...formData, transactionLimit: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="employeeLimit">Employee Limit (-1 for unlimited)</Label>
                <Input
                  id="employeeLimit"
                  type="number"
                  value={formData.employeeLimit}
                  onChange={(e) => setFormData({ ...formData, employeeLimit: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="price">Price</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="billingCycle">Billing Cycle</Label>
                <select
                  id="billingCycle"
                  className="w-full px-3 py-2 border rounded-md"
                  value={formData.billingCycle}
                  onChange={(e) => setFormData({ ...formData, billingCycle: e.target.value })}
                >
                  <option value="">Select</option>
                  <option value="ONE_TIME">One time</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="SIX_MONTH">Six Month</option>
                  <option value="YEARLY">Yearly</option>
                </select>
              </div>
              <div>
                <Label htmlFor="durationDays">Duration (days, for one-time)</Label>
                <Input
                  id="durationDays"
                  type="number"
                  value={formData.durationDays}
                  onChange={(e) => setFormData({ ...formData, durationDays: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="isDeveloperToken"
                  type="checkbox"
                  checked={formData.isDeveloperToken}
                  onChange={(e) => setFormData({ ...formData, isDeveloperToken: e.target.checked })}
                />
                <Label htmlFor="isDeveloperToken">Developer token</Label>
              </div>
              <div>
                <Label htmlFor="maxPhoneTxns">Phone TXNs quota (-1 for unlimited)</Label>
                <Input
                  id="maxPhoneTxns"
                  type="number"
                  value={formData.maxPhoneTxns}
                  onChange={(e) => setFormData({ ...formData, maxPhoneTxns: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="maxVerifiedTxns">Verified TXNs quota (-1 for unlimited)</Label>
                <Input
                  id="maxVerifiedTxns"
                  type="number"
                  value={formData.maxVerifiedTxns}
                  onChange={(e) => setFormData({ ...formData, maxVerifiedTxns: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleCreate}
                  className="bg-[#F37100] hover:bg-[#F37100]/90"
                >
                  Create
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Admin Assign Modal */}
      {showAssignModal && isAdmin && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Assign Package</CardTitle>
              <CardDescription>Assign a package to a business</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="assignBusiness">Business *</Label>
                <select
                  id="assignBusiness"
                  value={selectedBusinessId}
                  onChange={(e) => setSelectedBusinessId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Select a business</option>
                  {businesses.map((business) => (
                    <option key={business.id} value={business.id}>
                      {business.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="assignPackage">Package *</Label>
                <select
                  id="assignPackage"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Select a package</option>
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleAssign}
                  className="bg-[#F37100] hover:bg-[#F37100]/90"
                >
                  Assign
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAssignModal(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Purchase Modal */}
      {showPurchaseModal && selectedPackage && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Purchase Package</CardTitle>
              <CardDescription>
                Enter your payment transaction number to purchase <strong>{selectedPackage.name}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">{selectedPackage.name}</span>
                  <span className="text-lg font-bold">{formatPrice(selectedPackage.price)}</span>
                </div>
                {selectedPackage.description && (
                  <p className="text-sm text-muted-foreground">{selectedPackage.description}</p>
                )}
              </div>
              <div>
                <Label htmlFor="transactionNumber">Transaction Number *</Label>
                <Input
                  id="transactionNumber"
                  value={purchaseTransactionNumber}
                  onChange={(e) => setPurchaseTransactionNumber(e.target.value)}
                  placeholder="Enter transaction number from your payment"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  We will verify this transaction number and activate your package once confirmed.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handlePurchase}
                  disabled={purchasing}
                  className="bg-[#F37100] hover:bg-[#F37100]/90 flex-1"
                >
                  {purchasing ? 'Submitting...' : 'Submit Purchase'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowPurchaseModal(false);
                    setPurchaseTransactionNumber('');
                    setSelectedPackage(null);
                  }}
                  disabled={purchasing}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
}
