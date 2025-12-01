import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, Shield, Globe, ArrowRight, Terminal } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { InteractiveBackground } from '@/components/landing/InteractiveBackground';

export default function LandingPage() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <InteractiveBackground />

      {/* Content Wrapper */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header */}
        <header className="border-b border-border/40 backdrop-blur-md bg-background/50 sticky top-0 z-50">
          <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-[#F37100] flex items-center justify-center text-white font-bold text-sm">
                CP
              </div>
              <span className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                CheckPay
              </span>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <ThemeToggle />
              <Link to="/auth/login">
                <Button variant="ghost" size="sm" className="hover:bg-[#F37100]/10 hover:text-[#F37100] text-xs sm:text-sm">Login</Button>
              </Link>
              <Link to="/auth/register">
                <Button size="sm" className="bg-[#F37100] hover:bg-[#F37100]/90 text-white shadow-lg shadow-orange-500/20 transition-all hover:scale-105 text-xs sm:text-sm">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="container mx-auto px-4 sm:px-6 py-12 sm:py-20 lg:py-32 text-center">
          <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-[#F37100]/10 text-[#F37100] text-xs sm:text-sm font-medium mb-6 sm:mb-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F37100] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#F37100]"></span>
            </span>
            Now supporting 30+ African countries
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold mb-6 sm:mb-8 tracking-tight animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100 px-2">
            The Universal SMS
            <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#F37100] to-orange-600">
              Transaction Parser
            </span>
          </h1>

          <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200 px-4">
            Verify payments instantly by parsing SMS from any African bank or mobile money service.
            <span className="block mt-2 text-foreground font-medium">No regex. No infrastructure. Just AI.</span>
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300 px-4">
            <Link to="/auth/register" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto h-11 sm:h-12 px-6 sm:px-8 text-base sm:text-lg bg-[#F37100] hover:bg-[#F37100]/90 text-white shadow-xl shadow-orange-500/20 transition-all hover:scale-105">
                Start Building Free
                <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </Link>
            <Link to="/dashboard/api-docs" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto h-11 sm:h-12 px-6 sm:px-8 text-base sm:text-lg backdrop-blur-sm bg-background/50 border-border/50 hover:bg-accent/50">
                View Documentation
              </Button>
            </Link>
          </div>

          {/* Code Preview */}
          <div className="mt-12 sm:mt-16 md:mt-20 mx-auto max-w-4xl rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-500">
            <div className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-3 border-b border-border/50 bg-muted/50">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-500/80" />
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-yellow-500/80" />
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-green-500/80" />
              </div>
              <div className="ml-2 sm:ml-4 text-[10px] sm:text-xs text-muted-foreground font-mono">parse_transaction.js</div>
            </div>
            <div className="p-4 sm:p-6 text-left overflow-x-auto">
              <pre className="text-xs sm:text-sm font-mono leading-relaxed">
                <code className="language-javascript">
                  <span className="text-purple-400">const</span> <span className="text-blue-400">checkpay</span> = <span className="text-purple-400">require</span>(<span className="text-green-400">'checkpay-sdk'</span>);{'\n\n'}
                  <span className="text-gray-500">// Just pass the raw SMS content</span>{'\n'}
                  <span className="text-purple-400">const</span> result = <span className="text-purple-400">await</span> checkpay.<span className="text-blue-400">parse</span>({'{'}{'\n'}
                  {'  '}sms: <span className="text-green-400">"Confirmed. Ksh1,500.00 sent to JOHN DOE..."</span>,{'\n'}
                  {'  '}sender: <span className="text-green-400">"MPESA"</span>{'\n'}
                  {'}'});{'\n\n'}
                  <span className="text-blue-400">console</span>.<span className="text-blue-400">log</span>(result);{'\n'}
                  <span className="text-gray-500">// Output: {'{'} amount: 1500, currency: 'KES', type: 'SEND', ... {'}'}</span>
                </code>
              </pre>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="container mx-auto px-4 sm:px-6 py-16 sm:py-20 md:py-24">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              {
                icon: Zap,
                title: "AI-Powered",
                desc: "No regex knowledge needed. Our AI builds parsers instantly from examples."
              },
              {
                icon: Globe,
                title: "Universal",
                desc: "Works in 30+ African countries with any bank or mobile money service."
              },
              {
                icon: Shield,
                title: "Bank-Grade Security",
                desc: "SOC2 compliant infrastructure with automatic PII masking."
              },
              {
                icon: Terminal,
                title: "Developer First",
                desc: "One API key, one endpoint. Integrate in minutes with typed SDKs."
              }
            ].map((feature, i) => (
              <Card key={i} className="bg-card/40 backdrop-blur-sm border-border/50 hover:bg-card/60 transition-colors duration-300">
                <CardHeader>
                  <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-[#F37100]/10 flex items-center justify-center mb-3 sm:mb-4">
                    <feature.icon className="h-5 w-5 sm:h-6 sm:w-6 text-[#F37100]" />
                  </div>
                  <CardTitle className="text-lg sm:text-xl">{feature.title}</CardTitle>
                  <CardDescription className="text-sm sm:text-base mt-2">
                    {feature.desc}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-4 sm:px-6 py-16 sm:py-20 md:py-24 text-center">
          <Card className="max-w-4xl mx-auto bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-md border-border/50 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-r from-[#F37100]/10 to-transparent opacity-50" />
            <CardContent className="relative p-6 sm:p-10 md:p-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6">Ready to automate your payments?</h2>
              <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-6 sm:mb-8 max-w-2xl mx-auto px-2">
                Join 5,000+ developers across Africa who trust CheckPay for reliable transaction verification.
              </p>
              <Link to="/auth/register">
                <Button size="lg" className="h-12 sm:h-14 px-8 sm:px-10 text-base sm:text-lg bg-[#F37100] hover:bg-[#F37100]/90 text-white shadow-xl shadow-orange-500/20">
                  Create Free Account
                </Button>
              </Link>
              <p className="mt-4 sm:mt-6 text-xs sm:text-sm text-muted-foreground">
                No credit card required • 100 free transactions/month
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Footer */}
        <footer className="border-t border-border/40 backdrop-blur-md bg-background/50 mt-auto">
          <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-10 md:py-12">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 sm:gap-6">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 sm:h-6 sm:w-6 rounded bg-[#F37100] flex items-center justify-center text-white text-xs font-bold">
                  CP
                </div>
                <span className="font-bold text-sm sm:text-base">CheckPay</span>
              </div>
              <div className="flex flex-wrap justify-center gap-4 sm:gap-6 md:gap-8 text-xs sm:text-sm text-muted-foreground">
                <a href="#" className="hover:text-[#F37100] transition-colors">Documentation</a>
                <a href="#" className="hover:text-[#F37100] transition-colors">Pricing</a>
                <a href="#" className="hover:text-[#F37100] transition-colors">Terms</a>
                <a href="#" className="hover:text-[#F37100] transition-colors">Privacy</a>
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground text-center md:text-left">
                © 2025 CheckPay. All rights reserved.
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
