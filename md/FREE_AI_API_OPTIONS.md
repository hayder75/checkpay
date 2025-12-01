# Free AI API Options for Development

This document lists free AI API options suitable for development and testing of transaction ID extraction.

## 🆓 Best Free Options for Development

### 1. **Hugging Face Inference API** ⭐ (Recommended for Free Development)

**Why it's great:**
- ✅ **Completely free** - No credit card required
- ✅ **No API key needed** for basic usage (or free token)
- ✅ Multiple open-source models (Llama, Mistral, etc.)
- ✅ Good for text extraction tasks
- ✅ Simple REST API

**Limitations:**
- Rate-limited (but fine for development)
- May be slower than paid APIs
- Some models may have lower accuracy than GPT-4

**Setup:**
1. Go to https://huggingface.co/
2. Create a free account
3. Get your API token (Settings → Access Tokens)
4. Use models like:
   - `meta-llama/Llama-3-8B-Instruct`
   - `mistralai/Mistral-7B-Instruct-v0.2`
   - `google/gemma-7b-it`

**Example Usage:**
```typescript
const response = await fetch(
  'https://api-inference.huggingface.co/models/meta-llama/Llama-3-8B-Instruct',
  {
    headers: {
      'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
    body: JSON.stringify({
      inputs: `Extract transaction ID from this SMS: "${smsText}". Return JSON with txnId, amount, currency, bank.`,
    }),
  }
);
```

**Cost:** Free (with rate limits)

---

### 2. **OpenAI API** (Free Credits)

**Why it's great:**
- ✅ **$5-18 free credits** for new accounts
- ✅ Already integrated in your codebase
- ✅ High accuracy (GPT-4o-mini)
- ✅ Fast and reliable

**Limitations:**
- Credits expire after 3 months
- Requires credit card (but won't charge if you stay within free tier)
- After credits run out, you pay per use

**Setup:**
1. Go to https://platform.openai.com/
2. Sign up for account
3. Add payment method (won't charge if you stay within free tier)
4. Get $5-18 free credits

**Cost:** Free credits, then ~$0.00015 per SMS (GPT-4o-mini)

---

### 3. **Google Cloud Natural Language API** (Free Tier)

**Why it's great:**
- ✅ **5,000 units/month free**
- ✅ Good for entity extraction
- ✅ Reliable Google infrastructure

**Limitations:**
- Requires Google Cloud account setup
- More complex setup
- Better for entity extraction than structured JSON output

**Setup:**
1. Go to https://cloud.google.com/
2. Create free account ($300 free credits)
3. Enable Natural Language API
4. Get API key

**Cost:** 5,000 units/month free, then pay-per-use

---

### 4. **Cohere API** (Free Tier)

**Why it's great:**
- ✅ Free tier available
- ✅ Good for text extraction
- ✅ Simple API

**Limitations:**
- Check current free tier limits
- May require credit card

**Cost:** Free tier (check current limits)

---

### 5. **Local AI with Ollama** (100% Free, No Limits)

**Why it's great:**
- ✅ **Completely free** - No API costs ever
- ✅ **No rate limits**
- ✅ **Privacy-focused** - Data stays local
- ✅ Works offline

**Limitations:**
- Requires local setup
- Needs decent hardware (8GB+ RAM recommended)
- May be slower than cloud APIs

**Setup:**
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model
ollama pull llama3

# Use via API
curl http://localhost:11434/api/generate -d '{
  "model": "llama3",
  "prompt": "Extract transaction ID from: ..."
}'
```

**Cost:** Free (runs locally)

---

## 🎯 Recommendation for Development

**For quick development/testing:**
1. **Hugging Face Inference API** - Easiest to set up, completely free
2. **OpenAI free credits** - If you already have an account

**For production:**
- **OpenAI GPT-4o-mini** - Best balance of cost and accuracy
- **Hugging Face** - If you want to avoid API costs

**For privacy-sensitive development:**
- **Ollama (local)** - Run models on your machine

---

## 💡 Implementation Tips

1. **Use environment variables** to switch between providers:
   ```env
   AI_PROVIDER=huggingface  # or 'openai', 'ollama', etc.
   HUGGINGFACE_API_KEY=hf_...
   OPENAI_API_KEY=sk-...
   ```

2. **Add fallback logic** - Try free API first, fall back to paid if needed

3. **Cache results** - Don't call API for same SMS twice

4. **Rate limiting** - Respect free tier limits

---

## 📊 Comparison Table

| Provider | Free Tier | Setup Difficulty | Accuracy | Speed | Best For |
|----------|-----------|------------------|----------|-------|----------|
| Hugging Face | ✅ Yes | Easy | Good | Medium | Development |
| OpenAI | ✅ Credits | Easy | Excellent | Fast | Production |
| Google Cloud | ✅ 5K/month | Medium | Good | Fast | Enterprise |
| Cohere | ✅ Limited | Easy | Good | Fast | NLP Tasks |
| Ollama | ✅ Unlimited | Medium | Good | Medium | Privacy |

---

## 🔗 Quick Links

- [Hugging Face Inference API](https://huggingface.co/docs/api-inference/index)
- [OpenAI API](https://platform.openai.com/docs)
- [Google Cloud AI](https://cloud.google.com/ai)
- [Ollama](https://ollama.com/)
- [Cohere API](https://cohere.com/)





