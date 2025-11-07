# Developer Integration Flow

## How Developers Use CheckPay

### The Complete Flow

1. **User Makes Payment**
   - User pays via mobile money (M-Pesa, Airtel Money, etc.)
   - Gets a transaction ID (e.g., "MP123456789")

2. **Mobile App Scrapes Transaction**
   - CheckPay mobile app reads SMS
   - Extracts transaction details (amount, ID, sender, bank)
   - Sends to CheckPay backend via `/api/ingest`
   - **Transaction saved to database**

3. **Developer's Frontend**
   - User enters transaction ID on developer's website
   - Developer's frontend sends transaction ID to their backend

4. **Developer's Backend Calls CheckPay**
   ```
   GET /api/verify?key=DEV_API_KEY&txn=MP123456789
   ```

5. **CheckPay Response**
   - **Success**: `{ confirmed: true, amount, sender, bank, receivedAt }`
   - **Not Found**: `{ confirmed: false, message: "Transaction not found" }`

6. **Developer's Backend**
   - If `confirmed: true` → Release product, send receipt, update order status
   - If `confirmed: false` → Ask user to wait or try again

### Important: Delays & Retry Logic

**Why delays happen:**
- SMS might arrive 1-30 seconds after payment
- Mobile app needs time to scrape and send to backend
- Network latency

**Best Practice:**
```javascript
// Developer should implement retry logic
async function verifyPayment(txnId, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await checkPayAPI.verify(txnId);
    
    if (response.confirmed) {
      return response; // Payment confirmed!
    }
    
    // Wait before retrying (exponential backoff)
    await sleep(2000 * (i + 1)); // 2s, 4s, 6s, 8s, 10s
  }
  
  return { confirmed: false, message: "Payment not found after retries" };
}
```

### Example Integration

**Developer's Frontend (React):**
```jsx
function PaymentVerification() {
  const [txnId, setTxnId] = useState('');
  const [verifying, setVerifying] = useState(false);
  
  const handleVerify = async () => {
    setVerifying(true);
    
    // Send to developer's backend
    const response = await fetch('/api/verify-payment', {
      method: 'POST',
      body: JSON.stringify({ txnId })
    });
    
    const result = await response.json();
    
    if (result.confirmed) {
      // Show success, release product
    } else {
      // Show "Payment not found, please wait..."
    }
    
    setVerifying(false);
  };
  
  return (
    <div>
      <input 
        value={txnId} 
        onChange={e => setTxnId(e.target.value)}
        placeholder="Enter transaction ID"
      />
      <button onClick={handleVerify} disabled={verifying}>
        {verifying ? 'Verifying...' : 'Verify Payment'}
      </button>
    </div>
  );
}
```

**Developer's Backend (Node.js):**
```javascript
app.post('/api/verify-payment', async (req, res) => {
  const { txnId } = req.body;
  
  // Call CheckPay API
  const checkPayResponse = await fetch(
    `https://api.checkpay.com/api/verify?key=${DEV_API_KEY}&txn=${txnId}`
  );
  
  const data = await checkPayResponse.json();
  
  if (data.success && data.data.confirmed) {
    // Payment confirmed!
    // Update order status, release product, etc.
    await updateOrderStatus(txnId, 'paid');
    res.json({ success: true, payment: data.data });
  } else {
    // Payment not found yet
    res.json({ success: false, message: 'Payment not found. Please wait...' });
  }
});
```

### Summary

✅ **Correct Flow:**
1. User pays → Gets transaction ID
2. Mobile app scrapes → Saves to CheckPay DB
3. Developer's user enters transaction ID
4. Developer's backend calls CheckPay `/api/verify`
5. CheckPay checks DB → Returns `confirmed: true/false`
6. Developer releases product if confirmed

⚠️ **Important:**
- Add retry logic (payment might not be in DB immediately)
- Show "Please wait..." message to users
- Implement exponential backoff (2s, 4s, 6s...)
- Maximum wait time: ~30 seconds

