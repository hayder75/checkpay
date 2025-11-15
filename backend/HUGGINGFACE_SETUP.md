# Hugging Face Setup Guide

This guide will help you set up Hugging Face Inference API for free AI-powered transaction extraction.

## Step 1: Create Hugging Face Account

1. Go to [https://huggingface.co/](https://huggingface.co/)
2. Click **"Sign Up"** (top right)
3. Create an account (you can use email or GitHub/Google)

## Step 2: Get Your API Token

1. After logging in, click on your profile icon (top right)
2. Go to **Settings** → **Access Tokens**
3. Click **"New token"**
4. Give it a name (e.g., "CheckPay Development")
5. Select **"Read"** permission (sufficient for inference API)
6. Click **"Generate token"**
7. **Copy the token** - it starts with `hf_...` (you won't be able to see it again!)

## Step 3: Add Token to Your .env File

1. Open `backend/.env` file
2. Find the line: `HUGGINGFACE_API_KEY=`
3. Add your token after the `=`:
   ```env
   HUGGINGFACE_API_KEY=hf_your_token_here
   ```
4. Save the file

## Step 4: Verify Setup

You can test if it's working by:

1. **Start your backend server:**
   ```bash
   cd backend
   npm run dev
   ```

2. **Test with a sample SMS** (you can use the pattern creation endpoint or test script)

3. **Check the logs** - you should see Hugging Face being used instead of OpenAI

## Available Models

You can change the model by setting `HUGGINGFACE_MODEL` in your `.env`:

**Recommended models for text extraction:**
- `meta-llama/Llama-3-8B-Instruct` (default) - Good balance of speed and accuracy
- `mistralai/Mistral-7B-Instruct-v0.2` - Fast and efficient
- `google/gemma-7b-it` - Good for structured output
- `meta-llama/Llama-3-70B-Instruct` - More accurate but slower

**Note:** Some models may require you to accept their terms on Hugging Face first.

## ⚠️ Important Note: API Endpoint Migration

**Current Status (January 2025):** Hugging Face has deprecated the old `api-inference.huggingface.co` endpoint and is migrating to a new `router.huggingface.co` endpoint. However, the new endpoint may not be fully available for all models yet.

**If you see "no longer supported" errors:**
- The old endpoint is being phased out
- The new router endpoint may not work for all models yet
- **Recommended alternatives for now:**
  1. **OpenAI** - Use free credits ($5-18 for new accounts)
  2. **Ollama** - Run models locally (100% free, unlimited)
  3. Wait for Hugging Face to complete the migration

## Troubleshooting

### "no longer supported" or "Gone" error
- Hugging Face is migrating endpoints
- Try using a different model (e.g., `mistralai/Mistral-7B-Instruct-v0.2`)
- Or use OpenAI/Ollama as alternatives (see FREE_AI_API_OPTIONS.md)

### "Model is loading" error
- Some models need to be "warmed up" on first use
- Wait 30-60 seconds and try again
- The model will stay loaded for a while after first use

### "Rate limit exceeded"
- Free tier has rate limits
- Wait a few seconds between requests
- Consider using a different model or upgrading

### "No JSON found in response"
- Some models may not return perfect JSON
- Try a different model (Llama-3-8B-Instruct is recommended)
- The system will fall back to rule-based extraction if LLM fails

### "API key not configured"
- Make sure `HUGGINGFACE_API_KEY` is set in `.env`
- Restart your server after adding the key
- Check that there are no extra spaces in the token

## Cost

**Hugging Face Inference API is FREE** for development use! 🎉

- No credit card required
- Rate-limited but sufficient for development
- Perfect for testing and prototyping

## Next Steps

Once set up, the system will automatically:
1. Try Hugging Face first (if configured)
2. Fall back to OpenAI (if configured)
3. Fall back to Ollama (if running locally)
4. Fall back to rule-based extraction (if no AI available)

You can force a specific provider by setting:
```env
AI_PROVIDER=huggingface  # or 'openai', 'ollama'
```

Or let it auto-detect:
```env
AI_PROVIDER=auto  # tries all available providers
```

## Need Help?

- [Hugging Face Inference API Docs](https://huggingface.co/docs/api-inference/index)
- [Available Models](https://huggingface.co/models?pipeline_tag=text-generation)
- Check `FREE_AI_API_OPTIONS.md` for other free alternatives

