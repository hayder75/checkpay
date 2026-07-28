import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, X, Menu } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTheme } from '@/contexts/ThemeContext';
import GeometricBackground from '@/components/GeometricBackground';
import GeometricBgToggle from '@/components/GeometricBgToggle';
import { PiShieldCheck, PiCalendar, PiArrowClockwise, PiFileText, PiCheckCircle, PiPulse, PiComputerTower } from 'react-icons/pi';
import { useState } from 'react';

export default function ProductsPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme } = useTheme();
  const logoPath = theme === 'dark' ? '/dark-theme-logo.png' : '/light-theme-logo.png';

  const stats = [
    { value: '200ms', label: 'Average verification time' },
    { value: '30+', label: 'Countries & mobile networks' },
    { value: '99.9%', label: 'Uptime SLA' },
  ];

  const steps = [
    { icon: PiPulse, title: 'Customer pays', description: 'Customer sends bank transfer or mobile money. SMS alert arrives on the connected phone.' },
    { icon: PiComputerTower, title: 'Transaction captured', description: 'CheckPay Android app reads the SMS and pushes it to your project in real-time.' },
    { icon: PiShieldCheck, title: 'Your server verifies', description: 'Your backend calls GET /api/verify?txn=... with your project key. No customer-facing API exposure.' },
    { icon: PiCheckCircle, title: 'Instant result', description: 'Get confirmed amount, sender, bank, and timestamp. Match against your order and deliver value.' },
  ];

  const comingSoonProducts = [
    {
      title: 'Events',
      icon: PiCalendar,
      description: 'Ticketing with built-in payment verification. Sell, scan, reconcile.',
      timeline: 'Q2 2025',
    },
    {
      title: 'Subscriptions',
      icon: PiArrowClockwise,
      description: 'Recurring payment management for bank transfers and mobile money.',
      timeline: 'Q3 2025',
    },
    {
      title: 'Invoices',
      icon: PiFileText,
      description: 'Generate invoices, share payment links, auto-match when paid.',
      timeline: 'Q4 2025',
    },
  ];

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
            <Link to="/products" className="text-sm text-primary font-medium">Products</Link>
            <Link to="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
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
                <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-sm mt-2">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Products Hero + Card */}
      <section className="w-full px-4 sm:px-8 md:px-12 lg:px-16 pt-8 md:pt-10 pb-16 md:pb-20 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-primary/5 text-primary text-xs font-medium border border-primary/10 mb-4">
              PRODUCTS
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold leading-[1.1] tracking-tight mb-3">
              Build payments infrastructure <span className="text-muted-foreground">without being a bank</span>
            </h1>
            <p className="text-base md:text-lg text-muted-foreground max-w-2xl leading-relaxed">
              APIs and tools for verifying payments across Africa. No banking license required.
            </p>
          </div>

          <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
            <div className="grid lg:grid-cols-2">
              <div className="p-8 md:p-10 lg:p-12">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-medium mb-6">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  Live
                </div>
                <h2 className="text-3xl md:text-4xl font-heading font-bold tracking-tight mb-4">
                  Verify API
                </h2>
                <p className="text-base md:text-lg text-muted-foreground leading-relaxed mb-8">
                  Turn any SMS bank alert into verified transaction data. 
                  One API call tells you if a customer paid – amount, sender, 
                  timestamp, everything you need.
                </p>
                <div className="grid grid-cols-3 gap-3 mb-8">
                  {stats.map((stat) => (
                    <div key={stat.label} className="p-3 rounded-xl bg-muted/30 border border-border">
                      <div className="text-xl font-bold text-foreground">{stat.value}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link to="/auth/register">
                    <Button className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm px-6">
                      Start building
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </Link>
                  <Link to="/api-docs">
                    <Button variant="outline" className="border-border hover:bg-muted/50">
                      Documentation
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="bg-[#0D0D0D] p-6 md:p-8 lg:p-10 flex items-center">
                <div className="w-full">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
                    <span className="ml-3 text-neutral-500 text-[11px] font-mono">api/verify</span>
                  </div>
                  <pre className="text-xs font-mono leading-relaxed overflow-x-auto">
                    <code>
                      <span className="text-neutral-500">// Verify a payment</span>{'\n'}
                      <span className="text-purple-400">const</span> <span className="text-neutral-300">result</span> <span className="text-neutral-500">=</span> <span className="text-purple-400">await</span> <span className="text-blue-400">fetch</span><span className="text-neutral-500">(</span>{'\n'}
                      <span className="text-emerald-400">  'https://checkpay.live/api/verify'</span><span className="text-neutral-500">,</span>{'\n'}
                      <span className="text-neutral-500">  {'{'}</span>{'\n'}
                      <span className="text-neutral-300">    method</span><span className="text-neutral-500">:</span> <span className="text-emerald-400">'POST'</span><span className="text-neutral-500">,</span>{'\n'}
                      <span className="text-neutral-300">    headers</span><span className="text-neutral-500">:</span> <span className="text-neutral-500">{'{'}</span>{'\n'}
                      <span className="text-emerald-400">      'X-API-Key'</span><span className="text-neutral-500">:</span> <span className="text-neutral-300">apiKey</span>{'\n'}
                      <span className="text-neutral-500">    {'}'},</span>{'\n'}
                      <span className="text-neutral-300">    body</span><span className="text-neutral-500">:</span> <span className="text-neutral-300">JSON</span><span className="text-neutral-500">.</span><span className="text-blue-400">stringify</span><span className="text-neutral-500">({'{'}</span>{'\n'}
                      <span className="text-neutral-300">      transactionId</span><span className="text-neutral-500">:</span> <span className="text-emerald-400">'FT24...'</span>{'\n'}
                      <span className="text-neutral-500">    {'}'})</span>{'\n'}
                      <span className="text-neutral-500">  {'}'}</span>{'\n'}
                      <span className="text-neutral-500">);</span>{'\n'}
                      {'\n'}
                      <span className="text-neutral-500">// {'{'} verified: true, amount: 15000 {'}'}</span>
                    </code>
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Compact How It Works */}
      <div className="w-full px-4 sm:px-8 md:px-12 lg:px-16 py-8 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                      <span className="text-xs font-heading font-semibold truncate">{step.title}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-tight mt-0.5 line-clamp-2">{step.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Coming Soon */}
      <section className="w-full px-4 sm:px-8 md:px-12 lg:px-16 pb-24 md:pb-32 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/5 text-primary text-xs font-medium border border-primary/10 mb-4">
              COMING SOON
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold tracking-tight">
              What we're building next
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {comingSoonProducts.map((product, i) => {
              const Icon = product.icon;
              return (
                <div 
                  key={product.title} 
                  className="bg-card border border-border p-8 md:p-10 rounded-2xl hover:shadow-sm hover:border-primary/20 transition-all"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl md:text-2xl font-semibold mb-3">{product.title}</h3>
                  <p className="text-muted-foreground leading-relaxed mb-6">
                    {product.description}
                  </p>
                  <span className="text-sm text-muted-foreground/60">
                    {product.timeline}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="w-full px-4 sm:px-8 md:px-12 lg:px-16 pb-32 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">
            Ready to start?
          </h2>
          <p className="text-lg text-muted-foreground mb-10">
            Free tier available. No license required. 
            <br className="hidden sm:block" />
            15 minutes to your first verification.
          </p>
          <Link to="/auth/register">
            <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm px-10">
              Create free account
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

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
