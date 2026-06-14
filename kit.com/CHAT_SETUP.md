# Jersey AI Chat Setup

The storefront now uses the local JerseyHub API instead of calling an AI provider directly from the browser.

## Run The App

```powershell
node server.js
```

Open:

```text
http://127.0.0.1:5600/
```

If port `5600` is busy, the server automatically tries the next port up. The browser API helper checks `5600` through `5610` when the site is opened from a local file or a separate dev server.

## How The Chat Works

- `index.html` loads `chat.js`.
- `chat.js` calls `/api/assistant` for normal chat, product search, cart actions, checkout flow, and order tracking.
- `server.js` keeps responses grounded in the live catalog and order database.
- If the API is unreachable, `chat.js` falls back to local catalog search so the chat still works for basic shopping questions.

## Optional AI Providers

The backend can polish grounded answers with external providers, but they are optional:

```powershell
$env:GEMINI_API_KEY="your-key"
$env:GEMINI_MODEL="gemini-2.5-flash"
```

Without an API key, Jersey AI still works with local grounded responses.

## Good Test Messages

```text
hi
Do you have Barcelona home jersey size L?
add Barcelona home jersey size L to cart
buy Real Madrid away jersey XL
Track JH-1024
```

