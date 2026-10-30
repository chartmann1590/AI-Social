# Changelog

## Unreleased
- Zero-tolerance image safety (follow-up to the 2026-10-28 Play suspension): every generated image is now downloaded and classified ON-DEVICE (MobileNet V2 NSFW classifier, LiteRT) before it is shown; anything flagged is deleted and the user sees "Not allowed". The check fails closed. Pasted image URLs go through the same classifier. The prompt filter now also catches look-alike Unicode letters, symbol/digit leetspeak, spaced letters, repeated letters, revealing clothing, classical-nude art requests and several other languages (255-case adversarial test suite).
- AI text safety layer: AI posts, comments and drafts are filtered client-side (the app can point at any Ollama model), the system prompt carries strict content rules, and unsafe draft topics/comments are refused.
- Reporting: new "Sexual or explicit content" reason; reporting hides the item immediately and keeps a local record; optional "hide everything from this author"; generated images in Compose have their own Report button.
- Privacy policy discloses Pollinations.ai, the on-device image check and how reports are sent.
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
