import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { verifyAPI } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card } from '../../components/ui/card';
import { Label } from '../../components/ui/label';
import { useToast } from '../../components/ui/use-toast';

interface VerifyResult {
  confirmed: boolean;
  amount?: number;
  currency?: string;
  sender?: string;
  bank?: string;
  receivedAt?: string;
  txnId?: string;
  message?: string;
}

export default function VerifyPage() {
  const { merchantId } = useParams<{ merchantId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [txnId, setTxnId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [merchantInfo, setMerchantInfo] = useState<any>(null);

  useEffect(() => {
    // Load merchant info if merchantId is provided
    if (merchantId) {
      // TODO: Load merchant info from API
      // For now, just set a placeholder
      setMerchantInfo({ id: merchantId, name: 'Merchant' });
    }
  }, [merchantId]);

  const handleVerify = async () => {
    if (!txnId.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a transaction ID',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // For merchant portal, we need to get merchant's API key
      // This would typically be stored server-side or passed as a parameter
      // For now, we'll use a placeholder - in production, this should be handled securely
      
      // Option 1: Merchant API key is stored server-side and retrieved by merchantId
      // Option 2: Merchant provides API key during setup
      // For MVP, we'll use a direct API call (merchant would need to configure their API key)
      
      // TODO: Implement proper merchant API key retrieval
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/verify?txn=${encodeURIComponent(txnId.trim())}`,
        {
          headers: {
            'X-API-Key': 'MERCHANT_API_KEY', // This should be retrieved from merchantId
          },
        }
      );

      const data = await response.json();

      if (data.success) {
        setResult(data.data);
        
        if (data.data.confirmed) {
          toast({
            title: 'Payment Verified ✅',
            description: `Transaction confirmed: ${data.data.amount} ${data.data.currency || ''}`,
          });
        } else {
          toast({
            title: 'Transaction Not Found',
            description: data.data.message || 'Transaction not found in our system',
            variant: 'destructive',
          });
        }
      } else {
        throw new Error(data.error || 'Verification failed');
      }
    } catch (error: any) {
      console.error('Verification error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to verify transaction',
        variant: 'destructive',
      });
      setResult({
        confirmed: false,
        message: 'Failed to verify transaction. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-2">Payment Verification</h1>
          {merchantInfo && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {merchantInfo.name}
            </p>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="txnId">Transaction ID</Label>
            <Input
              id="txnId"
              type="text"
              placeholder="Enter transaction ID"
              value={txnId}
              onChange={(e) => setTxnId(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleVerify();
                }
              }}
              disabled={loading}
              className="mt-2"
            />
          </div>

          <Button
            onClick={handleVerify}
            disabled={loading || !txnId.trim()}
            className="w-full"
          >
            {loading ? 'Verifying...' : 'Verify Payment'}
          </Button>

          {result && (
            <div className={`mt-6 p-4 rounded-lg ${
              result.confirmed
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
            }`}>
              {result.confirmed ? (
                <>
                  <div className="flex items-center mb-3">
                    <span className="text-2xl mr-2">✅</span>
                    <h3 className="font-semibold text-green-800 dark:text-green-200">
                      Payment Confirmed
                    </h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Amount:</span>
                      <span className="font-semibold">
                        {result.amount} {result.currency || ''}
                      </span>
                    </div>
                    {result.bank && (
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Bank:</span>
                        <span className="font-semibold">{result.bank}</span>
                      </div>
                    )}
                    {result.sender && (
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">From:</span>
                        <span className="font-semibold">{result.sender}</span>
                      </div>
                    )}
                    {result.receivedAt && (
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Date:</span>
                        <span className="font-semibold">
                          {new Date(result.receivedAt).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {result.txnId && (
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Transaction ID:</span>
                        <span className="font-mono text-xs">{result.txnId}</span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center mb-2">
                    <span className="text-2xl mr-2">❌</span>
                    <h3 className="font-semibold text-red-800 dark:text-red-200">
                      Transaction Not Found
                    </h3>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {result.message || 'This transaction ID was not found in our system. Please check the ID and try again.'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                    💡 The payment might still be processing. Please wait a few moments and try again.
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
          <p>Powered by CheckPay</p>
        </div>
      </Card>
    </div>
  );
}





