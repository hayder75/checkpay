# EAS Build - Step by Step Guide

## 📍 Where to Run Commands

**All commands run on YOUR PC in the terminal** (not on Expo website)

---

## 🖥️ Step-by-Step (On Your PC Terminal)

### **Step 1: Login to Expo** (Terminal on your PC)

Open your terminal and run:

```bash
cd /home/hayder/checkpay/mobile-app
npx expo login
```

**What happens:**
- Opens browser or asks for username/password
- Logs you into Expo account
- Creates session on your PC

**If you don't have an account:**
- Go to https://expo.dev and create one (free)
- Then run `npx expo login` again

---

### **Step 2: Configure EAS** (Terminal on your PC)

Still in the same terminal:

```bash
npx eas build:configure
```

**What happens:**
- Creates `eas.json` file in your project
- Sets up build configuration
- Asks a few questions (just press Enter for defaults)

**Output:**
```
✔ Generated eas.json
```

---

### **Step 3: Build in Cloud** (Terminal on your PC)

Still in the same terminal:

```bash
npx eas build --platform android --profile development
```

**What happens:**
- Sends your code to Expo's cloud servers
- Expo builds your app (takes 10-15 minutes)
- Shows progress in terminal
- When done, gives you a download link

**Example output:**
```
Build started, it may take a few minutes to complete.
You can check the build status at: https://expo.dev/accounts/your-account/projects/mobile-app/builds/12345

Build finished!
Download: https://expo.dev/artifacts/abc123.apk
```

---

### **Step 4: Download APK** (On Expo Website)

1. **Copy the download link** from terminal
2. **Open in browser** (on your PC or phone)
3. **Download the APK file**

OR

1. Go to https://expo.dev
2. Login to your account
3. Go to your project
4. Click "Builds" tab
5. Download the APK

---

### **Step 5: Install on Phone** (On Your Phone)

1. **Transfer APK to phone** (via USB, email, or cloud)
2. **Open file manager** on phone
3. **Tap the APK file**
4. **Enable "Install from Unknown Sources"** if prompted
5. **Install**

---

### **Step 6: Start Dev Server** (Terminal on your PC)

Back in your terminal:

```bash
cd /home/hayder/checkpay/mobile-app
npm start
```

**What happens:**
- Starts development server
- Shows QR code
- App on phone connects automatically

---

## 📋 Summary

| Step | Where | What |
|------|-------|------|
| 1. Login | **Your PC Terminal** | `npx expo login` |
| 2. Configure | **Your PC Terminal** | `npx eas build:configure` |
| 3. Build | **Your PC Terminal** | `npx eas build --platform android` |
| 4. Download | **Expo Website** or **Terminal Link** | Get APK file |
| 5. Install | **Your Phone** | Install APK |
| 6. Start Server | **Your PC Terminal** | `npm start` |

---

## 🎯 Quick Copy-Paste Commands

Run these **one by one** in your terminal:

```bash
# Step 1: Login
cd /home/hayder/checkpay/mobile-app
npx expo login

# Step 2: Configure
npx eas build:configure

# Step 3: Build (this takes 10-15 minutes)
npx eas build --platform android --profile development

# Step 4: Download APK from the link shown
# (Do this in browser)

# Step 5: Install APK on phone
# (Do this on your phone)

# Step 6: Start dev server
npm start
```

---

## 💡 Important Notes

- **All terminal commands** = Run on YOUR PC
- **Build happens** = On Expo's cloud servers (not your PC)
- **Download APK** = From Expo website or terminal link
- **Install APK** = On your phone
- **Dev server** = Run on YOUR PC (keeps running)

---

## ❓ Common Questions

**Q: Do I need Android Studio?**  
A: No! EAS builds in the cloud.

**Q: Where does the build happen?**  
A: On Expo's servers (cloud), not your PC.

**Q: Can I use my phone during build?**  
A: Yes! Build happens in cloud, you can use your phone normally.

**Q: How long does build take?**  
A: 10-15 minutes for first build, faster for subsequent builds.

**Q: Do I need to rebuild every time?**  
A: No! Only rebuild if you add new native modules. For code changes, just use `npm start`.

