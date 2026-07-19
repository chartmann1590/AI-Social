# Data Safety - AISocial

Use this as the source of truth for the Play Console Data Safety form.

**This file is documentation only — it is not read by the publish workflow.**
The actual Data Safety section in Play Console must be updated by hand to
match whenever this file changes; Google's publishing API does not accept
Data Safety answers.

## Data collection
AISocial does NOT collect or transmit user-generated content (posts, prompts, drafts) to a project-operated backend. On-device model inference and Ollama prompts stay local or go only to a server the user explicitly configures.

The app does use Firebase Analytics, Firebase Crashlytics, and Firebase Performance Monitoring (Google) to collect aggregated usage events, crash/error reports, and app performance metrics. This data is collected by Google under Firebase's privacy terms and is used only to fix bugs and understand feature usage — it does not include feed content, prompts, or anything the user types.

The app also includes Google AdMob through the Google Mobile Ads SDK. Google discloses that the SDK automatically collects and shares IP address, user product interactions, diagnostic information, and device/account identifiers (including the Android advertising ID and app set ID where available) for advertising, analytics, and fraud prevention. The current app build requests non-personalized ads.

The in-app "Support & Feedback" bug reporter is opt-in: if the user chooses to submit a report, the title, description, optional name/email, optional screenshot, and basic device diagnostics they explicitly submit are sent (via a Cloudflare Worker proxy) to the project's public GitHub issue tracker.

## Data shared with third parties
- **On-device mode**: generation prompts are processed locally and are not shared with any LLM provider.
- **Remote / Hybrid mode**: when the user configures an Ollama server URL in Settings, generation prompts are sent to that URL only. Prompt data does not flow to Anthropic, Google, or any other third party unless the user chooses a URL operated by that party.
- **Analytics & crash reporting**: Google Firebase (Analytics, Crashlytics, Performance) receives aggregated usage events, crash reports, and performance metrics.
- **Advertising**: Google AdMob receives ad request, interaction, diagnostic, IP address, and identifier data through the Google Mobile Ads SDK for advertising, analytics, and fraud prevention.
- **Bug reports (opt-in only)**: content the user explicitly submits via Support & Feedback is sent through a Cloudflare Worker to the project's GitHub repository as a public issue.

## Network requests made by the app
- Hugging Face (`huggingface.co` / `cas-bridge.xethub.hf.co`) - only during explicit user-initiated model downloads from Settings > Models.
- DiceBear (`api.dicebear.com`) - to render generated avatar placeholders for synthetic posts/comments.
- User-configured Ollama server URL - only if the user opts into Remote or Hybrid mode and supplies a URL.
- Google Firebase (Analytics, Crashlytics, Performance) - aggregated usage/crash/performance data.
- Google AdMob / Google Mobile Ads SDK - to load and measure banner, interstitial, native, and rewarded ads.
- Cloudflare Worker (`*.workers.dev`) - only when the user explicitly submits a bug report via Support & Feedback.

## Storage
- Model `.task` files are stored in the app's private internal storage.
- Settings (theme, LLM mode, model path, fallback toggle, Ollama URL) are stored in AsyncStorage (app-private).
- Feed posts are held in memory only; nothing is written to a database or cloud.

## Accounts / sign-in
AISocial has no account system, no sign-in, and no identifier assigned to the user by the app itself.

## Permissions
- INTERNET - for AdMob ads, model downloads, and optional Ollama calls.
- Android advertising ID may be used by the Google Mobile Ads SDK when available.
- No camera, contacts, location, microphone, or broad storage permissions are requested for core app functionality.
