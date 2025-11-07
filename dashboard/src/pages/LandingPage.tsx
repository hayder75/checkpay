import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Zap, Shield, Globe } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="text-2xl font-bold">CheckPay</div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link to="/auth/login">
              <Button variant="ghost">Login</Button>
            </Link>
            <Link to="/auth/register">
              <Button className="bg-[#F37100] hover:bg-[#F37100]/90">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl font-bold mb-6">
          The Universal SMS Transaction Parser
          <br />
          <span className="text-[#F37100]">for Africa</span>
        </h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Verify payments instantly by parsing SMS from any African bank or mobile money service.
          No regex. No infrastructure. Just paste an SMS → get a working parser.
        </p>
        <div className="flex gap-4 justify-center">
          <Link to="/auth/register">
            <Button size="lg" className="bg-[#F37100] hover:bg-[#F37100]/90">
              Start Free
            </Button>
          </Link>
          <Button size="lg" variant="outline">
            Learn More
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-20">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader>
              <Zap className="h-8 w-8 text-[#F37100] mb-2" />
              <CardTitle>AI-Powered</CardTitle>
              <CardDescription>
                No regex knowledge needed. Just paste an SMS and our AI builds the parser.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <Globe className="h-8 w-8 text-[#F37100] mb-2" />
              <CardTitle>Universal</CardTitle>
              <CardDescription>
                Works in 30+ African countries with any bank or mobile money service.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <Shield className="h-8 w-8 text-[#F37100] mb-2" />
              <CardTitle>Secure</CardTitle>
              <CardDescription>
                Phone masking, rate limits, and full audit logging for your security.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CheckCircle2 className="h-8 w-8 text-[#F37100] mb-2" />
              <CardTitle>Developer-Friendly</CardTitle>
              <CardDescription>
                One API key, one endpoint. Integrate in minutes, not days.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-3xl">Ready to get started?</CardTitle>
            <CardDescription className="text-lg">
              Join developers across Africa who trust CheckPay for payment verification.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/auth/register">
              <Button size="lg" className="bg-[#F37100] hover:bg-[#F37100]/90">
                Create Free Account
              </Button>
            </Link>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© 2025 CheckPay. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
