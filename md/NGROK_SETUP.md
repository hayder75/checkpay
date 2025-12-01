# Ngrok Setup Guide

## Why Ngrok?

Ngrok creates a public HTTPS tunnel to your local backend, making it accessible from anywhere (including physical devices on different networks). This is perfect for mobile app development!

## Quick Setup

### 1. Install Ngrok

**Linux:**
```bash
# Download ngrok
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
tar -xzf ngrok-v3-stable-linux-amd64.tgz
sudo mv ngrok /usr/local/bin/

# Or use snap
sudo snap install ngrok
```

**macOS:**
```bash
brew install ngrok/ngrok/ngrok
```

**Windows:**
Download from: https://ngrok.com/download

### 2. Sign Up (Free)

1. Go to https://dashboard.ngrok.com/signup
2. Create a free account
3. Get your authtoken from: https://dashboard.ngrok.com/get-started/your-authtoken

### 3. Configure Ngrok

```bash
ngrok config add-authtoken YOUR_AUTHTOKEN
```

### 4. Start Your Backend

```bash
cd backend
npm run dev
```

Your backend should be running on `http://localhost:3000`

### 5. Start Ngrok Tunnel

In a **new terminal**, run:

```bash
ngrok http 3000
```

You'll see output like:
```
Forwarding   https://abc123def456.ngrok.io -> http://localhost:3000
```

### 6. Update Mobile App Config

1. Open `mobile-app/src/config.ts`
2. Find the `NGROK_URL` constant
3. Replace `'https://your-ngrok-url.ngrok.io'` with your actual ngrok URL
4. Make sure `USE_NGROK = true`

Example:
```typescript
const USE_NGROK = true;
const NGROK_URL = 'https://abc123def456.ngrok.io'; // Your actual ngrok URL
```

### 7. Restart Your Mobile App

The app will now use the ngrok URL to connect to your backend!

## Benefits

✅ **Works from anywhere** - Phone doesn't need to be on same WiFi  
✅ **HTTPS by default** - Secure connection  
✅ **Easy to share** - Share URL with team members  
✅ **No firewall issues** - Ngrok handles all networking  

## Important Notes

⚠️ **Free tier limitations:**
- URL changes every time you restart ngrok (unless you have a paid plan)
- You'll need to update the URL in config.ts each time
- Consider using ngrok's static domain feature (paid)

⚠️ **Security:**
- Your local backend is exposed publicly
- Only use for development, not production
- Consider using ngrok's authentication features

## Troubleshooting

### URL not working?
1. Make sure ngrok is running: `ngrok http 3000`
2. Check the URL in ngrok output matches config.ts
3. Make sure backend is running on port 3000
4. Check ngrok dashboard: https://dashboard.ngrok.com/

### Connection timeout?
1. Verify backend is running: `curl http://localhost:3000/health`
2. Check ngrok tunnel is active (should show "Online" in dashboard)
3. Try restarting ngrok

### Want a static URL?
Upgrade to ngrok paid plan for static domains that don't change.

## Alternative: Keep Using Local IP

If you prefer to use local IP (same WiFi only):
1. Set `USE_NGROK = false` in config.ts
2. Update `LOCAL_IP` to your computer's IP
3. Make sure phone and computer are on same WiFi





