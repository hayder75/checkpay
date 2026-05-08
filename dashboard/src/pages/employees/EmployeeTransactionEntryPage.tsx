import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ingestAPI, authAPI, businessAPI } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { Camera, FileText, Plus } from 'lucide-react';

export default function EmployeeTransactionEntryPage() {
  const { toast } = useToast();
  const [, setUser] = useState<any>(null);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    txnId: '',
    amount: '',
    sender: '',
    smsText: '',
    senderBank: '',
    receiverBank: '',
    bank: '',
  });
  const [entryMethod, setEntryMethod] = useState<'OCR' | 'MANUAL'>('MANUAL');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [userRes, businessesRes] = await Promise.all([
        authAPI.getMe(),
        businessAPI.getAll().catch(() => ({ data: { data: [] } })),
      ]);
      setUser(userRes.data.data);
      const businessList = businessesRes.data.data || [];
      setBusinesses(businessList);
      if (businessList.length > 0) {
        setSelectedBusinessId(businessList[0].id);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to load data',
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBusinessId) {
      toast({
        title: 'Error',
        description: 'Please select a business',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      await ingestAPI.ingest({
        txnId: formData.txnId,
        amount: parseFloat(formData.amount),
        sender: formData.sender,
        businessId: selectedBusinessId,
        source: entryMethod,
        smsText: formData.smsText || undefined,
        senderBank: formData.senderBank || undefined,
        receiverBank: formData.receiverBank || undefined,
        bank: formData.bank || undefined,
      });
      toast({
        title: 'Success',
        description: 'Transaction recorded successfully',
      });
      // Reset form
      setFormData({
        txnId: '',
        amount: '',
        sender: '',
        smsText: '',
        senderBank: '',
        receiverBank: '',
        bank: '',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to record transaction',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOCRScan = () => {
    // TODO: Implement OCR scanning
    toast({
      title: 'Coming Soon',
      description: 'OCR scanning will be available soon',
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Record Transaction</h1>
          <p className="text-muted-foreground">Enter transaction details manually or via OCR</p>
        </div>

        {businesses.length > 0 && (
          <div>
            <Label htmlFor="business">Business</Label>
            <select
              id="business"
              value={selectedBusinessId}
              onChange={(e) => setSelectedBusinessId(e.target.value)}
              className="w-full max-w-xs mt-2 px-3 py-2 border rounded-md"
            >
              {businesses.map((business) => (
                <option key={business.id} value={business.id}>
                  {business.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Transaction Entry</CardTitle>
                <CardDescription>Record a new transaction</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={entryMethod === 'MANUAL' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEntryMethod('MANUAL')}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Manual
                </Button>
                <Button
                  variant={entryMethod === 'OCR' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setEntryMethod('OCR');
                    handleOCRScan();
                  }}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  OCR
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="txnId">Transaction ID *</Label>
                  <Input
                    id="txnId"
                    value={formData.txnId}
                    onChange={(e) => setFormData({ ...formData, txnId: e.target.value })}
                    required
                    placeholder="e.g., TXN123456"
                  />
                </div>
                <div>
                  <Label htmlFor="amount">Amount *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="sender">Sender *</Label>
                <Input
                  id="sender"
                  value={formData.sender}
                  onChange={(e) => setFormData({ ...formData, sender: e.target.value })}
                  required
                  placeholder="Sender name or phone number"
                />
              </div>

              {entryMethod === 'OCR' && (
                <div>
                  <Label htmlFor="smsText">SMS Text (for OCR)</Label>
                  <Textarea
                    id="smsText"
                    value={formData.smsText}
                    onChange={(e) => setFormData({ ...formData, smsText: e.target.value })}
                    placeholder="Paste SMS text here for OCR processing"
                    rows={4}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="senderBank">Sender Bank</Label>
                  <Input
                    id="senderBank"
                    value={formData.senderBank}
                    onChange={(e) => setFormData({ ...formData, senderBank: e.target.value })}
                    placeholder="e.g., Bank of America"
                  />
                </div>
                <div>
                  <Label htmlFor="receiverBank">Receiver Bank</Label>
                  <Input
                    id="receiverBank"
                    value={formData.receiverBank}
                    onChange={(e) => setFormData({ ...formData, receiverBank: e.target.value })}
                    placeholder="e.g., Chase"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="bank">Bank (General)</Label>
                <Input
                  id="bank"
                  value={formData.bank}
                  onChange={(e) => setFormData({ ...formData, bank: e.target.value })}
                  placeholder="Bank name if different"
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-[#F37100] hover:bg-[#F37100]/90"
                disabled={loading || !selectedBusinessId}
              >
                <Plus className="h-4 w-4 mr-2" />
                {loading ? 'Recording...' : 'Record Transaction'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}


