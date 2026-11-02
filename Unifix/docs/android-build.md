# Unifix - Android Build and APK Setup Guide (Phase 11)

This guide documents the Android build architecture, tooling requirements, network configuration, and step-by-step procedures to generate and test the standalone Android APK for the **Unifix Mobile Application** (`apps/mobile`).

---

## 1. Overview & Architecture

The Unifix mobile client is developed using **React Native (0.74+)** and **Expo (SDK 51)** with TypeScript. It communicates exclusively with the trusted Unifix Express backend over REST APIs.

### Security Boundary Principle
Per Section 28 (Phase 11) and Section 31 of the Master Specification:
- **No Privileged Credentials**: The APK bundle **must never** contain database connection strings, Supabase service-role keys, JWT signing secrets (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `REFRESH_TOKEN_PEPPER`), or AI inference keys.
- **Client-Side Storage**: The APK stores only transient access tokens and opaque refresh tokens in secure device memory.

---

## 2. Tooling Prerequisites

To build and run the Unifix mobile app on Android, you need either the cloud-based EAS build tool or local Android build toolchain.

### Option A: Cloud Build (Recommended — No Local Android Studio Required)
- **Node.js**: LTS 20.x or later
- **EAS CLI**: `npm install -g eas-cli`
- Free Expo account at [expo.dev](https://expo.dev)

### Option B: Local Android Build
- **Java Development Kit (JDK)**: OpenJDK 17 (recommended: Eclipse Temurin 17 or Zulu JDK 17)
- **Android Studio**: Ladybug / Hedgehog or newer
  - Android SDK Platform 34 (Android 14)
  - Android SDK Build-Tools 34.0.0
  - Android SDK Command-line Tools
  - Android Emulator (with Google Play Intel x86_64 or ARM64 system image)
- **Environment Variables**:
  ```bash
  # Windows PowerShell
  [Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
  [Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Eclipse Adoptium\jdk-17.0.x-hotspot", "User")
  # Add to Path:
  # %ANDROID_HOME%\platform-tools
  # %ANDROID_HOME%\cmdline-tools\latest\bin
  ```

---

## 3. Expo & EAS Configuration Files

The mobile workspace includes production-ready configuration:

### 3.1 `apps/mobile/app.json`
Specifies package identity, versioning, permissions, and deep link scheme:
```json
{
  "expo": {
    "name": "Unifix",
    "slug": "unifix-mobile",
    "version": "1.0.0",
    "android": {
      "package": "global.unifix.mobile",
      "versionCode": 1,
      "permissions": [
        "INTERNET",
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE"
      ]
    },
    "scheme": "unifix"
  }
}
```

### 3.2 `apps/mobile/eas.json`
Configures build profiles for internal APK distribution and production:
```json
{
  "cli": { "version": ">= 10.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "production": {
      "android": { "buildType": "app-bundle" }
    }
  }
}
```

---

## 4. How to Generate the Android APK

### Method 1: Cloud APK Build via EAS (Zero Local Tooling)
This is the fastest method to obtain an installable `.apk` file without configuring Android Studio or Java locally.

1. Navigate to the mobile workspace:
   ```bash
   cd apps/mobile
   ```
2. Log into your Expo account:
   ```bash
   npx eas login
   ```
3. Trigger the preview build:
   ```bash
   npm run build:apk:cloud
   # Or: npx eas build -p android --profile preview
   ```
4. EAS builds the APK in the cloud. Once complete, EAS provides a direct download link and QR code to download the `.apk` file directly to your Android device.

---

### Method 2: Local EAS APK Build
If Android Studio and JDK 17 are installed locally:

```bash
cd apps/mobile
npx eas build -p android --profile preview --local
```
The output `.apk` will be saved directly in `apps/mobile/`.

---

### Method 3: Bare Native Gradle Build (Offline)
To generate the APK directly using Gradle:

1. Generate the native Android project folder:
   ```bash
   cd apps/mobile
   npx expo prebuild --platform android
   ```
2. Build the release APK:
   ```bash
   cd android
   ./gradlew assembleRelease
   # On Windows:
   .\gradlew.bat assembleRelease
   ```
3. The compiled APK is generated at:
   ```text
   apps/mobile/android/app/build/outputs/apk/release/app-release-unsigned.apk
   ```

---

## 5. Backend URL & Device Connectivity

The mobile app must connect to the running Unifix Express backend (`services/api`).

### Connecting via Android Emulator
In Android Virtual Devices (AVD), `localhost` refers to the emulator itself. To reach the host machine, use:
```text
http://10.0.2.2:3000/api/v1
```
The client (`apps/mobile/src/api/mobileClient.ts`) automatically uses `http://10.0.2.2:3000` when running on Android.

### Connecting via Physical Android Device
When testing on a physical phone over Wi-Fi:
1. Find your computer's local LAN IP:
   - Windows: `ipconfig` (e.g. `192.168.1.150`)
2. Ensure Windows Defender firewall allows incoming TCP connections on port `3000`.
3. In `apps/mobile/src/api/mobileClient.ts`, configure:
   ```typescript
   MobileApiClient.setBaseUrl('http://192.168.1.150:3000/api/v1');
   ```
4. Start the backend:
   ```bash
   npm run start
   ```

### Connecting to Production Backend
For hosted environments (e.g., Render, Railway, AWS, DigitalOcean):
```typescript
MobileApiClient.setBaseUrl('https://api.unifix.example.com/api/v1');
```

---

## 6. Installing and Verifying on Device

1. **Transfer the APK**: Copy the generated `.apk` to the Android phone via USB cable, Google Drive, or EAS download link.
2. **Enable Unknown Sources**: When prompted, allow installing apps from this source ("Install Unknown Apps").
3. **Open Unifix**: Tap the app icon to open.
4. **End-to-End Verification Flow**:
   - **Campus Selection**: Select `Pacific Science & Tech Campus (PSTC)`.
   - **Simulated OTP**: Enter `student.alex@pstc.test`. Quick-fill or type code `123456`.
   - **Issue Reporting**: Tap "Report Issue" to test AI-assisted reporting or standard manual reporting.
   - **Duplicate Detection**: Type an issue similar to an existing report; verify "I have this issue too" endorsement button appears.
   - **Stage Countdown**: Tap any ticket in the feed; verify the 21-day stage progress tracker displays accurately.
