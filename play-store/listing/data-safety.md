# Data Safety — AISocial

Use this as the source of truth for the Play Console Data Safety form.

## Data collection
AISocial does NOT collect or transmit any personal data or analytics from the device.

## Data shared with third parties
- **On-device mode**: no data is shared with any third party.
- **Remote / Hybrid mode**: when the user configures an Ollama server URL in Settings, generation prompts are sent to that URL only. No data flows to Anthropic, Google, or any other third party.

## Network requests made by the app
- Hugging Face (`huggingface.co` / `cas-bridge.xethub.hf.co`) — only during explicit user-initiated model downloads from Settings → Models.
- DiceBear (`api.dicebear.com`) — to render generated avatar placeholders for synthetic posts/comments.
- User-configured Ollama server URL — only if the user opts into Remote or Hybrid mode and supplies a URL.

## Storage
- Model `.task` files are stored in the app's private internal storage.
- Settings (theme, LLM mode, model path, fallback toggle, Ollama URL) are stored in AsyncStorage (app-private).
- Feed posts are held in memory only; nothing is written to a database or cloud.

## Accounts / sign-in
AISocial has no account system, no sign-in, and no identifier assigned to the user.

## Permissions
- INTERNET — for model downloads and optional Ollama calls.
- No camera, contacts, location, microphone, or storage permissions are requested.
