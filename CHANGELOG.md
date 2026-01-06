# Changelog

## 1.1.0
- Added theme preference (system, light, dark) and applied it across the UI.
- Added load-more support for the feed and post comments.
- Expanded documentation and security guidance for local configuration.

### Run on Android
1. Install dependencies: `npm install`
2. Build and install: `npm run android`
3. If Metro runs on port 8082, reverse it over USB: `adb reverse tcp:8082 tcp:8082`

### Run on iOS
1. Install dependencies: `npm install`
2. Build and run (macOS + Xcode required): `npm run ios`
