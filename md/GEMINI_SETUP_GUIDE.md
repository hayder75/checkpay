# Gemini AI Setup Guide

## 🎯 Quick Setup

### **Step 1: Get Gemini API Key (FREE)**

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Copy the API key (starts with something like `AIza...`)

**Note:** Gemini has a generous free tier - perfect for development and testing!

---

### **Step 2: Add to .env File**

Open your `.env` file in the `backend` directory:

```bash
cd backend
nano .env  # or use your preferred editor
```

Add these lines:

```env
# AI Provider Configuration
AI_PROVIDER=auto  # or 'gemini' to force Gemini

# Google Gemini (FREE tier available - Recommended)
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-2.5-flash-lite-preview-06-17
```

**Example:**
```env
AI_PROVIDER=auto
GEMINI_API_KEY=AIzaSyB1234567890abcdefghijklmnopqrstuvwxyz
GEMINI_MODEL=gemini-2.5-flash-lite-preview-06-17
```

---

### **Step 3: Test the Setup**

Run the test script:

```bash
cd backend
npx tsx test-gemini.ts
```

**Expected Output:**
```
🧪 Testing Gemini Setup...

✅ GEMINI_API_KEY found
📦 Model: gemini-2.5-flash-lite-preview-06-17
🔧 Provider: auto

⏳ Calling Gemini API...

✅ Gemini API Response:
{
  "txnId": "MP123456789",
  "amount": 100.50,
  "currency": "KES",
  "bank": "M-Pesa",
  ...
}

🎉 Gemini is working correctly!
💡 Gemini has a generous free tier!
```

---

### **Step 4: Restart Backend Server**

If your backend is running, restart it to load the new environment variables:

```bash
# Stop the server (Ctrl+C)
# Then restart
npm run dev
```

---

## ✅ Verification

### **Check if Gemini is Configured:**

```bash
cd backend
grep GEMINI .env
```

Should show:
```
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-2.5-flash-lite-preview-06-17
```

### **Test Pattern Creation with AI:**

Once configured, the onboarding pattern creation will use Gemini AI automatically.

---

## 🔧 Configuration Options

### **AI Provider Selection**

You can control which AI provider to use:

```env
# Try all available providers (Gemini → OpenAI → Hugging Face → Ollama)
AI_PROVIDER=auto

# Force Gemini only
AI_PROVIDER=gemini

# Force OpenAI only
AI_PROVIDER=openai
```

### **Gemini Model Options**

Available models:

```env
# Fast, lightweight model (recommended)
GEMINI_MODEL=gemini-2.5-flash-lite-preview-06-17

# Standard model
GEMINI_MODEL=gemini-2.5-flash

# Pro model (more accurate, slower)
GEMINI_MODEL=gemini-2.5-pro
```

---

## 🐛 Troubleshooting

### **Error: "Gemini API key not configured"**

**Solution:**
1. Check that `GEMINI_API_KEY` is in your `.env` file
2. Make sure there are no spaces around the `=` sign
3. Restart your backend server

### **Error: "API key is invalid"**

**Solution:**
1. Verify your API key at [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Make sure you copied the entire key (no truncation)
3. Check for any extra spaces or quotes in `.env`

### **Error: "Quota exceeded"**

**Solution:**
1. Check your usage at [Google AI Studio](https://aistudio.google.com/usage)
2. Free tier has generous limits, but check if you've exceeded them
3. Wait for quota reset or upgrade if needed

### **Test Script Fails**

**Solution:**
1. Make sure you're in the `backend` directory
2. Check that `test-gemini.ts` exists
3. Run: `npm install` to ensure dependencies are installed
4. Check Node.js version (should be 18+)

---

## 📊 What Gemini is Used For

### **Current Usage:**
1. **Onboarding Pattern Creation** (`/api/patterns/create-from-sample`)
   - Extracts transaction data from SMS
   - Validates extracted transaction ID
   - Generates regex pattern

### **Future Usage (After Implementation):**
2. **Regular Pattern Creation** (`/api/patterns`)
   - When transaction ID is provided
   - AI-powered extraction and validation
   - Better accuracy than rule-based

---

## 💰 Pricing

**Gemini Free Tier:**
- ✅ 15 requests per minute (RPM)
- ✅ 1,500 requests per day (RPD)
- ✅ Perfect for development and testing
- ✅ No credit card required

**For Production:**
- Check [Gemini Pricing](https://ai.google.dev/pricing) for higher limits
- Free tier is usually sufficient for most use cases

---

## 🔗 Useful Links

- [Google AI Studio](https://aistudio.google.com/app/apikey) - Get API key
- [Gemini API Documentation](https://ai.google.dev/docs) - API reference
- [Gemini Models](https://ai.google.dev/models/gemini) - Available models
- [Pricing](https://ai.google.dev/pricing) - Pricing information

---

## ✅ Checklist

- [ ] Got API key from Google AI Studio
- [ ] Added `GEMINI_API_KEY` to `.env` file
- [ ] Added `GEMINI_MODEL` to `.env` file
- [ ] Tested with `npx tsx test-gemini.ts`
- [ ] Restarted backend server
- [ ] Verified onboarding pattern creation works

---

## 🎉 You're All Set!

Once configured, Gemini AI will automatically be used for:
- ✅ Onboarding pattern creation (mobile app)
- ✅ Future: Regular pattern creation (when transaction ID provided)

The system will fall back to rule-based extraction if:
- Gemini API key is not configured
- API call fails
- Quota is exceeded


