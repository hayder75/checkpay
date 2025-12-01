# Quick Build Guide - Step by Step

## ✅ What I've Done For You

1. ✅ Fixed port 8081 issue
2. ✅ Re-enabled expo-dev-client in app.json
3. ✅ Created eas.json configuration file

---

## 🚀 Now Do These Steps (In Your Terminal)

### **Step 1: Login to Expo** (Interactive - will open browser)

Open your terminal and run:

```bash
cd /home/hayder/checkpay/mobile-app
npx expo login
```

**What happens:**
- Asks for your Expo username/email
- Opens browser for authentication
- OR asks for password in terminal
- Logs you in

**If you don't have an Expo account:**
- Go to https://expo.dev and create one (free)
- Then run `npx expo login` again

---

### **Step 2: Build the App** (Takes 10-15 minutes)

After logging in, run:

```bash
npx eas build --platform android --profile development
```

**What happens:**
- Uploads your code to Expo cloud
- Builds your app (10-15 minutes)
- Shows progress in terminal
- When done, gives you download link

**Example output:**
```
✔ Build started
Build ID: abc123
View build: https://expo.dev/accounts/your-account/projects/mobile-app/builds/12345

Waiting for build to complete...
[████████████████████] 100%

✔ Build finished!
Download: https://expo.dev/artifacts/abc123.apk
```

---

### **Step 3: Download APK**

1. **Copy the download link** from terminal
2. **Open link in browser** (on PC or phone)
3. **Download the APK file**

OR go to: https://expo.dev → Your Account → Projects → mobile-app → Builds → Download

---

### **Step 4: Install on Your Phone**

1. **Transfer APK to phone** (USB, email, cloud storage)
2. **Open file manager** on phone
3. **Tap the APK file**
4. **Allow "Install from Unknown Sources"** if asked
5. **Install**

---

### **Step 5: Start Dev Server**

Back in terminal:

```bash
cd /home/hayder/checkpay/mobile-app
npm start
```

**What happens:**
- Starts development server
- Shows QR code (you can ignore it)
- The dev client app on your phone will connect automatically

---

### **Step 6: Open the App**

1. **Open the installed dev client app** on your phone (NOT Expo Go)
2. **It connects automatically** to your dev server
3. **Full SMS functionality works!**

---

## 📱 Important Notes

- **Don't use Expo Go** - Use the dev client app you just installed
- **The dev client app** is different from Expo Go
- **After first build**, you only need to run `npm start` daily
- **Rebuild only** if you add new native modules

---

## 🎯 Quick Commands Summary

```bash
# 1. Login (interactive)
cd /home/hayder/checkpay/mobile-app
npx expo login

# 2. Build (wait 10-15 min)
npx eas build --platform android --profile development

# 3. Download APK from link shown
# 4. Install APK on phone
# 5. Start dev server
npm start

# 6. Open dev client app on phone (not Expo Go!)
```

---

## ❓ Troubleshooting

**"Not logged in" error:**
- Run `npx expo login` again
- Make sure you enter correct credentials

**"Build failed" error:**
- Check internet connection
- Make sure all dependencies installed: `npm install`
- Check error message for specific issue

**"Can't connect to dev server":**
- Make sure phone and PC on same WiFi
- Check firewall isn't blocking port 8081
- Try: `npx expo start --tunnel`

---

## ✅ You're Ready!

Start with **Step 1** in your terminal. The login command will guide you through authentication.

