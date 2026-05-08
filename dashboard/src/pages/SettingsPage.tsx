import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { authAPI, auth, businessAPI } from '@/lib';
import { COUNTRIES_LIST } from '@/utils/countries';
import { useToast } from '@/components/ui/use-toast';
import { Copy, RefreshCw, Save, Key, User, Lock, Eye, EyeOff, Building2, Bell, Shield, Palette, Smartphone, QrCode, Timer } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function SettingsPage() {
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [businesses, setBusinesses] = useState<any[]>([]);
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);
  
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false });
  const [countries] = useState(COUNTRIES_LIST);

  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrToken, setQrToken] = useState<string>('');
  const [qrLoading, setQrLoading] = useState(false);
  const [qrCountdown, setQrCountdown] = useState(0);

  const loadUser = async () => {
    try {
      const res = await authAPI.getMe();
      setUser(res.data.data);
      setUsername(res.data.data.username || '');
      setPhone(res.data.data.phone || '');
      setCountry(res.data.data.country || '');
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to load user", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUser(); }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (qrCountdown > 0) {
      interval = setInterval(() => {
        setQrCountdown((prev) => {
          if (prev <= 1) {
            setQrCode(null);
            setQrToken('');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [qrCountdown]);

  const handleUpdateProfile = async () => {
    if (!username.trim()) {
      toast({ title: "Error", description: "Username is required", variant: "destructive" });
      return;
    }
    setUpdatingProfile(true);
    try {
      await authAPI.updateProfile({ username, phone, country });
      toast({ title: "Success", description: "Profile updated successfully" });
      loadUser();
    } catch (error: any) {
      toast({ title: "Error", description: error.response?.data?.error || "Failed to update profile", variant: "destructive" });
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({ title: "Error", description: "All password fields are required", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "New passwords do not match", variant: "destructive" });
      return;
    }
    setUpdatingPassword(true);
    try {
      await authAPI.updatePassword({ currentPassword, newPassword });
      toast({ title: "Success", description: "Password updated successfully" });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast({ title: "Error", description: error.response?.data?.error || "Failed to update password", variant: "destructive" });
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleRegenerateApiKey = async () => {
    setRegenerating(true);
    try {
      await authAPI.regenerateKey();
      toast({ title: "Success", description: "API key regenerated" });
      loadUser();
    } catch (error: any) {
      toast({ title: "Error", description: error.response?.data?.error || "Failed to regenerate API key", variant: "destructive" });
    } finally {
      setRegenerating(false);
    }
  };

  const handleCopyApiKey = () => {
    if (user?.apiKey) {
      navigator.clipboard.writeText(user.apiKey);
      toast({ title: "Copied", description: "API key copied to clipboard" });
    }
  };

  const handleGenerateQrCode = async () => {
    setQrLoading(true);
    try {
      const res = await authAPI.generateQrSignup();
      setQrCode(res.data.data.qrCode);
      setQrToken(res.data.data.token || '');
      setQrCountdown(res.data.data.expiresIn);
      toast({ title: "Success", description: "QR code generated. Scan with mobile app." });
    } catch (error: any) {
      toast({ title: "Error", description: error.response?.data?.error || "Failed to generate QR code", variant: "destructive" });
    } finally {
      setQrLoading(false);
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

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-4xl">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your account settings and preferences
          </p>
        </div>

        <Separator />

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="profile" className="gap-2"><User className="h-4 w-4" /> Profile</TabsTrigger>
            <TabsTrigger value="security" className="gap-2"><Shield className="h-4 w-4" /> Security</TabsTrigger>
            <TabsTrigger value="api" className="gap-2"><Key className="h-4 w-4" /> API</TabsTrigger>
            <TabsTrigger value="mobile" className="gap-2"><Smartphone className="h-4 w-4" /> Mobile</TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2"><Bell className="h-4 w-4" /> Notifications</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your personal information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" value={user?.email || ''} disabled className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1234567890" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <select 
                      id="country" 
                      value={country} 
                      onChange={(e) => setCountry(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Select country</option>
                      {countries.map((c) => (
                        <option key={c.code} value={c.code}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-medium">Role: {user?.role}</p>
                    <p className="text-sm text-muted-foreground">Plan: {user?.plan || 'Free'}</p>
                  </div>
                </div>
                <Button onClick={handleUpdateProfile} disabled={updatingProfile}>
                  <Save className="h-4 w-4 mr-2" />
                  {updatingProfile ? 'Saving...' : 'Save Changes'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>Update your password to keep your account secure</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4 max-w-md">
                  <div className="space-y-2">
                    <Label htmlFor="current">Current Password</Label>
                    <div className="relative">
                      <Input 
                        id="current" 
                        type={showPasswords.current ? "text" : "password"}
                        value={currentPassword} 
                        onChange={(e) => setCurrentPassword(e.target.value)} 
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowPasswords(p => ({ ...p, current: !p.current }))}
                      >
                        {showPasswords.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new">New Password</Label>
                    <Input 
                      id="new" 
                      type={showPasswords.new ? "text" : "password"}
                      value={newPassword} 
                      onChange={(e) => setNewPassword(e.target.value)} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm">Confirm New Password</Label>
                    <Input 
                      id="confirm" 
                      type={showPasswords.new ? "text" : "password"}
                      value={confirmPassword} 
                      onChange={(e) => setConfirmPassword(e.target.value)} 
                    />
                  </div>
                </div>
                <Button onClick={handleUpdatePassword} disabled={updatingPassword}>
                  <Lock className="h-4 w-4 mr-2" />
                  {updatingPassword ? 'Updating...' : 'Update Password'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="api">
            <Card>
              <CardHeader>
                <CardTitle>API Key</CardTitle>
                <CardDescription>Your API key for authenticating requests</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Input 
                    value={user?.apiKey || ''} 
                    readOnly 
                    className="font-mono"
                  />
                  <Button variant="outline" onClick={handleCopyApiKey}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="destructive" onClick={handleRegenerateApiKey} disabled={regenerating}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${regenerating ? 'animate-spin' : ''}`} />
                    {regenerating ? 'Regenerating...' : 'Regenerate Key'}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Warning: Regenerating your API key will invalidate the old key.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mobile">
            <Card>
              <CardHeader>
                <CardTitle>Link Mobile App</CardTitle>
                <CardDescription>Connect your mobile app to access your account</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col items-center gap-4 p-6 bg-muted rounded-lg">
                  {qrCode ? (
                    <>
                      <QRCodeSVG value={qrToken} size={256} />
                      <div className="flex items-center gap-2 text-sm">
                        <Timer className="h-4 w-4" />
                        <span>Expires in {Math.floor(qrCountdown / 60)}:{(qrCountdown % 60).toString().padStart(2, '0')}</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <QrCode className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">Click generate to create a QR code</p>
                    </div>
                  )}
                  <Button onClick={handleGenerateQrCode} disabled={qrLoading} className="w-full max-w-xs">
                    <QrCode className="h-4 w-4 mr-2" />
                    {qrLoading ? 'Generating...' : qrCode ? 'Regenerate QR Code' : 'Generate QR Code'}
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p><strong>How to link:</strong></p>
                  <ol className="list-decimal list-inside mt-2 space-y-1">
                    <li>Open the CheckPay mobile app</li>
                    <li>Go to Settings → Link Account</li>
                    <li>Scan the QR code above</li>
                    <li>Your accounts will be linked automatically</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Manage how you receive notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {[
                  { id: 'email', label: 'Email Notifications', desc: 'Receive notifications via email' },
                  { id: 'sms', label: 'SMS Notifications', desc: 'Receive notifications via SMS' },
                  { id: 'transactions', label: 'Transaction Alerts', desc: 'Get notified about new transactions' },
                ].map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch defaultChecked id={item.id} />
                  </div>
                ))}
                <Button>
                  <Save className="h-4 w-4 mr-2" />
                  Save Preferences
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
