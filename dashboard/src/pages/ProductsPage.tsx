import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, X, Menu, ChevronRight } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTheme } from '@/contexts/ThemeContext';
import GeometricBackground from '@/components/GeometricBackground';
import GeometricBgToggle from '@/components/GeometricBgToggle';
import { PiShieldCheck, PiCalendar, PiArrowClockwise, PiFileText, PiCheckCircle, PiPulse, PiComputerTower } from 'react-icons/pi';
import { useState } from 'react';

const stats = [
  { value: '200ms', label: 'Avg verification' },
  { value: '30+', label: 'Countries' },
  { value: '99.9%', label: 'Uptime SLA' },
];

const steps = [
  { icon: PiPulse, text: 'Customer pays via bank or mobile money' },
  { icon: PiComputerTower, text: 'SMS captured by CheckPay app' },
  { icon: PiShieldCheck, text: 'Your server calls verify API' },
  { icon: PiCheckCircle, text: 'Instant confirmation returned' },
];

const comingSoonProducts = [
  { title: 'Events', icon: PiCalendar, description: 'Ticketing with built-in verification', timeline: 'Q2 2025' },
  { title: 'Subscriptions', icon: PiArrowClockwise, description: 'Recurring payment management', timeline: 'Q3 2025' },
  { title: 'Invoices', icon: PiFileText, description: 'Generate, share, auto-match', timeline: 'Q4 2025' },
];

export default function ProductsPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme } = useTheme();
  const logoPath = theme === 'dark' ? '/dark-theme-logo.png' : '/light-theme-logo.png';

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors">
      <GeometricBackground />

      {/* Header */}
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

      {/* ─── ONE-PAGE PRODUCTS DASHBOARD ─── */}
      <div className="w-full px-4 sm:px-8 md:px-12 lg:px-16 pt-6 pb-8 relative z-10">

        {/* Hero — compact one-liner */}
        <div className="max-w-6xl mx-auto mb-6">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="px-2.5 py-1 rounded-md bg-primary/10 text-primary text-[11px] font-semibold border border-primary/20">PRODUCTS</span>
            <h1 className="text-lg sm:text-xl md:text-2xl font-heading font-bold text-foreground">
              Build payments infrastructure <span className="text-muted-foreground font-normal">without being a bank</span>
            </h1>
          </div>
        </div>

        {/* Main content grid: Verify API (left) + Coming Soon (right) */}
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_320px] gap-5 mb-5">

          {/* ─── Verify API Card ─── */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="p-5 md:p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-medium mb-2">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    Live
                  </div>
                  <h2 className="text-xl md:text-2xl font-heading font-bold">Verify API</h2>
                </div>
                <Link to="/auth/register">
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm text-xs h-8 px-4">
                    Start building <ArrowRight className="ml-1.5 w-3 h-3" />
                  </Button>
                </Link>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed mb-5 max-w-xl">
                Turn any SMS bank alert into verified transaction data — amount, sender, timestamp, everything you need. One API call.
              </p>

              {/* Stats row */}
              <div className="flex gap-3 mb-5">
                {stats.map(s => (
                  <div key={s.label} className="px-3 py-2 rounded-lg bg-muted/30 border border-border flex-1">
                    <div className="text-sm font-bold">{s.value}</div>
                    <div className="text-[10px] text-muted-foreground">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Inline code preview */}
              <div className="bg-[#0D0D0D] rounded-xl p-3 border border-border/50">
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-2 h-2 rounded-full bg-[#FF5F57]" />
                  <div className="w-2 h-2 rounded-full bg-[#FEBC2E]" />
                  <div className="w-2 h-2 rounded-full bg-[#28C840]" />
                  <span className="ml-2 text-neutral-500 text-[10px] font-mono">POST /api/verify</span>
                </div>
                <pre className="text-[10px] font-mono leading-relaxed text-neutral-300">
                  <code>{`fetch('https://checkpay.live/api/verify', {
  method: 'POST',
  headers: { 'X-API-Key': apiKey },
  body: JSON.stringify({ transactionId: 'FT24...' })
})`}</code>
                </pre>
              </div>

              {/* Steps — inline pill row */}
              <div className="flex flex-wrap gap-2 mt-4">
                {steps.map((step, i) => {
                  const Icon = step.icon;
                  return (
                    <div key={step.text} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/30 border border-border">
                      <Icon className="w-3 h-3 text-primary" />
                      <span className="text-[10px] text-muted-foreground">{step.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ─── Coming Soon Sidebar ─── */}
          <div className="space-y-3">
            <h3 className="text-[11px] font-heading font-semibold uppercase tracking-wider text-muted-foreground">Coming Soon</h3>
            {comingSoonProducts.map(p => {
              const Icon = p.icon;
              return (
                <div key={p.title} className="bg-card border border-border rounded-xl p-4 hover:shadow-sm hover:border-primary/20 transition-all">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <div className="text-sm font-heading font-semibold">{p.title}</div>
                      <span className="text-[10px] text-muted-foreground/60">{p.timeline}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{p.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── Bottom CTA bar ─── */}
        <div className="max-w-6xl mx-auto">
          <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border border-primary/20 rounded-xl px-6 py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-heading font-semibold">Ready to start?</p>
              <p className="text-xs text-muted-foreground">Free tier. No license. 15 minutes to your first verification.</p>
            </div>
            <Link to="/auth/register">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm text-xs h-8 px-5 whitespace-nowrap">
                Create free account <ChevronRight className="ml-1 w-3 h-3" />
              </Button>
            </Link>
          </div>
        </div>

      </div>

      {/* Footer */}
      <footer className="border-t border-border pt-10 md:pt-14 pb-10 md:pb-16 relative z-10">
        <div className="w-full px-4 sm:px-8 md:px-12 lg:px-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-2 md:col-span-1">
              <Link to="/">
                <img src={logoPath} alt="CheckPay Logo" className="h-8 md:h-10 w-auto object-contain mb-3" />
              </Link>
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
            <p>&copy; 2025 CheckPay. All rights reserved. Built for everybody, by developers.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
