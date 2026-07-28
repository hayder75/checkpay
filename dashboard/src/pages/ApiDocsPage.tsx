import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Copy, Check, ArrowRight, Download, Smartphone, X, Menu } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { authAPI } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { auth } from '@/lib/auth';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import GeometricBackground from '@/components/GeometricBackground';
import GeometricBgToggle from '@/components/GeometricBgToggle';
import DashboardLayout from '@/components/layouts/DashboardLayout';

type NavItem = {
  id: string;
  label: string;
};

export default function ApiDocsPage() {
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme } = useTheme();
  const logoPath = theme === 'dark' ? '/dark-theme-logo.png' : '/light-theme-logo.png';

  const apiUrl = 'https://checkpay.live/api';
  const currentUser = auth.getUser();

  const navItems: NavItem[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'quickstart', label: 'Quick Start' },
    { id: 'project-types', label: 'Project Types' },
    { id: 'authentication', label: 'Authentication' },
    { id: 'verify-endpoint', label: 'Verification API' },
    { id: 'responses', label: 'Responses' },
    { id: 'code-examples', label: 'Code Examples' },
    { id: 'mobile-app', label: 'Mobile App' },
    { id: 'security', label: 'Security' },
    { id: 'rate-limits', label: 'Rate Limits' },
  ];

  const quickStartSteps = [
    {
      title: 'Create your project',
      body: 'Create a project from the dashboard and keep its Project API Key. Every verification request is scoped to that project context.',
    },
    {
      title: 'Choose the right project type',
      body: 'Use Standalone for your own operation, Transferable when the project may move to a client or another operator, and Cluster when a developer needs an accepted owner link.',
    },
    {
      title: 'Connect a phone data source',
      body: 'Install the CheckPay Android app on the phone that receives transaction messages, sign in, and let it sync transactions into the correct project or account flow.',
    },
    {
      title: 'Call the verification API',
      body: 'Use GET to check whether a transaction already exists, or POST to record a manual or scan-based verification attempt that can resolve later when the transaction arrives.',
    },
  ];

  const projectTypes = [
    {
      title: 'Standalone',
      badge: 'STANDALONE',
      description: 'A direct project for one operator, one business flow, or one developer-managed setup.',
      bestFor: 'Use this when the same owner or team controls the project and the phone data source does not need to move between parties.',
      setup: 'Create the project as Standalone and connect the phone that will receive the bank or mobile money transaction messages.',
      request: 'Verify with the project API key against /api/verify. The request shape is the default CheckPay pattern.',
    },
    {
      title: 'Transferable',
      badge: 'TRANSFERABLE',
      description: 'A project prepared for handover or reassignment while keeping the same verification flow.',
      bestFor: 'Use this when the project may later move to a client, another operator, or a new phone ingestion owner.',
      setup: 'Keep the project under Transferable and set the client phone API key or handover target when the ingestion source should move.',
      request: 'The verification API shape stays the same. What changes is which phone ingestion source is attached to that project.',
    },
    {
      title: 'Cluster',
      badge: 'CLUSTER',
      description: 'A shared operating model where a developer project is linked to a business owner flow through an owner ID request and acceptance process.',
      bestFor: 'Use this when a developer manages the integration but the business owner must approve the operating link and remain part of the project relationship.',
      setup: 'Create the Cluster project, add the vendor or owner link using the 6-digit owner ID, and wait until the owner accepts the request.',
      request: 'Once the owner link is active, use the cluster project API key with the same /api/verify request shape. The difference is that data is now tied to the accepted cluster relationship.',
    },
  ];

  const securityPractices = [
    'Store API keys in environment variables, not in frontend code or mobile bundles.',
    'Run verification from your backend so your project key is never exposed to end users.',
    'Use GET for status checks and POST when you want CheckPay to record a manual or OCR verification attempt.',
    'Match the returned amount and transaction ID against your order before delivering value.',
  ];

  const getVerifyCurl = `curl "${apiUrl}/verify?txn=FT25315HZNYL" \\
  -H "X-API-Key: YOUR_PROJECT_API_KEY"`;

  const postVerifyCurl = `curl -X POST "${apiUrl}/verify" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_PROJECT_API_KEY" \\
  -d '{
    "txnId": "FT25315HZNYL",
    "source": "MANUAL",
    "ocrText": "optional raw OCR or operator note"
  }'`;

  const nodeExample = `const axios = require('axios');

async function checkPayment(txnId) {
  const response = await axios.get('${apiUrl}/verify', {
    params: { txn: txnId },
    headers: { 'X-API-Key': process.env.CHECKPAY_API_KEY },
  });

  const result = response.data?.data;
  if (response.data?.success && result?.confirmed) {
    return {
      confirmed: true,
      txnId: result.txnId,
      amount: result.amount,
      bank: result.bank,
    };
  }

  return { confirmed: false, message: result?.message || 'Transaction not found' };
}`;

  const pythonExample = `import os
import requests

def record_manual_verification(txn_id, source='MANUAL', ocr_text=None):
    response = requests.post(
        '${apiUrl}/verify',
        headers={
            'X-API-Key': os.getenv('CHECKPAY_API_KEY'),
            'Content-Type': 'application/json',
        },
        json={
            'txnId': txn_id,
            'source': source,
            'ocrText': ocr_text,
        },
    )
    return response.json()`;

  const phpExample = `<?php
function verifyTransaction($txnId) {
    $url = '${apiUrl}/verify?txn=' . urlencode($txnId);

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'X-API-Key: ' . $_ENV['CHECKPAY_API_KEY']
    ]);

    $response = json_decode(curl_exec($ch), true);
    curl_close($ch);

    if (!empty($response['success']) && !empty($response['data']['confirmed'])) {
        return $response['data'];
    }

    return ['confirmed' => false];
}
?>`;

  useEffect(() => {
    if (currentUser) {
      loadUser();
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      for (const item of navItems) {
        const element = document.getElementById(item.id);
        if (!element) {
          continue;
        }

        const rect = element.getBoundingClientRect();
        if (rect.top <= 100 && rect.bottom >= 100) {
          setActiveSection(item.id);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const loadUser = async () => {
    try {
      const response = await authAPI.getMe();
      setUser(response.data.data);
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast({
      title: 'Copied!',
      description: `${label} copied to clipboard`,
    });
    setTimeout(() => setCopied(null), 2000);
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setMobileMenuOpen(false);
    }
  };

  const content = (
    <div className="min-h-screen bg-background text-foreground transition-colors">
      <div className="flex relative">
        <aside className="hidden lg:block w-56 flex-shrink-0 sticky top-16 self-start h-[calc(100vh-4rem)] border-r border-border overflow-y-auto">
          <div className="p-5 pt-8">
            <h2 className="text-xs font-heading font-semibold uppercase tracking-widest text-muted-foreground mb-4">On this page</h2>
            <nav className="space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                    activeSection === item.id
                      ? 'bg-primary/10 text-primary font-heading font-medium'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        <main className="flex-1 min-w-0">
          <div className="px-4 sm:px-8 lg:px-12 py-12 lg:py-16">
            <section id="overview" className="mb-12">
              <h1 className="text-4xl sm:text-5xl font-heading font-bold tracking-tight text-foreground mb-6">
                CheckPay API Documentation
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground mb-4 leading-relaxed max-w-4xl">
                Standard integration documentation for transaction verification, mobile ingestion, and project setup across Standalone, Transferable, and Cluster project types.
              </p>
              <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-4xl">
                CheckPay helps you receive transaction data from connected phones, organize it under the right project model, and verify incoming payments through a consistent API. The request format stays simple. What changes by project type is how data reaches the project and who controls that operating relationship.
              </p>
            </section>

            <section id="quickstart" className="mb-12">
              <h2 className="text-2xl sm:text-3xl font-heading font-bold text-foreground mb-3">Quick Start</h2>
              <p className="text-muted-foreground mb-8 text-base md:text-lg">
                Follow this flow if you want a standard setup that matches the current product behavior.
              </p>

              <div className="space-y-10">
                {quickStartSteps.map((step, index) => (
                  <div className="flex gap-5" key={step.title}>
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">{index + 1}</div>
                    <div className="flex-1 pt-1">
                      <h3 className="font-heading font-semibold text-foreground text-lg mb-2">{step.title}</h3>
                      <p className="text-muted-foreground">{step.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section id="project-types" className="mb-12">
              <h2 className="text-2xl sm:text-3xl font-heading font-bold text-foreground mb-3">Project Types</h2>
              <p className="text-muted-foreground mb-8 text-base md:text-lg">
                The verification request shape stays consistent across project types. The main difference is how each project is configured and where its transaction data comes from.
              </p>

              <div className="grid lg:grid-cols-3 gap-6 mb-10">
                {projectTypes.map((projectType) => (
                  <div key={projectType.badge} className="p-6 rounded-2xl border border-border bg-card">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <h3 className="text-xl font-semibold text-foreground">{projectType.title}</h3>
                      <span className="px-3 py-1.5 text-xs font-bold rounded-md bg-primary/10 text-primary">
                        {projectType.badge}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">{projectType.description}</p>
                    <div className="space-y-3 text-sm">
                      <div>
                        <div className="font-semibold text-foreground mb-1">Best for</div>
                        <div className="text-muted-foreground">{projectType.bestFor}</div>
                      </div>
                      <div>
                        <div className="font-semibold text-foreground mb-1">Setup</div>
                        <div className="text-muted-foreground">{projectType.setup}</div>
                      </div>
                      <div>
                        <div className="font-semibold text-foreground mb-1">API usage</div>
                        <div className="text-muted-foreground">{projectType.request}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-6 rounded-xl bg-muted/30 border border-border overflow-x-auto">
                <h3 className="font-semibold text-foreground mb-4">Operational API Pattern By Project Type</h3>
                <table className="w-full text-sm min-w-[720px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 pr-4 font-semibold text-foreground">Type</th>
                      <th className="text-left py-3 pr-4 font-semibold text-foreground">Required setup</th>
                      <th className="text-left py-3 pr-4 font-semibold text-foreground">Verification request</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border">
                      <td className="py-4 pr-4 font-medium text-foreground">Standalone</td>
                      <td className="py-4 pr-4 text-muted-foreground">Own project and connected phone source</td>
                      <td className="py-4 pr-4 text-muted-foreground"><code className="text-primary">GET /api/verify?txn=...</code> or <code className="text-primary">POST /api/verify</code> with your project key</td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className="py-4 pr-4 font-medium text-foreground">Transferable</td>
                      <td className="py-4 pr-4 text-muted-foreground">Project prepared for handover or client phone ingestion</td>
                      <td className="py-4 pr-4 text-muted-foreground">Same verification route, but the attached phone ingestion source may be reassigned later</td>
                    </tr>
                    <tr>
                      <td className="py-4 pr-4 font-medium text-foreground">Cluster</td>
                      <td className="py-4 pr-4 text-muted-foreground">Accepted owner-ID link on a cluster project</td>
                      <td className="py-4 pr-4 text-muted-foreground">Same verification route with the cluster project key after the owner request is accepted</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section id="authentication" className="mb-12">
              <h2 className="text-2xl sm:text-3xl font-heading font-bold text-foreground mb-3">Authentication</h2>
              <p className="text-muted-foreground mb-8 text-base md:text-lg">
                All project verification requests should be authenticated with your Project API Key. Header-based authentication is the standard and recommended format.
              </p>

              {user && user.apiKey && (
                <div className="mb-10 p-5 rounded-xl border-2 border-primary/20 bg-primary/5">
                  <div className="text-sm font-semibold text-foreground mb-3">Your API Key</div>
                  <div className="flex items-center gap-3">
                    <code className="flex-1 px-4 py-3 bg-card border border-border rounded-lg text-sm font-mono break-all text-foreground">
                      {user.apiKey}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(user.apiKey, 'API Key')}
                      className="shrink-0"
                    >
                      {copied === 'API Key' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-8">
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">Header Authentication</h3>
                  <pre className="bg-[#0D0D0D] text-neutral-100 p-5 rounded-xl text-sm font-mono border border-border/50 overflow-x-auto">
                    <code>X-API-Key: YOUR_PROJECT_API_KEY</code>
                  </pre>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">Query Parameter Alternative</h3>
                  <pre className="bg-[#0D0D0D] text-neutral-100 p-5 rounded-xl text-sm font-mono border border-border/50 overflow-x-auto">
                    <code>?key=YOUR_PROJECT_API_KEY&amp;txn=TRANSACTION_ID</code>
                  </pre>
                  <p className="text-sm text-muted-foreground mt-3">
                    Use this only for GET-style status checks if needed. Header authentication is the clean standard for production integrations.
                  </p>
                </div>
              </div>
            </section>

            <section id="verify-endpoint" className="mb-12">
              <h2 className="text-2xl sm:text-3xl font-heading font-bold text-foreground mb-3">Verification API</h2>
              <p className="text-muted-foreground mb-8 text-base md:text-lg">
                CheckPay currently supports two standard verification request patterns on the same endpoint family: GET to check whether a transaction already exists, and POST to record a manual or scan-based verification attempt.
              </p>

              <div className="space-y-8 mb-10">
                <div className="p-5 rounded-xl bg-muted/30 border border-border">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="px-3 py-1.5 text-xs font-bold rounded-md bg-green-500 text-white uppercase">GET</span>
                    <code className="text-foreground font-mono text-lg">{apiUrl}/verify</code>
                  </div>
                  <p className="text-muted-foreground text-sm">Use this when you want to check whether the transaction is already present and available for confirmation.</p>
                </div>

                <div className="p-5 rounded-xl bg-muted/30 border border-border">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="px-3 py-1.5 text-xs font-bold rounded-md bg-blue-500 text-white uppercase">POST</span>
                    <code className="text-foreground font-mono text-lg">{apiUrl}/verify</code>
                  </div>
                  <p className="text-muted-foreground text-sm">Use this when an operator, scanner, or manual review flow needs to record a verification attempt now, even if the transaction has not arrived yet.</p>
                </div>
              </div>

              <div className="grid xl:grid-cols-2 gap-8 mb-10">
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wide">GET Parameters</h3>
                  <div className="border border-border rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/30">
                          <th className="text-left px-5 py-4 font-semibold text-foreground">Name</th>
                          <th className="text-left px-5 py-4 font-semibold text-foreground">Type</th>
                          <th className="text-left px-5 py-4 font-semibold text-foreground">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t border-border bg-card">
                          <td className="px-5 py-4">
                            <code className="text-sm font-mono text-primary">txn</code>
                            <span className="ml-2 text-xs text-red-600 dark:text-red-400 font-medium">required</span>
                          </td>
                          <td className="px-5 py-4 text-muted-foreground">string</td>
                          <td className="px-5 py-4 text-muted-foreground">Transaction ID or reference ID to look up within the authenticated project context</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wide">POST Body</h3>
                  <div className="border border-border rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/30">
                          <th className="text-left px-5 py-4 font-semibold text-foreground">Field</th>
                          <th className="text-left px-5 py-4 font-semibold text-foreground">Type</th>
                          <th className="text-left px-5 py-4 font-semibold text-foreground">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t border-border bg-card">
                          <td className="px-5 py-4">
                            <code className="text-sm font-mono text-primary">txnId</code>
                            <span className="ml-2 text-xs text-red-600 dark:text-red-400 font-medium">required</span>
                          </td>
                          <td className="px-5 py-4 text-muted-foreground">string</td>
                          <td className="px-5 py-4 text-muted-foreground">Transaction ID to verify or record for later fulfillment</td>
                        </tr>
                        <tr className="border-t border-border bg-card">
                          <td className="px-5 py-4"><code className="text-sm font-mono text-primary">source</code></td>
                          <td className="px-5 py-4 text-muted-foreground">string</td>
                          <td className="px-5 py-4 text-muted-foreground">Optional source such as MANUAL or OCR for audit metadata</td>
                        </tr>
                        <tr className="border-t border-border bg-card">
                          <td className="px-5 py-4"><code className="text-sm font-mono text-primary">ocrText</code></td>
                          <td className="px-5 py-4 text-muted-foreground">string</td>
                          <td className="px-5 py-4 text-muted-foreground">Optional raw OCR or operator note stored as metadata on the verification request</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="grid xl:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wide">GET Example</h3>
                  <div className="relative">
                    <pre className="bg-[#0D0D0D] text-neutral-100 p-5 rounded-xl text-sm overflow-x-auto font-mono border border-border/50">
                      <code>{getVerifyCurl}</code>
                    </pre>
                    <button
                      onClick={() => copyToClipboard(getVerifyCurl, 'GET example')}
                      className="absolute top-4 right-4 p-2 rounded-lg bg-muted-foreground/20 hover:bg-muted-foreground/30 transition-colors"
                    >
                      {copied === 'GET example' ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4 text-muted-foreground/70" />}
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wide">POST Example</h3>
                  <div className="relative">
                    <pre className="bg-[#0D0D0D] text-neutral-100 p-5 rounded-xl text-sm overflow-x-auto font-mono border border-border/50">
                      <code>{postVerifyCurl}</code>
                    </pre>
                    <button
                      onClick={() => copyToClipboard(postVerifyCurl, 'POST example')}
                      className="absolute top-4 right-4 p-2 rounded-lg bg-muted-foreground/20 hover:bg-muted-foreground/30 transition-colors"
                    >
                      {copied === 'POST example' ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4 text-muted-foreground/70" />}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section id="responses" className="mb-12">
              <h2 className="text-2xl sm:text-3xl font-heading font-bold text-foreground mb-3">Responses</h2>
              <p className="text-muted-foreground mb-8 text-base md:text-lg">
                CheckPay returns JSON responses for both status checks and recorded verification attempts.
              </p>

              <div className="space-y-10">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="px-3 py-1.5 text-xs font-bold rounded-md bg-green-500 text-white">200</span>
                    <h3 className="font-semibold text-foreground text-lg">Transaction Found</h3>
                  </div>
                  <pre className="bg-[#0D0D0D] text-neutral-100 p-5 rounded-xl text-sm overflow-x-auto font-mono border border-border/50">
                    <code>{`{
  "success": true,
  "data": {
    "confirmed": true,
    "matchType": "exact",
    "txnId": "FT25315HZNYL",
    "referenceTxnId": null,
    "amount": 1000.5,
    "sender": "+2519****45",
    "bank": "CBE",
    "receivedAt": "2026-05-03T10:30:00.000Z",
    "source": "SMS"
  }
}`}</code>
                  </pre>
                </div>

                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="px-3 py-1.5 text-xs font-bold rounded-md bg-blue-500 text-white">200</span>
                    <h3 className="font-semibold text-foreground text-lg">Verification Recorded</h3>
                  </div>
                  <pre className="bg-[#0D0D0D] text-neutral-100 p-5 rounded-xl text-sm overflow-x-auto font-mono border border-border/50">
                    <code>{`{
  "success": true,
  "data": {
    "confirmed": false,
    "message": "Verification recorded. Transaction will be marked as verified when received.",
    "pendingVerificationId": "pv_123456789",
    "expiresAt": "2026-05-04T10:30:00.000Z"
  }
}`}</code>
                  </pre>
                </div>

                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="px-3 py-1.5 text-xs font-bold rounded-md bg-primary text-primary-foreground">200</span>
                    <h3 className="font-semibold text-foreground text-lg">Transaction Not Found</h3>
                  </div>
                  <pre className="bg-[#0D0D0D] text-neutral-100 p-5 rounded-xl text-sm overflow-x-auto font-mono border border-border/50">
                    <code>{`{
  "success": true,
  "data": {
    "confirmed": false,
    "message": "Transaction not found."
  }
}`}</code>
                  </pre>
                </div>

                <div>
                  <h3 className="font-semibold text-foreground text-lg mb-5">Error Codes</h3>
                  <div className="space-y-4">
                    <div className="flex items-start gap-4 p-4 rounded-xl bg-destructive/5 border border-destructive/20">
                      <span className="px-3 py-1.5 text-xs font-bold rounded-md bg-red-500 text-white shrink-0">400</span>
                      <div>
                        <div className="font-medium text-foreground mb-1">Bad Request</div>
                        <div className="text-sm text-muted-foreground">The request did not include a valid transaction identifier.</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-4 p-4 rounded-xl bg-destructive/5 border border-destructive/20">
                      <span className="px-3 py-1.5 text-xs font-bold rounded-md bg-red-500 text-white shrink-0">401</span>
                      <div>
                        <div className="font-medium text-foreground mb-1">Unauthorized</div>
                        <div className="text-sm text-muted-foreground">The API key is missing or invalid.</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-4 p-4 rounded-xl bg-destructive/5 border border-destructive/20">
                      <span className="px-3 py-1.5 text-xs font-bold rounded-md bg-red-500 text-white shrink-0">403</span>
                      <div>
                        <div className="font-medium text-foreground mb-1">Forbidden</div>
                        <div className="text-sm text-muted-foreground">The project or user is authenticated but does not have active credit or permission to complete the verification action.</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-4 p-4 rounded-xl bg-destructive/5 border border-destructive/20">
                      <span className="px-3 py-1.5 text-xs font-bold rounded-md bg-red-500 text-white shrink-0">429</span>
                      <div>
                        <div className="font-medium text-foreground mb-1">Too Many Requests</div>
                        <div className="text-sm text-muted-foreground">The request rate for the authenticated plan has been exceeded.</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-4 p-4 rounded-xl bg-destructive/5 border border-destructive/20">
                      <span className="px-3 py-1.5 text-xs font-bold rounded-md bg-red-500 text-white shrink-0">500</span>
                      <div>
                        <div className="font-medium text-foreground mb-1">Server Error</div>
                        <div className="text-sm text-muted-foreground">CheckPay could not complete the request due to an internal error. Retry or contact support if the issue persists.</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section id="code-examples" className="mb-12">
              <h2 className="text-2xl sm:text-3xl font-heading font-bold text-foreground mb-3">Code Examples</h2>
              <p className="text-muted-foreground mb-8 text-base md:text-lg">
                Use these examples as a starting point for the standard CheckPay verification flow.
              </p>

              <div className="space-y-10">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-4">Node.js</h3>
                  <div className="relative">
                    <pre className="bg-[#0D0D0D] text-neutral-100 p-5 rounded-xl text-sm overflow-x-auto font-mono leading-relaxed border border-border/50">
                      <code>{nodeExample}</code>
                    </pre>
                    <button
                      onClick={() => copyToClipboard(nodeExample, 'nodejs')}
                      className="absolute top-4 right-4 p-2 rounded-lg bg-muted-foreground/20 hover:bg-muted-foreground/30 transition-colors"
                    >
                      {copied === 'nodejs' ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4 text-muted-foreground/70" />}
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-4">Python</h3>
                  <div className="relative">
                    <pre className="bg-[#0D0D0D] text-neutral-100 p-5 rounded-xl text-sm overflow-x-auto font-mono leading-relaxed border border-border/50">
                      <code>{pythonExample}</code>
                    </pre>
                    <button
                      onClick={() => copyToClipboard(pythonExample, 'python')}
                      className="absolute top-4 right-4 p-2 rounded-lg bg-muted-foreground/20 hover:bg-muted-foreground/30 transition-colors"
                    >
                      {copied === 'python' ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4 text-muted-foreground/70" />}
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-4">PHP</h3>
                  <div className="relative">
                    <pre className="bg-[#0D0D0D] text-neutral-100 p-5 rounded-xl text-sm overflow-x-auto font-mono leading-relaxed border border-border/50">
                      <code>{phpExample}</code>
                    </pre>
                    <button
                      onClick={() => copyToClipboard(phpExample, 'php')}
                      className="absolute top-4 right-4 p-2 rounded-lg bg-muted-foreground/20 hover:bg-muted-foreground/30 transition-colors"
                    >
                      {copied === 'php' ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4 text-muted-foreground/70" />}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section id="mobile-app" className="mb-12">
              <h2 className="text-2xl sm:text-3xl font-heading font-bold text-foreground mb-3">Mobile App</h2>
              <p className="text-muted-foreground mb-8 text-base md:text-lg">
                The Android app is the operational bridge between real transaction messages on a device and the project data that your API verifies later.
              </p>

              <div className="grid lg:grid-cols-2 gap-10 mb-10">
                <div className="p-8 rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 dark:from-card dark:to-card border border-border">
                  <div className="flex items-center gap-3 mb-6">
                    <Smartphone className="h-6 w-6 text-primary" />
                    <h3 className="text-xl font-semibold text-foreground">Scan to Download</h3>
                  </div>
                  <div className="flex justify-center">
                    <div className="p-6 bg-white rounded-2xl shadow-lg">
                      <QRCodeSVG value="https://checkpay.live/download/app" size={180} level="H" includeMargin={false} />
                    </div>
                  </div>
                  <p className="text-center text-sm text-muted-foreground mt-4">Scan with your phone camera</p>
                </div>

                <div className="p-8 rounded-2xl bg-muted/30 border border-border">
                  <div className="flex items-center gap-3 mb-6">
                    <Download className="h-6 w-6 text-primary" />
                    <h3 className="text-xl font-semibold text-foreground">Direct Download</h3>
                  </div>
                  <p className="text-muted-foreground mb-6">
                    Install the Android app on the phone that actually receives bank or mobile money messages for the project you want to verify against.
                  </p>
                  <Button
                    size="lg"
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-6"
                    onClick={() => {
                      window.location.href = '/downloads/checkpay.apk';
                    }}
                  >
                    <Download className="h-5 w-5 mr-2" />
                    Download APK for Android
                  </Button>
                  <p className="text-xs text-muted-foreground mt-4 text-center">Requires Android 8.0 or higher</p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="p-5 rounded-xl bg-muted/30 border border-border">
                  <h4 className="font-semibold text-foreground mb-2">Transaction Capture</h4>
                  <p className="text-sm text-muted-foreground">Reads supported financial notifications and transaction messages from the device</p>
                </div>
                <div className="p-5 rounded-xl bg-muted/30 border border-border">
                  <h4 className="font-semibold text-foreground mb-2">Project Sync</h4>
                  <p className="text-sm text-muted-foreground">Pushes captured transactions into the right account or project context</p>
                </div>
                <div className="p-5 rounded-xl bg-muted/30 border border-border">
                  <h4 className="font-semibold text-foreground mb-2">Manual Review Support</h4>
                  <p className="text-sm text-muted-foreground">Lets operators verify or record transactions when scanning, OCR, or manual workflows are needed</p>
                </div>
                <div className="p-5 rounded-xl bg-muted/30 border border-border">
                  <h4 className="font-semibold text-foreground mb-2">Cluster-Aware Usage</h4>
                  <p className="text-sm text-muted-foreground">Supports owner-linked and developer-managed flows when cluster projects are in use</p>
                </div>
              </div>
            </section>

            <section id="security" className="mb-12">
              <h2 className="text-2xl sm:text-3xl font-heading font-bold text-foreground mb-3">Security</h2>
              <p className="text-muted-foreground mb-8 text-base md:text-lg">
                The API and phone ingestion flow should be operated as a backend-to-backend integration, with project keys protected and verification decisions made server-side.
              </p>

              <div className="grid sm:grid-cols-2 gap-5 mb-10">
                <div className="p-6 rounded-xl bg-muted/30 border border-border">
                  <h3 className="font-semibold text-foreground mb-2">HTTPS</h3>
                  <p className="text-sm text-muted-foreground">Use encrypted transport for every verification request.</p>
                </div>
                <div className="p-6 rounded-xl bg-muted/30 border border-border">
                  <h3 className="font-semibold text-foreground mb-2">Scoped Project Keys</h3>
                  <p className="text-sm text-muted-foreground">Project API keys keep verification requests tied to the intended project context.</p>
                </div>
                <div className="p-6 rounded-xl bg-muted/30 border border-border">
                  <h3 className="font-semibold text-foreground mb-2">Backend Validation</h3>
                  <p className="text-sm text-muted-foreground">Confirm transaction IDs and returned amounts in your backend before marking orders as paid.</p>
                </div>
                <div className="p-6 rounded-xl bg-muted/30 border border-border">
                  <h3 className="font-semibold text-foreground mb-2">Usage Controls</h3>
                  <p className="text-sm text-muted-foreground">Plan credit and rate limits protect the service from abuse and unexpected load.</p>
                </div>
              </div>

              <div className="p-6 rounded-xl bg-primary/5 border border-primary/20">
                <h3 className="font-semibold text-foreground mb-4">Best Practices</h3>
                <ul className="text-sm text-muted-foreground space-y-3">
                  {securityPractices.map((practice) => (
                    <li className="flex items-start gap-3" key={practice}>
                      <ArrowRight className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                      <span>{practice}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section id="rate-limits" className="mb-16">
              <h2 className="text-2xl sm:text-3xl font-heading font-bold text-foreground mb-3">Rate Limits</h2>
              <p className="text-muted-foreground mb-8 text-base md:text-lg">
                Limits depend on your plan and available verification credit. Use the dashboard package view to monitor remaining usage.
              </p>

              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30">
                      <th className="text-left px-6 py-4 font-semibold text-foreground">Plan</th>
                      <th className="text-left px-6 py-4 font-semibold text-foreground">Indicative Limit</th>
                      <th className="text-left px-6 py-4 font-semibold text-foreground">Best For</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-border bg-card">
                      <td className="px-6 py-4 font-medium text-foreground">Free</td>
                      <td className="px-6 py-4 text-muted-foreground">Low-volume testing and initial setup</td>
                      <td className="px-6 py-4 text-muted-foreground">Sandbox-style evaluation and integration trials</td>
                    </tr>
                    <tr className="border-t border-border bg-card">
                      <td className="px-6 py-4 font-medium text-foreground">Premium / Active Package</td>
                      <td className="px-6 py-4 text-muted-foreground">Higher operational capacity based on package allocation</td>
                      <td className="px-6 py-4 text-muted-foreground">Production integrations, operator workflows, and higher verification volume</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );

  if (currentUser) {
    return <DashboardLayout>{content}</DashboardLayout>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors">
      <GeometricBackground />
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
            <Link to="/api-docs" className="text-sm text-primary font-medium">Docs</Link>
            <Link to="/products" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Products</Link>
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
                <div className="px-4 py-3 text-sm text-primary font-medium rounded-lg hover:bg-muted/50 transition-colors">Docs</div>
              </Link>
              <Link to="/products" onClick={() => setMobileMenuOpen(false)}>
                <div className="px-4 py-3 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors">Products</div>
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
      {content}
    </div>
  );
}
