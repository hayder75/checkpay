# How to Find Your Computer's IP Address

## The Problem
When testing on a physical device, `localhost` refers to the device itself, not your computer. You need your computer's IP address.

## Find Your IP

### Linux:
```bash
hostname -I
# or
ip addr show | grep "inet " | grep -v 127.0.0.1
```

### Mac:
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

### Windows:
```bash
ipconfig
# Look for "IPv4 Address" under your active network adapter
```

## Update Mobile App Config

1. Find your IP (e.g., `192.168.1.100`)
2. Edit `mobile-app/src/config.ts`
3. Replace `192.168.1.100` with your actual IP
4. Make sure phone and computer are on same WiFi network

## Quick Fix

The app is currently set to use `10.0.2.2` for Android emulator (works automatically).

For physical device, update line in `src/config.ts`:
```typescript
return 'http://YOUR_IP_HERE:3000/api'; // CHANGE THIS TO YOUR IP
```

## Test Connection

After updating, test if backend is reachable:
```bash
# From your phone's browser or terminal
curl http://YOUR_IP:3000/health
```

If it works, the mobile app will connect!
