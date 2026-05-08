import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, X, Menu } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTheme } from '@/contexts/ThemeContext';
import { useState } from 'react';

export default function ProductsPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme } = useTheme();
  const logoPath = theme === 'dark' ? '/dark-theme-logo.png' : '/light-theme-logo.png';

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#0A0A0A] text-neutral-900 dark:text-neutral-100 transition-colors">
      {/* Header */}
      <header className="sticky top-0 z-[100] border-b border-neutral-200 dark:border-neutral-800/50 bg-neutral-50/80 dark:bg-[#0A0A0A]/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-3 md:py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img
              src={logoPath}
              alt="CheckPay Logo"
              className="h-8 md:h-12 w-auto min-w-[100px] md:min-w-[120px] object-contain"
            />
          </Link>
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            <Link to="/api-docs">
              <Button variant="ghost" size="sm" className="text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white">Docs</Button>
            </Link>
            <Link to="/products">
              <Button variant="ghost" size="sm" className="text-orange-600 dark:text-orange-400">Products</Button>
            </Link>
            <Link to="/pricing">
              <Button variant="ghost" size="sm" className="text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white">Pricing</Button>
            </Link>
            <div className="w-px h-6 bg-neutral-200 dark:bg-neutral-800 mx-2" />
            <ThemeToggle />
            <Link to="/auth/login">
              <Button variant="ghost" size="sm" className="text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white">Login</Button>
            </Link>
            <Link to="/auth/register">
              <Button size="sm" className="bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100">
                Get Started
              </Button>
            </Link>
          </div>
          {/* Mobile Navigation */}
          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-neutral-200 dark:border-neutral-800/50 bg-neutral-50/95 dark:bg-[#0A0A0A]/95 backdrop-blur-xl">
            <div className="container mx-auto px-4 py-4 space-y-2">
              <Link to="/api-docs" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" className="w-full justify-start">Docs</Button>
              </Link>
              <Link to="/products" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" className="w-full justify-start text-orange-600 dark:text-orange-400">Products</Button>
              </Link>
              <Link to="/pricing" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" className="w-full justify-start">Pricing</Button>
              </Link>
              <Link to="/auth/login" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" className="w-full justify-start">Login</Button>
              </Link>
              <Link to="/auth/register" onClick={() => setMobileMenuOpen(false)}>
                <Button className="w-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Gradient orb */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-to-b from-orange-500/20 via-orange-500/5 to-transparent dark:from-orange-500/10 dark:via-orange-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="container mx-auto px-4 pt-24 md:pt-32 pb-20 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-orange-600 dark:text-orange-400 font-medium mb-6 tracking-wide text-sm">
              PRODUCTS
            </p>
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold leading-[1.05] tracking-tight mb-8">
              Build payments
              <br />
              <span className="text-neutral-400 dark:text-neutral-600">without the bank</span>
            </h1>
            <p className="text-xl text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto leading-relaxed">
              APIs and tools for verifying payments across Africa. 
              No banking license required.
            </p>
          </div>
        </div>
      </section>

      {/* Main Product */}
      <section className="container mx-auto px-4 pb-32">
        <div className="max-w-6xl mx-auto">
          {/* Product Card */}
          <div className="relative">
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-amber-500/20 dark:from-orange-500/10 dark:to-amber-500/10 rounded-3xl blur-2xl opacity-50" />
            
            <div className="relative bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden">
              <div className="grid lg:grid-cols-2">
                {/* Left - Info */}
                <div className="p-10 md:p-14 lg:p-16">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-medium mb-8">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    Live
                  </div>
                  
                  <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
                    Verify API
                  </h2>
                  
                  <p className="text-lg text-neutral-600 dark:text-neutral-400 leading-relaxed mb-10">
                    Turn any SMS bank alert into verified transaction data. 
                    One API call tells you if a customer paid – amount, sender, 
                    timestamp, everything you need.
                  </p>

                  <div className="space-y-5 mb-12">
                    {[
                      ['200ms', 'Average verification time'],
                      ['30+', 'Countries & mobile networks'],
                      ['99.9%', 'Uptime SLA'],
                    ].map(([stat, label]) => (
                      <div key={label} className="flex items-baseline gap-4">
                        <span className="text-2xl font-bold text-neutral-900 dark:text-white w-20">{stat}</span>
                        <span className="text-neutral-500 dark:text-neutral-500">{label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-4">
                    <Link to="/auth/register">
                      <Button size="lg" className="bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 px-8">
                        Start building
                        <ArrowRight className="ml-2 w-4 h-4" />
                      </Button>
                    </Link>
                    <Link to="/api-docs">
                      <Button size="lg" variant="outline" className="border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                        Documentation
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Right - Code */}
                <div className="bg-[#0D0D0D] p-8 md:p-10 lg:p-12 flex items-center">
                  <div className="w-full">
                    <div className="flex items-center gap-2 mb-6">
                      <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                      <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
                      <div className="w-3 h-3 rounded-full bg-[#28C840]" />
                      <span className="ml-4 text-neutral-500 text-xs font-mono">api/verify</span>
                    </div>
                    <pre className="text-sm font-mono leading-relaxed overflow-x-auto">
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
        </div>
      </section>

      {/* Divider */}
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto border-t border-neutral-200 dark:border-neutral-800/50" />
      </div>

      {/* Coming Soon */}
      <section className="container mx-auto px-4 py-32">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <p className="text-neutral-500 dark:text-neutral-500 font-medium mb-4 tracking-wide text-sm">
              COMING SOON
            </p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              What we're building next
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-px bg-neutral-200 dark:bg-neutral-800/50 rounded-2xl overflow-hidden">
            {[
              {
                title: 'Events',
                description: 'Ticketing with built-in payment verification. Sell, scan, reconcile.',
                timeline: 'Q2 2025',
              },
              {
                title: 'Subscriptions',
                description: 'Recurring payment management for bank transfers and mobile money.',
                timeline: 'Q3 2025',
              },
              {
                title: 'Invoices',
                description: 'Generate invoices, share payment links, auto-match when paid.',
                timeline: 'Q4 2025',
              },
            ].map((product, i) => (
              <div 
                key={product.title} 
                className="bg-white dark:bg-[#0A0A0A] p-10 md:p-12 group hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors"
              >
                <span className="text-6xl font-bold text-neutral-100 dark:text-neutral-900 group-hover:text-orange-100 dark:group-hover:text-orange-950 transition-colors">
                  0{i + 1}
                </span>
                <h3 className="text-2xl font-semibold mt-6 mb-3">{product.title}</h3>
                <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed mb-6">
                  {product.description}
                </p>
                <span className="text-sm text-neutral-400 dark:text-neutral-600">
                  {product.timeline}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 pb-32">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">
            Ready to start?
          </h2>
          <p className="text-lg text-neutral-600 dark:text-neutral-400 mb-10">
            Free tier available. No license required. 
            <br className="hidden sm:block" />
            15 minutes to your first verification.
          </p>
          <Link to="/auth/register">
            <Button size="lg" className="bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 px-10">
              Create free account
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-200 dark:border-neutral-800/50 pt-6 md:pt-8 pb-8 md:pb-12 bg-white dark:bg-[#0A0A0A]">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 mb-6 md:mb-8">
            <div className="col-span-2 md:col-span-1">
              <Link to="/" className="flex items-center gap-2 mb-3 md:mb-4">
                <img
                  src={logoPath}
                  alt="CheckPay Logo"
                  className="h-8 md:h-10 w-auto min-w-[80px] md:min-w-[100px] object-contain"
                />
              </Link>
              <p className="text-xs md:text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Universal payment verification for Africa
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2 md:mb-3 text-sm md:text-base text-neutral-900 dark:text-neutral-100">Product</h4>
              <ul className="space-y-1.5 md:space-y-2 text-xs md:text-sm text-neutral-500 dark:text-neutral-400">
                <li><Link to="/products" className="hover:text-orange-500 transition-colors">All Products</Link></li>
                <li><Link to="/api-docs" className="hover:text-orange-500 transition-colors">Documentation</Link></li>
                <li><Link to="/pricing" className="hover:text-orange-500 transition-colors">Pricing</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2 md:mb-3 text-sm md:text-base text-neutral-900 dark:text-neutral-100">Company</h4>
              <ul className="space-y-1.5 md:space-y-2 text-xs md:text-sm text-neutral-500 dark:text-neutral-400">
                <li><a href="#" className="hover:text-orange-500 transition-colors">About</a></li>
                <li><a href="#" className="hover:text-orange-500 transition-colors">Blog</a></li>
                <li><a href="mailto:hello@checkpay.africa" className="hover:text-orange-500 transition-colors">Contact Us</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2 md:mb-3 text-sm md:text-base text-neutral-900 dark:text-neutral-100">Legal</h4>
              <ul className="space-y-1.5 md:space-y-2 text-xs md:text-sm text-neutral-500 dark:text-neutral-400">
                <li><a href="#" className="hover:text-orange-500 transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-orange-500 transition-colors">Terms</a></li>
                <li><a href="#" className="hover:text-orange-500 transition-colors">Security</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-neutral-200 dark:border-neutral-800/50 pt-4 md:pt-8 text-center text-xs md:text-sm text-neutral-500 dark:text-neutral-400">
            <p>© 2025 CheckPay. All rights reserved. Built for everybody, by developers.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
