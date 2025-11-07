import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { authAPI } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Download, Smartphone } from 'lucide-react';

export default function MobileAppPage() {
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const response = await authAPI.getMe();
      setUser(response.data.data);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to load user',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  const apkUrl = 'https://checkpay.com/download/CheckPay.apk'; // Replace with actual URL

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold">Mobile App</h1>
          <p className="text-muted-foreground">Download and set up the CheckPay mobile app</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Download APK
              </CardTitle>
              <CardDescription>Scan QR code or download directly</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-center p-4 bg-white rounded-md">
                <QRCodeSVG value={apkUrl} size={200} />
              </div>
              <Button
                className="w-full bg-[#F37100] hover:bg-[#F37100]/90"
                onClick={() => window.open(apkUrl, '_blank')}
              >
                <Download className="mr-2 h-4 w-4" />
                Download APK
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your API Key</CardTitle>
              <CardDescription>Enter this in the mobile app</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-muted rounded-md text-sm break-all">
                  {user?.apiKey}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(user?.apiKey || '');
                    toast({
                      title: 'Copied',
                      description: 'API key copied to clipboard',
                    });
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Setup Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Download the CheckPay APK file using the QR code or direct download button</li>
              <li>Enable "Install from Unknown Sources" in your Android device settings</li>
              <li>Install the APK file on your phone</li>
              <li>Open the CheckPay app</li>
              <li>Enter your API key (shown above)</li>
              <li>Grant SMS permissions when prompted</li>
              <li>The app will run in the background and automatically parse financial SMS</li>
            </ol>
            <div className="mt-4 p-4 bg-muted rounded-md">
              <p className="text-sm font-medium mb-2">Note:</p>
              <p className="text-sm text-muted-foreground">
                The app only parses SMS that match your saved patterns. All sender phone numbers
                are automatically masked for privacy. Transactions are sent to your CheckPay
                dashboard in real-time.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
