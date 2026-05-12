import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { packageAPI, userPackageAPI } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { Crown, Check, RefreshCw, ShoppingCart, Zap, Star, ArrowRight } from 'lucide-react';

interface Package {
  id: string;
  name: string;
  description?: string;
  price?: number | string | null;
  billingCycle?: string;
  durationDays?: number | null;
  maxPhoneTxns?: number | null;
  maxVerifiedTxns?: number | null;
  isDeveloperToken?: boolean;
  isFreePackage?: boolean;
  tier?: string;
  isActive?: boolean;
}

const tierColors: Record<string, string> = {
  FREE: "bg-gray-500",
  STARTER: "bg-blue-500",
  PROFESSIONAL: "bg-green-500",
  BUSINESS: "bg-purple-500",
  ENTERPRISE: "bg-orange-500",
};

export default function PremiumPage() {
  const { toast } = useToast();
  const [packages, setPackages] = useState<Package[]>([]);
  const [billingMode, setBillingMode] = useState<'COUNT_BASED' | 'FIXED_PRICE'>('COUNT_BASED');
  const [active, setActive] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [purchaseNumber, setPurchaseNumber] = useState('');
  const [purchasing, setPurchasing] = useState(false);

  const loadData = async () => {
    try {
      const [pkgRes, activeRes, modeRes] = await Promise.all([
        packageAPI.getAll(),
        userPackageAPI.getMyPackage(),
        packageAPI.getBillingMode(),
      ]);
      setPackages(pkgRes.data.data || []);
      setBillingMode(modeRes.data?.data?.billingMode || pkgRes.data?.meta?.billingMode || 'COUNT_BASED');
      setActive(activeRes.data.data);
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to load packages", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const isFixedPriceMode = billingMode === 'FIXED_PRICE';
  const visiblePackages = packages.filter((pkg) => {
    if (!pkg.isActive || pkg.isFreePackage) return false;
    if (isFixedPriceMode) {
      return ['MONTHLY', 'SIX_MONTH', 'YEARLY'].includes(pkg.billingCycle || '') && !!pkg.price;
    }
    return pkg.maxPhoneTxns !== undefined || pkg.maxVerifiedTxns !== undefined;
  });

  const handlePurchase = async () => {
    if (!selectedPackage || !purchaseNumber) {
      toast({ title: "Error", description: "Please select a package and enter transaction number", variant: "destructive" });
      return;
    }
    setPurchasing(true);
    try {
      const res = await packageAPI.purchase({ packageId: selectedPackage.id, transactionNumber: purchaseNumber });
      toast({ title: "Success", description: res.data.message || "Package purchased successfully" });
      loadData();
      setSelectedPackage(null);
      setPurchaseNumber('');
    } catch (error: any) {
      toast({ title: "Error", description: error.response?.data?.error || "Failed to purchase package", variant: "destructive" });
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
              <Crown className="h-7 w-7 text-primary" />
              Premium Plans
            </h1>
            <p className="text-muted-foreground mt-1">
              Upgrade your account to unlock more features
            </p>
          </div>
        </div>

        <Separator />

        {/* Current Plan */}
        {active && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Current Plan</p>
                  <p className="text-2xl font-bold">{active.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {active.tier} • {active.billingCycle || 'Active'}
                  </p>
                </div>
                <div className="flex gap-3">
                  {isFixedPriceMode ? (
                    <Badge variant="secondary" className="text-sm px-3 py-1">Unlimited Transactions</Badge>
                  ) : (
                    <>
                      <Badge variant="secondary" className="text-sm px-3 py-1">
                        {active.maxPhoneTxns ? `${active.maxPhoneTxns} Phone Tokens` : 'Unlimited'}
                      </Badge>
                      <Badge variant="secondary" className="text-sm px-3 py-1">
                        {active.maxVerifiedTxns ? `${active.maxVerifiedTxns} Verified` : 'Unlimited'}
                      </Badge>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Package Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {visiblePackages.map((pkg) => {
            const isCurrentPlan = active?.id === pkg.id;
            return (
              <Card 
                key={pkg.id} 
                className={`relative ${isCurrentPlan ? 'border-primary' : ''}`}
              >
                {pkg.tier === 'BUSINESS' && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">
                      <Star className="h-3 w-3 mr-1" />
                      Most Popular
                    </Badge>
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {pkg.name}
                    {pkg.tier && (
                      <span className={`text-xs px-2 py-1 rounded-full text-white ${tierColors[pkg.tier]}`}>
                        {pkg.tier}
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription>{pkg.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-3xl font-bold">
                    {pkg.price === 0 || pkg.price === '0' || !pkg.price ? (
                      <span className="text-2xl">Free</span>
                    ) : (
                      <>${pkg.price}<span className="text-sm font-normal text-muted-foreground">/{pkg.billingCycle?.toLowerCase() || 'mo'}</span></>
                    )}
                  </div>
                  <div className="space-y-2">
                    {isFixedPriceMode ? (
                      <div className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500" />
                        <span>Unlimited transactions while package is active</span>
                      </div>
                    ) : (
                      [
                        { label: 'Phone Transactions', value: pkg.maxPhoneTxns },
                        { label: 'Verified Transactions', value: pkg.maxVerifiedTxns },
                        { label: 'Developer API Access', value: pkg.isDeveloperToken },
                      ].map((feature, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>
                            {feature.value === null || feature.value ? (
                              feature.value || 'Unlimited'
                            ) : (
                              <span className="text-muted-foreground">Limited</span>
                            )}{' '}
                            {feature.label}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                  <Button 
                    className="w-full" 
                    variant={isCurrentPlan ? "outline" : "default"}
                    disabled={isCurrentPlan}
                    onClick={() => setSelectedPackage(pkg)}
                  >
                    {isCurrentPlan ? (
                      'Current Plan'
                    ) : (
                      <>
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        Select Plan
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Purchase Modal */}
        {selectedPackage && (
          <Card className="fixed inset-0 z-50 m-auto max-w-md p-6 shadow-2xl">
            <CardHeader>
              <CardTitle>Purchase {selectedPackage.name}</CardTitle>
              <CardDescription>
                Make a payment to activate this plan
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Transaction Number</Label>
                <Input
                  placeholder="Enter your payment transaction number"
                  value={purchaseNumber}
                  onChange={(e) => setPurchaseNumber(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setSelectedPackage(null)}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handlePurchase} disabled={purchasing}>
                  {purchasing ? 'Processing...' : 'Confirm Purchase'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}