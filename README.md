# AI Social
A React Native + Expo app that simulates a social media experience powered by a local Ollama model.

## Stack
- Expo (managed workflow) + React Native
- React Navigation + React Native Paper
- Zustand for state
- Ollama for local AI responses

## Project Structure
- `index.ts` and `App.tsx` are the entry points.
- `src/screens/` contains the UI screens (feed, compose, settings, post detail).
- `src/components/` holds reusable UI like `PostCard`.
- `src/services/ollama.ts` wraps calls to the Ollama API.
- `src/store/` contains Zustand stores.
- `src/config.ts` holds local runtime config (see `src/config.example.ts`).
- `assets/` contains app icons and images.

## Setup
1. Install Node.js (LTS).
2. Install and start Ollama (`ollama serve`).
3. Install dependencies:
   ```powershell
   npm install
   ```
4. Configure Ollama:
   - Copy `src/config.example.ts` to `src/config.ts` if needed.
   - Set `OLLAMA_BASE_URL` and `OLLAMA_MODEL`.
   - For Android emulator: `http://10.0.2.2:11434` is typical.
   - For physical devices: use your LAN IP (for example, `http://192.168.1.50:11434`).

## App Settings
- Theme: choose System, Light, or Dark from the Settings screen.
- Streaming: toggle "Use Streaming" if you want experimental streaming behavior.

## Run Locally
- Start the dev server: `npm run start`
- Android emulator: `npm run android`
- iOS simulator (macOS only): `npm run ios`
- Web: `npm run web`
- If Metro acts up: `npx expo start -c`

## Device Testing (Development Build)
- Android (USB): enable USB debugging, plug in your device, then run `npm run android`.
  - If Metro is on port 8082, run `adb reverse tcp:8082 tcp:8082`.
- iOS: requires macOS + Xcode, then run `npm run ios`.

## Test on Your Phone (Expo Go)
1. Install Expo Go on your device.
2. Ensure your phone and dev machine are on the same Wi-Fi.
3. Set `OLLAMA_BASE_URL` to your machine's LAN IP (not `localhost`).
4. Start the dev server: `npm run start`.
5. Scan the QR code (iOS Camera or Expo Go on Android).
Note: Expo Go runs inside the Expo container, so it will not show your custom app icon or standalone splash.

## Release Builds (EAS)
Use EAS Build for installable binaries and store distribution.
- One-time setup: `npm install -g eas-cli` then `eas login`.
- Configure the project: `eas build:configure` (creates `eas.json`).
- Build:
  - Android APK/AAB: `eas build -p android`
  - iOS IPA: `eas build -p ios` (requires an Apple developer account)
- Optional submit to stores: `eas submit -p android` or `eas submit -p ios`.
Keep secrets and API keys out of git; use EAS secrets or environment variables as needed.

## Security & Secrets
- `src/config.ts` is intentionally ignored by git. Do not commit local URLs or credentials.
- `android/local.properties` and generated native folders are machine-specific and should stay untracked.
- Never commit signing keys or certificates (`*.jks`, `*.p8`, `*.p12`, `*.key`, `*.pem`).

## Troubleshooting
- Posts not loading: verify Ollama is running and reachable on the LAN IP, allow firewall access to port 11434, and set `OLLAMA_HOST=0.0.0.0` if the server must bind to all interfaces.
- JSON parse errors: try a larger model (for example, `llama3` or `mistral`).
