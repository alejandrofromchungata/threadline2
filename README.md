# Threadline — Closet AI

A digital wardrobe that photographs your clothes, cuts them off their background, and dresses you for whatever is on your calendar.

React Native (Expo, SDK 57) app + a Cloudflare Worker that holds the API keys.

---

## What actually runs

| Feature | How it works | Needs |
|---|---|---|
| Photograph a garment | `expo-camera` → worker → remove.bg → transparent PNG saved to app storage | remove.bg key |
| Auto-tagging | The cut-out PNG goes to Claude vision, which returns category, colour, material, formality, season, tags | Anthropic key |
| Import from a link | Worker fetches the page with `HTMLRewriter`, reads schema.org `Product` / OpenGraph for title, brand, price and image, then Claude fills the rest | Anthropic key |
| Share from another app | `expo-share-intent` catches a shared URL and opens the import flow pre-filled | dev build (not Expo Go) |
| Closet | `expo-sqlite`, on device. Search, filter, sort by wear count and cost per wear, clean/worn/laundry/stored | — |
| Outfit generator | Sends only *clean* items, your style profile, live weather and your past thumbs to Claude; validates returned ids against the closet | Anthropic key |
| Weather | Open-Meteo via `expo-location` | nothing, it's keyless |
| Calendar | `expo-calendar` reads the next 36 hours; event titles become occasions | — |
| Wear log | Wearing an outfit increments wear counts, moves pieces to the worn pile, writes a dated entry | — |
| Laundry reminder | Local notification when 8+ pieces are dirty | — |
| Gap analysis | Claude audits the closet against your styles | Anthropic key |
| Packing list | Destination geocode + trip forecast + capsule selection | Anthropic key |

Everything personal — items, photos, history — stays in the app's sandbox on the phone. Photos leave once, for background removal and tagging, and are not stored server-side.

---

## 1. Backend first

The app will not do anything intelligent until the worker is deployed, because the keys live there and never ship inside the app.

```bash
cd server
npm install
npx wrangler login

# rate-limit store
npx wrangler kv namespace create RATE_LIMIT
# paste the printed id into wrangler.toml

# secrets
npx wrangler secret put ANTHROPIC_API_KEY   # console.anthropic.com
npx wrangler secret put REMOVEBG_API_KEY    # remove.bg/api

npm run deploy
```

Deploy prints a URL like `https://threadline-api.yourname.workers.dev`. Put it in `app.json` under `expo.extra.apiBaseUrl`.

Test it:

```bash
curl -X POST https://threadline-api.yourname.workers.dev/v1/product \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://www.uniqlo.com/us/en/products/E459577-000"}'
```

**Costs.** remove.bg is roughly $0.20/image on pay-as-you-go with 50 free previews a month; Claude calls are fractions of a cent each. If you'd rather not pay per cut-out, swap the `cutout` handler in `server/src/index.js` for a self-hosted `rembg` container or an on-device Core ML / ML Kit segmenter — the app only cares that `/v1/cutout` returns `{ pngBase64 }`.

## 2. App

```bash
npm install
npx expo install --fix        # aligns every package to your installed SDK
```

`expo-camera`, `expo-sqlite` and `expo-share-intent` need native code, so **Expo Go will not run this**. Use a development build:

```bash
npm install -g eas-cli
eas login
eas build:configure           # writes your real projectId into app.json
eas build --profile development --platform ios     # or android
npx expo start --dev-client
```

## 3. Before you submit

Things I could not do for you, in the order they will block you:

1. **Identifiers.** Replace `com.yourcompany.threadline` in `app.json` (both platforms) and the placeholder `projectId`.
2. **Apple Developer Program** ($99/yr) and/or **Google Play Console** ($25 once). Create the app record in App Store Connect / Play Console; copy the `ascAppId`, `appleTeamId` and Apple ID into `eas.json`.
3. **Privacy policy URL.** Both stores require a reachable one. `PRIVACY.md` here is a starting draft — host it and put the real URL in `src/screens/StyleScreen.js` (the "Privacy policy" button) and in the store listings.
4. **Account deletion.** Apple requires an in-app path to delete data. "Erase all my data" in the Style tab satisfies this because there is no server-side account; say exactly that in App Review notes.
5. **Data safety forms.** Declare: photos (sent for processing, not retained), coarse location (weather), calendar (read-only, on-device). No tracking, no ads, no third-party identifiers.
6. **Screenshots** at 6.7" and 6.5" for iOS, plus feature graphic for Play.
7. **A real device pass.** Camera framing, permission denials, airplane mode, a closet with 200 items, and the share extension from Safari and Amazon.

Then:

```bash
eas build --profile production --platform ios
eas submit --platform ios
```

## 4. Known edges

- Retailers that render product data purely client-side (some Shopify themes, Instagram links) will return 422 from `/v1/product`; the app falls back to manual entry.
- remove.bg struggles with black garments on dark surfaces. The camera screen tells the user to shoot on a plain background for this reason.
- The rate limiter is per-IP and generous. If you open this beyond friends, put real auth in front of the worker — an unauthenticated endpoint holding your Anthropic key is somebody else's free API.
- `expo-calendar` and `expo-file-system` both changed API shape in recent SDKs. If you move off SDK 57, check `src/services/calendar.js` and `src/services/images.js` first.

## Layout

```
App.js                     navigation, onboarding gate, share-intent, notifications
src/db.js                  SQLite schema and every query
src/api.js                 typed client for the worker
src/theme.js               colours, categories, statuses
src/services/              weather, calendar, notifications, image handling
src/screens/               onboarding, closet, add item, item detail, outfit, log, style
src/components/            ui kit, item card, garment placeholder, packing sheet
server/src/index.js        the whole backend
assets/                    icon, adaptive icon, splash, notification icon
```
