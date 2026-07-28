import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { packageAPI } from '@/lib';
import { Check, Zap, Plus, X, Menu } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTheme } from '@/contexts/ThemeContext';
import GeometricBackground from '@/components/GeometricBackground';
import GeometricBgToggle from '@/components/GeometricBgToggle';
import { useState, useEffect } from 'react';

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

export default function PricingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [packages, setPackages] = useState<Package[]>([]);
  const [billingMode, setBillingMode] = useState<'COUNT_BASED' | 'FIXED_PRICE'>('COUNT_BASED');
  const [loading, setLoading] = useState(true);
  const { theme } = useTheme();
  const logoPath = theme === 'dark' ? '/dark-theme-logo.png' : '/light-theme-logo.png';

  useEffect(() => {
    loadPackages();
  }, []);

  const loadPackages = async () => {
    try {
      const [packageRes, modeRes] = await Promise.all([
        packageAPI.getAll(),
        packageAPI.getBillingMode(),
      ]);
      setPackages(packageRes.data.data || []);
      setBillingMode(modeRes.data?.data?.billingMode || packageRes.data?.meta?.billingMode || 'COUNT_BASED');
    } catch (error) {
      console.error('Failed to load packages:', error);
    } finally {
      setLoading(false);
    }
  };

  const isFixedPriceMode = billingMode === 'FIXED_PRICE';

  const isVisibleForMode = (pkg: Package): boolean => {
    if (!pkg.isActive || pkg.isFreePackage) return false;

    if (isFixedPriceMode) {
      return ['MONTHLY', 'SIX_MONTH', 'YEARLY'].includes(pkg.billingCycle || '') && !!pkg.price;
    }

    return pkg.maxPhoneTxns !== undefined || pkg.maxVerifiedTxns !== undefined;
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

  const freePackage = packages.find(pkg => pkg.isFreePackage);

  // Group non-free, active packages by tier
  const groupedPackages = packages
    .filter(isVisibleForMode)
    .reduce((acc, pkg) => {
      const tier = pkg.tier || 'OTHER';
      if (!acc[tier]) acc[tier] = [];
      acc[tier].push(pkg);
      return acc;
    }, {} as Record<string, Package[]>);

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors">
      <GeometricBackground />

      {/* Header */}
      <header className="sticky top-0 z-[100] border-b border-border/50 bg-background/90">
        <div className="w-full px-4 sm:px-8 md:px-12 lg:px-16 py-3 md:py-4 flex items-center justify-between">
          <Link to="/">
            <img
              src={logoPath}
              alt="CheckPay Logo"
              className="h-8 md:h-10 w-auto object-contain flex-shrink-0"
            />
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/api-docs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Docs</Link>
            <Link to="/products" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Products</Link>
            <Link to="/pricing" className="text-sm text-primary font-medium">Pricing</Link>
            <div className="w-px h-5 bg-border mx-2" />
            <GeometricBgToggle />
            <ThemeToggle />
            <Link to="/auth/login">
              <Button variant="ghost" size="sm" className="text-sm">Login</Button>
            </Link>
            <Link to="/auth/register">
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm text-sm px-5">
                Get Started
              </Button>
            </Link>
          </nav>
          <div className="flex md:hidden items-center gap-3">
            <ThemeToggle />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-muted-foreground hover:text-foreground"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-background">
            <div className="w-full px-4 sm:px-8 py-5 space-y-3">
              <Link to="/api-docs" onClick={() => setMobileMenuOpen(false)}>
                <div className="px-4 py-3 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors">Docs</div>
              </Link>
              <Link to="/products" onClick={() => setMobileMenuOpen(false)}>
                <div className="px-4 py-3 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors">Products</div>
              </Link>
              <Link to="/pricing" onClick={() => setMobileMenuOpen(false)}>
                <div className="px-4 py-3 text-sm text-primary font-medium rounded-lg hover:bg-muted/50 transition-colors">Pricing</div>
              </Link>
              <div className="border-t border-border my-3" />
              <Link to="/auth/login" onClick={() => setMobileMenuOpen(false)}>
                <div className="px-4 py-3 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors">Login</div>
              </Link>
              <Link to="/auth/register" onClick={() => setMobileMenuOpen(false)}>
                <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-sm mt-2">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="w-full px-4 sm:px-8 md:px-12 lg:px-16 py-8 md:py-12 space-y-8 relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-4">
          <div className="space-y-1 text-center md:text-left">
            <h1 className="text-2xl font-bold tracking-tight">Pricing Plans</h1>
            <p className="text-muted-foreground text-xs font-medium">Clear, simple pricing for your business.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-[40vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
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
                      {categoryPackages.map((pkg) => (
                        <div
                          key={pkg.id}
                          className={`relative group p-5 flex flex-col rounded-[20px] border transition-all duration-500 hover:-translate-y-1 bg-card ${category.glow} border-border`}
                        >
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
                            {isFixedPriceMode ? (
                              <div className="flex items-center gap-3 text-[13px]">
                                <div className="h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                  <Check className="h-2.5 w-2.5 text-primary" strokeWidth={4} />
                                </div>
                                <span className="font-semibold text-muted-foreground">
                                  <span className="font-black text-foreground">Unlimited</span> Transactions While Active
                                </span>
                              </div>
                            ) : (
                              <>
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
                              </>
                            )}
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

                          <Link to="/auth/register">
                            <Button
                              className="w-full font-black text-[11px] uppercase tracking-widest h-10 rounded-xl transition-all bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20 hover:shadow-primary/30 active:scale-[0.97]"
                            >
                              Get Started
                            </Button>
                          </Link>
                        </div>
                      ))}
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
                  <p className="font-bold">Free First Month</p>
                  <p className="text-xs text-muted-foreground">
                    {isFixedPriceMode
                      ? 'Every user starts with one free month, then chooses a paid duration package.'
                      : `Every user starts with ${freePackage?.maxPhoneTxns?.toLocaleString() || '100'} free transactions.`}
                  </p>
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
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border pt-10 md:pt-14 pb-10 md:pb-16 relative z-10">
        <div className="w-full px-4 sm:px-8 md:px-12 lg:px-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-2 md:col-span-1">
              <Link to="/">
                <img
                  src={logoPath}
                  alt="CheckPay Logo"
                  className="h-8 md:h-10 w-auto object-contain mb-3"
                />
              </Link>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-[200px]">
                Universal payment verification for Africa
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-3">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/products" className="hover:text-foreground transition-colors">All Products</Link></li>
                <li><Link to="/api-docs" className="hover:text-foreground transition-colors">Documentation</Link></li>
                <li><Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-3">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">About</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Blog</a></li>
                <li><a href="mailto:hello@checkpay.africa" className="hover:text-foreground transition-colors">Contact Us</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-3">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Terms</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Security</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-6 text-center text-sm text-muted-foreground">
            <p>&copy; 2025 CheckPay. All rights reserved. Built for everybody, by developers.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
