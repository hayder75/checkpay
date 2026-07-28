import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  Play,
  X,
  Menu,
  Download
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import GeometricBackground from '@/components/GeometricBackground';
import GeometricBgToggle from '@/components/GeometricBgToggle';
import { PiShieldCheck, PiCheckCircle, PiDeviceMobile, PiScan, PiDatabase } from 'react-icons/pi';
import { useTheme } from '@/contexts/ThemeContext';
import { useEffect, useState } from 'react';
import GlobalPatternMap from '@/components/GlobalPatternMap';

export default function LandingPage() {
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme } = useTheme();
  const logoPath = theme === 'dark' ? '/dark-theme-logo.png' : '/light-theme-logo.png';

  useEffect(() => {
    let lenis: any;
    import('lenis').then(({ default: Lenis }) => {
      lenis = new Lenis({ autoRaf: true });
    });
    return () => {
      if (lenis) lenis.destroy();
    };
  }, []);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-background relative">
      <GeometricBackground />

      {/* Header */}
      <header className="sticky top-0 z-[100] border-b border-border/50 bg-background/90">
        <div className="w-full px-4 sm:px-8 md:px-12 lg:px-16 py-3 md:py-4 flex items-center justify-between">
          <img
            src={logoPath}
            alt="CheckPay Logo"
            className="h-8 md:h-10 w-auto object-contain flex-shrink-0"
          />
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/api-docs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Docs</Link>
            <Link to="/products" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Products</Link>
            <Link to="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
            <button
              onClick={() => scrollToSection('mobile-app')}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </button>
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
              {[
                { label: 'Docs', to: '/api-docs' },
                { label: 'Products', to: '/products' },
                { label: 'Pricing', to: '/pricing' },
              ].map((item) => (
                <Link key={item.label} to={item.to} onClick={() => setMobileMenuOpen(false)}>
                  <div className="px-4 py-3 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors">{item.label}</div>
                </Link>
              ))}
              <button
                onClick={() => { scrollToSection('mobile-app'); setMobileMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
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

      {/* Hero Section */}
      <section className="w-full px-4 sm:px-8 md:px-12 lg:px-16 py-12 md:py-20 lg:py-28 relative z-10">
        <div className="mx-auto max-w-[1400px] grid gap-8 md:gap-10 xl:gap-14 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] items-start">
          <div className="space-y-5 md:space-y-6">
            <p className="text-sm font-heading font-medium text-primary/80 tracking-wider">
              The simplest way to verify payments across Africa
            </p>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-heading font-bold leading-[1.1] tracking-tight">
              The API to verify payments
              <span className="text-primary"> across every bank and mobile money</span>
            </h1>
            <p className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-2xl leading-relaxed font-heading">
              Turn raw SMS receipts into clean, structured payment data.
              Power dashboards, risk engines and reconciliation with a single,
              unified verification API.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link to="/auth/register">
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm text-base px-7 py-5 w-full sm:w-auto">
                  Start Building Free
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
              <Button
                size="lg"
                variant="outline"
                className="border-border text-sm md:text-base px-6 py-5 w-full sm:w-auto"
                onClick={() => document.getElementById('product-demo')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                <Play className="mr-2 w-4 h-4" />
                Watch demo
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:text-sm text-muted-foreground pt-2">
              <span className="flex items-center gap-1.5">
                <PiShieldCheck className="w-4 h-4 text-primary" />
                Bank-grade security
              </span>
              <span className="flex items-center gap-1.5">
                <PiCheckCircle className="w-4 h-4 text-primary" />
                Sub-100ms verification
              </span>
              <span className="flex items-center gap-1.5">
                <PiDeviceMobile className="w-4 h-4 text-primary" />
                30+ countries covered
              </span>
            </div>
          </div>

          {/* API Console Card */}
          <div className="hidden md:block relative w-full min-w-0">
            <div className="rounded-2xl border border-border bg-card shadow-lg">
              <div className="border-b border-border px-4 md:px-5 py-3 md:py-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] md:text-xs text-muted-foreground truncate">
                  <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                  <span className="font-mono truncate">checkpay-api &middot; live</span>
                </div>
                <div className="flex items-center gap-2 text-[9px] md:text-[10px] flex-shrink-0">
                  <span className="rounded-md bg-primary/5 text-primary px-2 py-0.5 border border-primary/10 font-medium">VERIFIED</span>
                  <span className="rounded-md bg-muted text-muted-foreground px-2 py-0.5 border border-border">PCI-aware</span>
                </div>
              </div>
              <div className="p-4 md:p-5 space-y-3 md:space-y-4">
                <div className="flex items-center justify-between text-[10px] md:text-xs text-muted-foreground">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="rounded-md bg-primary/5 text-primary px-2 py-0.5 border border-primary/10 font-mono text-[9px] md:text-[10px] flex-shrink-0">POST</span>
                    <span className="font-mono text-foreground truncate">/v1/transactions/verify</span>
                  </div>
                  <span className="font-mono text-primary flex-shrink-0">98ms &middot; 200 OK</span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 md:gap-3 font-mono text-[10px] md:text-xs">
                  <div className="rounded-lg border border-border bg-muted/30 p-3 md:p-3.5 space-y-2 min-w-0">
                    <div className="flex items-center justify-between text-muted-foreground text-[9px] md:text-[10px]">
                      <span>Request body</span>
                      <span className="bg-background px-1.5 py-0.5 rounded border border-border text-[8px] md:text-[9px]">JSON</span>
                    </div>
                    <pre className="whitespace-pre-wrap break-all">{`{
  "sms": "Confirmed. ETB 1,500...",
  "reference": "FT1234A89",
  "source": "CBE"
}`}</pre>
                  </div>
                  <div className="rounded-lg border border-primary/20 bg-primary/[0.02] p-3 md:p-3.5 space-y-2 min-w-0">
                    <div className="flex items-center justify-between text-muted-foreground text-[9px] md:text-[10px]">
                      <span>Normalized response</span>
                      <span className="bg-primary/5 text-primary px-1.5 py-0.5 rounded border border-primary/10 text-[8px] md:text-[9px]">VERIFIED</span>
                    </div>
                    <pre className="whitespace-pre-wrap break-all">{`{
  "amount": 1500,
  "currency": "ETB",
  "direction": "IN",
  "sender_name": "John Doe",
  "timestamp": "2025-01-04T12:03:18Z"
}`}</pre>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px] md:text-xs text-muted-foreground pt-1">
                  <span>SDKs for Node, Python, PHP &amp; more</span>
                  <Link to="/api-docs" className="text-primary hover:text-primary/80 font-medium inline-flex items-center gap-1 flex-shrink-0">
                    View API docs <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
                <div className="pt-3 border-t border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[8px] md:text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Quick Integration</span>
                    <span className="text-[8px] md:text-[9px] font-mono text-primary/60">javascript</span>
                  </div>
                  <pre className="text-[9px] md:text-[10px] font-mono bg-muted/30 p-2.5 md:p-3 rounded-lg border border-border leading-relaxed overflow-x-auto">{`const res = await fetch('api.checkpay.africa/v1/verify', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer KEY' },
  body: JSON.stringify({ sms: "..." })
});`}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Global Pattern Map */}
      <div className="hidden md:block mb-8 md:mb-16">
        <GlobalPatternMap />
      </div>

      {/* Product Demo */}
      <section id="product-demo" className="w-full px-4 sm:px-8 md:px-12 lg:px-16 py-16 md:py-24 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8 md:mb-12 text-center max-w-3xl mx-auto">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 md:mb-4 leading-tight tracking-tight">
              See CheckPay in action
            </h2>
            <p className="text-sm md:text-base lg:text-lg text-muted-foreground leading-relaxed">
              Follow a real-world flow from SMS receipt to verified transaction.
            </p>
          </div>
          <div className="max-w-5xl mx-auto">
            <div className="rounded-2xl overflow-hidden border border-border bg-card shadow-lg">
              <div className="aspect-[16/10] bg-muted/20 relative">
                <video
                  className="w-full h-full object-contain"
                  controls
                  preload="metadata"
                  onLoadedData={() => setVideoLoaded(true)}
                  onError={() => setVideoLoaded(false)}
                >
                  <source src="/videos/product-demo.mp4" type="video/mp4" />
                  <source src="/videos/product-demo.webm" type="video/webm" />
                </video>
                {!videoLoaded && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/10">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <Play className="w-8 h-8 text-primary" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="hidden md:grid grid-cols-3 gap-6 max-w-4xl mx-auto mt-10 text-sm text-muted-foreground">
            <div className="flex gap-3 items-start">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
              <span>Watch raw SMS turn into a normalized, bank-grade transaction object.</span>
            </div>
            <div className="flex gap-3 items-start">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
              <span>See how projects, environments and webhooks fit together.</span>
            </div>
            <div className="flex gap-3 items-start">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
              <span>Walk through a typical integration from sandbox to production.</span>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="w-full px-4 sm:px-8 md:px-12 lg:px-16 py-16 md:py-24 relative z-10">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 tracking-tight">
              Simple Integration
            </h2>
            <p className="text-sm md:text-base lg:text-lg text-muted-foreground">
              Get started in three easy steps
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-10 md:gap-12">
            {[
              { step: '01', title: 'Sign Up & Get API Key', description: 'Create your free account and get instant API access. No license required.' },
              { step: '02', title: 'Define Your Patterns', description: 'Use our pattern builder to create custom SMS parsers for any bank or mobile money provider.' },
              { step: '03', title: 'Verify & Automate', description: 'Send SMS or scan receipts. Get structured data back and automate your workflows.' },
            ].map((step, i) => (
              <div key={i} className="relative">
                <div className="text-5xl md:text-6xl lg:text-7xl font-bold text-primary/20 mb-3 md:mb-4 leading-none">{step.step}</div>
                <h3 className="text-lg sm:text-xl md:text-2xl font-bold mb-2 md:mb-3">{step.title}</h3>
                <p className="text-sm md:text-base text-muted-foreground leading-relaxed">{step.description}</p>
                {i < 2 && (
                  <ArrowRight className="hidden md:block absolute top-10 -right-8 w-5 h-5 text-muted-foreground/30" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mobile App */}
      <section id="mobile-app" className="w-full px-4 sm:px-8 md:px-12 lg:px-16 py-16 md:py-24 relative z-10">
        <div className="max-w-7xl mx-auto grid gap-12 md:grid-cols-2 items-center">
          <div className="space-y-6 order-2 md:order-1">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/5 text-primary text-xs font-medium border border-primary/10">
              <PiDeviceMobile className="w-3.5 h-3.5" />
              <span>Available on Android</span>
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight tracking-tight">
              Verify Payments
              <br />
              <span className="text-primary">On The Go</span>
            </h2>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
              Download the CheckPay mobile app to automatically capture SMS transactions
              and scan physical receipts. Perfect for businesses that need real-time verification.
            </p>
            <div className="space-y-3">
              <p className="text-sm font-semibold">Perfect for:</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {["Cashiers & Shop Keepers", "Retail Store Managers", "Mobile Money Agents", "Field Sales Representatives", "Delivery Personnel", "Market Vendors"].map((agent, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="w-1 h-1 rounded-full bg-primary flex-shrink-0" />
                    <span>{agent}</span>
                  </div>
                ))}
              </div>
            </div>
            <ul className="space-y-3 pt-2">
              {[
                { icon: PiScan, text: "OCR scanning for paper receipts & bank slips" },
                { icon: PiDatabase, text: "Auto-sync SMS transactions to your dashboard" },
                { icon: PiShieldCheck, text: "Secure & encrypted data transfer" }
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
                  <div className="p-1.5 rounded-md bg-muted">
                    <item.icon className="w-4 h-4 text-primary" />
                  </div>
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
            <div className="pt-2">
              <Link to="/auth/register">
                <Button variant="outline" className="border-border gap-2">
                  <PiDeviceMobile className="w-4 h-4 text-primary" />
                  Download App
                </Button>
              </Link>
            </div>
          </div>
          <div className="relative order-1 md:order-2">
            <div className="relative rounded-[2.5rem] border-4 border-border bg-card p-1 shadow-lg overflow-hidden aspect-[9/19.5] max-w-[280px] mx-auto">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-5 bg-border rounded-b-2xl z-20" />
              <img
                src="/m.png"
                alt="CheckPay Merchant App"
                className="rounded-[2rem] w-full h-full object-cover"
              />
            </div>
            <div className="absolute -bottom-4 -right-4 md:-right-8 bg-card border border-border p-3.5 rounded-xl shadow-lg z-30 hidden sm:block">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <PiScan className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold">OCR Active</p>
                  <p className="text-[10px] text-muted-foreground">Processing receipt...</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="w-full px-4 sm:px-8 md:px-12 lg:px-16 py-16 md:py-24 relative z-10">
        <div className="max-w-3xl mx-auto text-center border border-border rounded-2xl p-8 md:p-12 bg-card shadow-sm">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 tracking-tight">
            Ready to get started?
          </h2>
          <p className="text-sm md:text-base lg:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-8">
            Join developers across Africa who trust CheckPay for payment verification.
            <span className="block mt-1 font-semibold text-foreground">
              No license fees. No hidden costs. Just simple, powerful verification.
            </span>
          </p>
          <Link to="/auth/register">
            <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm text-base px-8 py-5 md:py-6 w-full sm:w-auto">
              Create Free Account
              <ArrowRight className="ml-2 w-4 h-4 md:w-5 md:h-5" />
            </Button>
          </Link>
          <p className="mt-3 text-xs md:text-sm text-muted-foreground">
            Free forever. Upgrade as you grow.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border pt-10 md:pt-14 pb-10 md:pb-16 mt-8 relative z-10">
        <div className="w-full px-4 sm:px-8 md:px-12 lg:px-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-2 md:col-span-1">
              <img
                src={logoPath}
                alt="CheckPay Logo"
                className="h-8 md:h-10 w-auto min-w-[80px] md:min-w-[100px] object-contain mb-3"
              />
              <p className="text-sm text-muted-foreground leading-relaxed max-w-[200px]">
                Universal payment verification for Africa
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-3">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/products" className="hover:text-foreground transition-colors">All Products</Link></li>
                <li><Link to="/api-docs" className="hover:text-foreground transition-colors">Documentation</Link></li>
                <li><Link to="/auth/register" className="hover:text-foreground transition-colors">Get Started</Link></li>
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
                <li><Link to="/privacy-policy" className="hover:text-foreground transition-colors">Privacy</Link></li>
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
