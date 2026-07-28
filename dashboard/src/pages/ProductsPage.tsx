import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, X, Menu } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTheme } from '@/contexts/ThemeContext';
import GeometricBackground from '@/components/GeometricBackground';
import GeometricBgToggle from '@/components/GeometricBgToggle';
import { PiShieldCheck, PiCalendar, PiArrowClockwise, PiFileText, PiPulse, PiComputerTower, PiCheckCircle } from 'react-icons/pi';
import { useState } from 'react';

const products = [
  {
    title: 'Verify API',
    icon: PiShieldCheck,
    status: 'Live',
    statusColor: 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    dotColor: 'bg-emerald-500',
    description: 'Turn any SMS bank alert into verified transaction data. One API call returns amount, sender, bank, and timestamp.',
    features: ['200ms avg verification', '30+ countries covered', '99.9% uptime SLA'],
    cta: { label: 'Start building', href: '/auth/register' },
    secondaryCta: { label: 'Documentation', href: '/api-docs' },
  },
  {
    title: 'Events',
    icon: PiCalendar,
    status: 'Coming Soon',
    statusColor: 'bg-primary/10 text-primary',
    dotColor: 'bg-primary',
    description: 'Ticketing platform with built-in payment verification. Sell tickets, scan at entry, and reconcile automatically.',
    features: ['QR code check-in', 'Real-time verification', 'Sales analytics'],
    cta: { label: 'Get notified', href: '/auth/register' },
  },
  {
    title: 'Subscriptions',
    icon: PiArrowClockwise,
    status: 'Coming Soon',
    statusColor: 'bg-primary/10 text-primary',
    dotColor: 'bg-primary',
    description: 'Recurring payment management for bank transfers and mobile money. Automate billing without card infrastructure.',
    features: ['Auto-reconciliation', 'Payment reminders', 'Usage-based billing'],
    cta: { label: 'Get notified', href: '/auth/register' },
  },
  {
    title: 'Invoices',
    icon: PiFileText,
    status: 'Coming Soon',
    statusColor: 'bg-primary/10 text-primary',
    dotColor: 'bg-primary',
    description: 'Generate invoices, share payment links, and auto-match payments when they arrive. No manual reconciliation needed.',
    features: ['Payment links', 'Auto-matching', 'Multi-currency'],
    cta: { label: 'Get notified', href: '/auth/register' },
  },
];

const steps = [
  { icon: PiPulse, text: 'Customer sends payment' },
  { icon: PiComputerTower, text: 'SMS captured by our app' },
  { icon: PiShieldCheck, text: 'Your server verifies via API' },
  { icon: PiCheckCircle, text: 'Instant result returned' },
];

export default function ProductsPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme } = useTheme();
  const logoPath = theme === 'dark' ? '/dark-theme-logo.png' : '/light-theme-logo.png';

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors">
      <GeometricBackground />

      <header className="sticky top-0 z-[100] border-b border-border/50 bg-background/90">
        <div className="w-full px-4 sm:px-8 md:px-12 lg:px-16 py-3 md:py-4 flex items-center justify-between">
          <Link to="/">
            <img src={logoPath} alt="CheckPay Logo" className="h-8 md:h-10 w-auto object-contain flex-shrink-0" />
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/api-docs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Docs</Link>
            <Link to="/products" className="text-sm text-primary font-medium">Products</Link>
            <Link to="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
            <div className="w-px h-5 bg-border mx-2" />
            <GeometricBgToggle />
            <ThemeToggle />
            <Link to="/auth/login">
              <Button variant="ghost" size="sm" className="text-sm">Login</Button>
            </Link>
            <Link to="/auth/register">
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm text-sm px-5">Get Started</Button>
            </Link>
          </nav>
          <div className="flex md:hidden items-center gap-3">
            <ThemeToggle />
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-muted-foreground hover:text-foreground">
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
                <div className="px-4 py-3 text-sm text-primary font-medium rounded-lg hover:bg-muted/50 transition-colors">Products</div>
              </Link>
              <Link to="/pricing" onClick={() => setMobileMenuOpen(false)}>
                <div className="px-4 py-3 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors">Pricing</div>
              </Link>
              <div className="border-t border-border my-3" />
              <Link to="/auth/login" onClick={() => setMobileMenuOpen(false)}>
                <div className="px-4 py-3 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors">Login</div>
              </Link>
              <Link to="/auth/register" onClick={() => setMobileMenuOpen(false)}>
                <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-sm mt-2">Get Started</Button>
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="w-full px-4 sm:px-8 md:px-12 lg:px-16 pt-16 md:pt-20 pb-12 md:pb-16 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-heading font-bold tracking-tight mb-4">
            Our Products
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            APIs and tools for verifying payments across Africa. 
            <span className="block sm:inline"> No banking license required.</span>
          </p>
        </div>
      </section>

      {/* Product Grid */}
      <section className="w-full px-4 sm:px-8 md:px-12 lg:px-16 pb-16 md:pb-20 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {products.map((product) => {
              const Icon = product.icon;
              return (
                <div
                  key={product.title}
                  className="bg-card border border-border rounded-2xl p-6 flex flex-col hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${product.statusColor}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${product.dotColor} ${product.status === 'Live' ? 'animate-pulse' : ''}`} />
                      {product.status}
                    </span>
                  </div>

                  <h3 className="text-lg font-heading font-bold mb-2">{product.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-1">{product.description}</p>

                  <ul className="space-y-1.5 mb-6">
                    {product.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="w-1 h-1 rounded-full bg-primary/60" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <div className="space-y-2 mt-auto">
                    <Link to={product.cta.href} className="block">
                      <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm text-xs h-9">
                        {product.cta.label} <ArrowRight className="ml-1.5 w-3 h-3" />
                      </Button>
                    </Link>
                    {product.secondaryCta && (
                      <Link to={product.secondaryCta.href} className="block">
                        <Button variant="ghost" className="w-full text-xs h-8 text-muted-foreground hover:text-foreground">
                          {product.secondaryCta.label}
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="w-full px-4 sm:px-8 md:px-12 lg:px-16 pb-20 md:pb-28 relative z-10">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-center text-xs font-heading font-semibold uppercase tracking-widest text-muted-foreground mb-6">How it works</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.text} className="text-center p-4 rounded-xl bg-card border border-border">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-2">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="text-xs font-heading font-semibold mb-1">Step {i + 1}</div>
                  <p className="text-[11px] text-muted-foreground leading-tight">{step.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="w-full px-4 sm:px-8 md:px-12 lg:px-16 pb-32 relative z-10">
        <div className="max-w-3xl mx-auto text-center border border-border rounded-2xl p-8 md:p-12 bg-card shadow-sm">
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4 tracking-tight">Ready to start?</h2>
          <p className="text-muted-foreground mb-8">
            Free tier available. No license required. 15 minutes to your first verification.
          </p>
          <Link to="/auth/register">
            <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm px-10">
              Create free account <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border pt-10 md:pt-14 pb-10 md:pb-16 relative z-10">
        <div className="w-full px-4 sm:px-8 md:px-12 lg:px-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-2 md:col-span-1">
              <Link to="/"><img src={logoPath} alt="CheckPay Logo" className="h-8 md:h-10 w-auto object-contain mb-3" /></Link>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-[200px]">Universal payment verification for Africa</p>
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
            <p>&copy; 2025 CheckPay. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
