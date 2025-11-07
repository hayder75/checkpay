import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Copy, Check, Code, Key, BookOpen } from 'lucide-react';
import { authAPI } from '@/lib';
import { useToast } from '@/components/ui/use-toast';

export default function ApiDocsPage() {
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    loadUser();
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

  const devApiKey = user?.devApiKey || 'ckp_your_dev_api_key_here';
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BookOpen className="h-8 w-8" />
            API Documentation
          </h1>
          <p className="text-muted-foreground mt-2">
            Learn how to verify transactions using CheckPay API
          </p>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="verify">Verify Endpoint</TabsTrigger>
            <TabsTrigger value="examples">Code Examples</TabsTrigger>
            <TabsTrigger value="responses">Response Format</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Your Developer API Key
                </CardTitle>
                <CardDescription>
                  Use this key to authenticate API requests from your backend
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
                  <code className="flex-1 text-sm font-mono">{devApiKey}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(devApiKey, 'Developer API Key')}
                  >
                    {copied === 'Developer API Key' ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  ⚠️ Keep this key secret. Never expose it in client-side code.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>How It Works</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h3 className="font-semibold">1. Mobile App Scrapes Transaction</h3>
                  <p className="text-sm text-muted-foreground">
                    Your CheckPay mobile app automatically reads SMS and extracts transaction details
                    (amount, transaction ID, sender, etc.)
                  </p>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold">2. Transaction Saved to Database</h3>
                  <p className="text-sm text-muted-foreground">
                    The app sends the transaction to CheckPay backend, which stores it securely
                    with your account.
                  </p>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold">3. Your Backend Verifies</h3>
                  <p className="text-sm text-muted-foreground">
                    When a user makes a payment, call our verify endpoint with the transaction ID
                    to confirm the payment was received.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rate Limits</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Free Plan:</span>
                    <span className="text-sm font-semibold">100 requests/month</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Premium Plan:</span>
                    <span className="text-sm font-semibold">1,000,000 requests/month</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Both app requests (from mobile) and dev requests (verification) count towards your limit.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Verify Endpoint Tab */}
          <TabsContent value="verify" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Verify Transaction Endpoint</CardTitle>
                <CardDescription>
                  Check if a transaction exists in your account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Endpoint</h3>
                  <code className="block p-3 bg-muted rounded text-sm">
                    GET {baseUrl}/api/verify
                  </code>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Authentication</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Include your Developer API Key in the request:
                  </p>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Option 1: Query Parameter</p>
                      <code className="block p-2 bg-muted rounded text-xs">
                        ?key=YOUR_DEV_API_KEY&txn=TRANSACTION_ID
                      </code>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Option 2: Header</p>
                      <code className="block p-2 bg-muted rounded text-xs">
                        X-API-Key: YOUR_DEV_API_KEY
                      </code>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Parameters</h3>
                  <div className="space-y-2">
                    <div className="p-3 bg-muted rounded">
                      <div className="flex items-start gap-2">
                        <code className="text-sm font-semibold">txn</code>
                        <span className="text-xs text-muted-foreground">(required)</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        The transaction ID to verify (e.g., "MP123456789")
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Example Request</h3>
                  <div className="relative">
                    <code className="block p-4 bg-muted rounded text-xs overflow-x-auto">
                      {`curl "${baseUrl}/api/verify?key=${devApiKey}&txn=MP123456789"`}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(
                        `${baseUrl}/api/verify?key=${devApiKey}&txn=MP123456789`,
                        'Request URL'
                      )}
                    >
                      {copied === 'Request URL' ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Code Examples Tab */}
          <TabsContent value="examples" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5" />
                  Code Examples
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Node.js Example */}
                <div>
                  <h3 className="font-semibold mb-2">Node.js / Express</h3>
                  <div className="relative">
                    <pre className="p-4 bg-muted rounded text-xs overflow-x-auto">
{`async function verifyTransaction(txnId) {
  const response = await fetch(
    \`${baseUrl}/api/verify?key=${devApiKey}&txn=\${txnId}\`
  );
  const data = await response.json();
  
  if (data.success && data.data.confirmed) {
    console.log('Payment confirmed:', data.data.amount);
    return data.data;
  } else {
    console.log('Transaction not found');
    return null;
  }
}`}
                    </pre>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(
                        `async function verifyTransaction(txnId) {\n  const response = await fetch(\n    \`${baseUrl}/api/verify?key=${devApiKey}&txn=\${txnId}\`\n  );\n  const data = await response.json();\n  \n  if (data.success && data.data.confirmed) {\n    console.log('Payment confirmed:', data.data.amount);\n    return data.data;\n  } else {\n    console.log('Transaction not found');\n    return null;\n  }\n}`,
                        'Node.js code'
                      )}
                    >
                      {copied === 'Node.js code' ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Python Example */}
                <div>
                  <h3 className="font-semibold mb-2">Python</h3>
                  <div className="relative">
                    <pre className="p-4 bg-muted rounded text-xs overflow-x-auto">
{`import requests

def verify_transaction(txn_id):
    url = "${baseUrl}/api/verify"
    params = {
        "key": "${devApiKey}",
        "txn": txn_id
    }
    
    response = requests.get(url, params=params)
    data = response.json()
    
    if data["success"] and data["data"]["confirmed"]:
        print(f"Payment confirmed: {data['data']['amount']}")
        return data["data"]
    else:
        print("Transaction not found")
        return None`}
                    </pre>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(
                        `import requests\n\ndef verify_transaction(txn_id):\n    url = "${baseUrl}/api/verify"\n    params = {\n        "key": "${devApiKey}",\n        "txn": txn_id\n    }\n    \n    response = requests.get(url, params=params)\n    data = response.json()\n    \n    if data["success"] and data["data"]["confirmed"]:\n        print(f"Payment confirmed: {data['data']['amount']}")\n        return data["data"]\n    else:\n        print("Transaction not found")\n        return None`,
                        'Python code'
                      )}
                    >
                      {copied === 'Python code' ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* PHP Example */}
                <div>
                  <h3 className="font-semibold mb-2">PHP</h3>
                  <div className="relative">
                    <pre className="p-4 bg-muted rounded text-xs overflow-x-auto">
{`<?php
function verifyTransaction($txnId) {
    $url = "${baseUrl}/api/verify?key=${devApiKey}&txn=" . urlencode($txnId);
    $response = file_get_contents($url);
    $data = json_decode($response, true);
    
    if ($data["success"] && $data["data"]["confirmed"]) {
        echo "Payment confirmed: " . $data["data"]["amount"];
        return $data["data"];
    } else {
        echo "Transaction not found";
        return null;
    }
}
?>`}
                    </pre>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(
                        `<?php\nfunction verifyTransaction($txnId) {\n    $url = "${baseUrl}/api/verify?key=${devApiKey}&txn=" . urlencode($txnId);\n    $response = file_get_contents($url);\n    $data = json_decode($response, true);\n    \n    if ($data["success"] && $data["data"]["confirmed"]) {\n        echo "Payment confirmed: " . $data["data"]["amount"];\n        return $data["data"];\n    } else {\n        echo "Transaction not found";\n        return null;\n    }\n}\n?>`,
                        'PHP code'
                      )}
                    >
                      {copied === 'PHP code' ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Response Format Tab */}
          <TabsContent value="responses" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Success Response (Transaction Found)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <pre className="p-4 bg-muted rounded text-xs overflow-x-auto">
{`{
  "success": true,
  "data": {
    "confirmed": true,
    "txnId": "MP123456789",
    "amount": 500.00,
    "sender": "+2547****89",
    "bank": "M-Pesa",
    "receivedAt": "2025-01-06T10:30:00.000Z"
  }
}`}
                  </pre>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(
                      JSON.stringify({
                        success: true,
                        data: {
                          confirmed: true,
                          txnId: "MP123456789",
                          amount: 500.00,
                          sender: "+2547****89",
                          bank: "M-Pesa",
                          receivedAt: "2025-01-06T10:30:00.000Z"
                        }
                      }, null, 2),
                      'Success response'
                    )}
                  >
                    {copied === 'Success response' ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <div className="mt-4 space-y-2">
                  <h4 className="font-semibold text-sm">Response Fields:</h4>
                  <ul className="text-xs space-y-1 text-muted-foreground">
                    <li><code className="bg-background px-1 rounded">confirmed</code> - Always <code className="bg-background px-1 rounded">true</code> when transaction exists</li>
                    <li><code className="bg-background px-1 rounded">txnId</code> - The transaction ID you queried</li>
                    <li><code className="bg-background px-1 rounded">amount</code> - Transaction amount</li>
                    <li><code className="bg-background px-1 rounded">sender</code> - Masked phone number (e.g., +2547****89)</li>
                    <li><code className="bg-background px-1 rounded">bank</code> - Bank/service name (e.g., "M-Pesa", "Airtel Money")</li>
                    <li><code className="bg-background px-1 rounded">receivedAt</code> - ISO 8601 timestamp when transaction was received</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Not Found Response</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <pre className="p-4 bg-muted rounded text-xs overflow-x-auto">
{`{
  "success": true,
  "data": {
    "confirmed": false,
    "message": "Transaction not found"
  }
}`}
                  </pre>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(
                      JSON.stringify({
                        success: true,
                        data: {
                          confirmed: false,
                          message: "Transaction not found"
                        }
                      }, null, 2),
                      'Not found response'
                    )}
                  >
                    {copied === 'Not found response' ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  This means the transaction ID doesn't exist in your account. The user may not have paid yet, or the transaction hasn't been scraped by the mobile app.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Error Responses</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold text-sm mb-2">401 - Invalid API Key</h4>
                  <pre className="p-3 bg-muted rounded text-xs overflow-x-auto">
{`{
  "success": false,
  "error": "Invalid API key"
}`}
                  </pre>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-2">400 - Missing Transaction ID</h4>
                  <pre className="p-3 bg-muted rounded text-xs overflow-x-auto">
{`{
  "success": false,
  "error": "Transaction ID is required"
}`}
                  </pre>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-2">429 - Rate Limit Exceeded</h4>
                  <pre className="p-3 bg-muted rounded text-xs overflow-x-auto">
{`{
  "success": false,
  "error": "Rate limit exceeded. 100 requests per month.",
  "limit": 100,
  "remaining": 0,
  "usage": {
    "app": { "today": 5, "month": 45 },
    "dev": { "today": 12, "month": 78 },
    "total": 123
  }
}`}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

