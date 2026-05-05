# Data Safety - AISocial

Use this as the source of truth for the Play Console Data Safety form.

## Data collection
AISocial does NOT collect or transmit personal data or analytics from the device to a project-operated backend.

The app includes Google AdMob through the Google Mobile Ads SDK. Google discloses that the SDK automatically collects and shares IP address, user product interactions, diagnostic information, and device/account identifiers (including the Android advertising ID and app set ID where available) for advertising, analytics, and fraud prevention. The current app build requests non-personalized ads.

## Data shared with third parties
- **On-device mode**: generation prompts are processed locally and are not shared with any LLM provider.
- **Remote / Hybrid mode**: when the user configures an Ollama server URL in Settings, generation prompts are sent to that URL only. Prompt data does not flow to Anthropic, Google, or any other third party unless the user chooses a URL operated by that party.
- **Advertising**: Google AdMob receives ad request, interaction, diagnostic, IP address, and identifier data through the Google Mobile Ads SDK for advertising, analytics, and fraud prevention.

## Network requests made by the app
- Hugging Face (`huggingface.co` / `cas-bridge.xethub.hf.co`) - only during explicit user-initiated model downloads from Settings > Models.
- DiceBear (`api.dicebear.com`) - to render generated avatar placeholders for synthetic posts/comments.
- User-configured Ollama server URL - only if the user opts into Remote or Hybrid mode and supplies a URL.
- Google AdMob / Google Mobile Ads SDK - to load and measure banner, interstitial, native, and rewarded ads.

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
