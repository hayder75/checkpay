# OpenAI Setup Guide - Free Credits

This guide will help you set up OpenAI API with free credits for AI-powered transaction extraction.

## Step 1: Create OpenAI Account & Get Free Credits

1. Go to [https://platform.openai.com/](https://platform.openai.com/)
2. Click **"Sign Up"** (or "Log In" if you have an account)
3. Create an account (you can use email, Google, or Microsoft)
4. **New accounts get $5-18 in free credits!** 🎉
5. You may need to add a payment method, but **you won't be charged** if you stay within the free tier limits

## Step 2: Get Your API Key

1. After logging in, click on your profile icon (top right)
2. Go to **"API keys"** (or visit https://platform.openai.com/api-keys)
3. Click **"Create new secret key"**
4. Give it a name (e.g., "CheckPay Development")
5. **Copy the key immediately** - it starts with `sk-...` (you won't be able to see it again!)
6. Click **"Create secret key"**

## Step 3: Add Key to Your .env File

1. Open `backend/.env` file
2. Find the line: `OPENAI_API_KEY=` (or add it if it doesn't exist)
3. Add your key after the `=`:
   ```env
   OPENAI_API_KEY=sk-your-key-here
   ```
4. (Optional) Set the model:
   ```env
   OPENAI_MODEL=gpt-4o-mini
   ```
5. Save the file

## Step 4: Install OpenAI Package (if needed)

```bash
cd backend
npm install openai
```

## Step 5: Test the Setup

Run the test script:
```bash
cd backend
npx tsx test-openai.ts
```

Or test with your backend server - the system will automatically use OpenAI if configured.

## Cost Information

**Free Credits:**
- New accounts: $5-18 free credits
- Credits expire after 3 months (for free credits)

**Pricing (after free credits):**
- **GPT-4o-mini**: ~$0.00015 per SMS (very affordable)
- **GPT-4**: ~$0.003 per SMS (more accurate)

**For 1000 SMS with GPT-4o-mini:**
- If 10% need LLM: ~$0.15/day
- Very affordable for the value provided

## Available Models

You can change the model in `.env`:

- `gpt-4o-mini` (default) - Best balance of cost and accuracy
- `gpt-4o` - More accurate, slightly more expensive
- `gpt-3.5-turbo` - Cheaper but less accurate

## Troubleshooting

### "Insufficient quota" error
- You've used up your free credits
- Add payment method to continue (or use Ollama/Hugging Face)

### "Invalid API key"
- Check that the key starts with `sk-`
- Make sure there are no extra spaces
- Regenerate the key if needed

### "Rate limit exceeded"
- Free tier has rate limits
- Wait a few seconds between requests
- Consider upgrading or using Ollama for unlimited requests

## Next Steps

Once set up, the system will automatically:
1. Try Hugging Face first (if configured and working)
2. Fall back to OpenAI (if configured) ✅ **You are here**
3. Fall back to Ollama (if running locally)
4. Fall back to rule-based extraction (if no AI available)

You can force OpenAI by setting:
```env
AI_PROVIDER=openai
```

Or let it auto-detect:
```env
AI_PROVIDER=auto  # tries all available providers
```

## Need Help?

- [OpenAI API Documentation](https://platform.openai.com/docs)
- [OpenAI Pricing](https://openai.com/api/pricing/)
- Check `FREE_AI_API_OPTIONS.md` for other free alternatives





