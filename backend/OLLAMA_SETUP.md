# Ollama Local Setup Guide

Ollama allows you to run AI models locally - 100% free, unlimited, and private!

## Installation

### Linux (Manual Install)

```bash
# Download and install Ollama
curl -fsSL https://ollama.com/install.sh | sh
```

Or download from: https://ollama.com/download

### Verify Installation

```bash
ollama --version
```

## Step 2: Pull a Model

Pull a model to use (this downloads it to your machine):

```bash
# Recommended: Llama 3 (good balance of size and quality)
ollama pull llama3

# Alternative: Smaller, faster models
ollama pull mistral
ollama pull phi3

# Larger, more accurate (requires more RAM)
ollama pull llama3:70b
```

**Note:** First download may take a few minutes depending on your internet speed.

## Step 3: Start Ollama Service

Ollama runs as a service. After installation, it should start automatically.

Check if it's running:
```bash
curl http://localhost:11434/api/tags
```

If you see a JSON response with models, it's working!

## Step 4: Test the Setup

Run the test script:
```bash
cd backend
npx tsx test-ollama.ts
```

Or test manually:
```bash
curl http://localhost:11434/api/generate -d '{
  "model": "llama3",
  "prompt": "Hello, how are you?",
  "stream": false
}'
```

## Step 5: Configure (Optional)

The system will automatically detect Ollama if it's running on `localhost:11434`.

You can customize in `.env`:
```env
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3
```

## Available Models

**Recommended for your use case:**
- `llama3` (default) - Good balance, ~4.7GB
- `mistral` - Fast and efficient, ~4.1GB
- `phi3` - Very small, ~2.3GB (good for low RAM)

**Larger models (more accurate, need more RAM):**
- `llama3:70b` - Most accurate, ~40GB
- `llama3:8b` - Good middle ground, ~4.7GB

## System Requirements

**Minimum:**
- 8GB RAM (for llama3)
- 10GB free disk space

**Recommended:**
- 16GB+ RAM
- SSD for faster model loading

## Troubleshooting

### "Connection refused" error
- Make sure Ollama service is running
- Check: `curl http://localhost:11434/api/tags`
- Start service: `ollama serve` (if not running as service)

### "Model not found" error
- Pull the model first: `ollama pull llama3`
- List available models: `ollama list`

### Slow responses
- Use a smaller model (mistral, phi3)
- Close other applications to free up RAM
- First request is slower (model loading), subsequent requests are faster

### Out of memory
- Use a smaller model: `ollama pull phi3`
- Or reduce model size: `ollama pull llama3:8b` instead of `llama3:70b`

## Benefits

✅ **100% Free** - No API costs ever  
✅ **Unlimited** - No rate limits  
✅ **Private** - Data stays on your machine  
✅ **Offline** - Works without internet  
✅ **Fast** - No network latency (after first load)

## How It Works

The system will automatically:
1. Try Hugging Face (if configured)
2. Try OpenAI (if configured)
3. Try Ollama (if running locally) ✅ **You are here**
4. Fall back to rule-based extraction

You can force Ollama by setting:
```env
AI_PROVIDER=ollama
```

## Next Steps

1. Install Ollama: `curl -fsSL https://ollama.com/install.sh | sh`
2. Pull a model: `ollama pull llama3`
3. Test: `npx tsx test-ollama.ts`
4. Start using it! The system will automatically detect it.

## Need Help?

- [Ollama Documentation](https://ollama.com/docs)
- [Available Models](https://ollama.com/library)
- Check `FREE_AI_API_OPTIONS.md` for other alternatives





