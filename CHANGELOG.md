# Changelog

## Unreleased
- Fixed the Google Play suspension (2026-10-28, Sexual Content / AI-Generated Content policy, in-app image generation): image prompts are now screened on-device before any generation request is sent, so sexual, nude, or explicit prompts are blocked in the Compose screen and never reach the image provider. Allowed prompts are sent with the provider's strict safe filter (`safe=true`) and a fully-clothed, non-sexual framing suffix. Pasted image URLs are screened with the same prompt check. In-app post reporting (feed / post detail) was already in place and is unchanged.

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
