# DropIt — Update Notes (November 2026)

This update makes DropIt ready for the research paper: any file or folder can be sent,
gestures are recognised with MediaPipe hand landmarks, accidental triggers are reduced,
transfers are secure and integrity-checked, and the web app can be installed on phones (PWA).

## What changed

| Area | Before | Now |
| --- | --- | --- |
| File types | Images only (`accept="image/*"`) | Any file; folders are zipped in the browser and sent as one `.zip` |
| Receive screen | Always showed an `<img>` | Preview for image, video, audio and PDF; every type gets a file card and a **Save** button |
| Gesture model | Teachable Machine image classifier (ml5, whole frame) | MediaPipe Gesture Recognizer (21 hand landmarks), runs in the browser |
| When a gesture fires | One frame with confidence > 0.7 | 8 of the last 12 frames must agree, **and** it must be a real movement: open hand → fist = GRAB, fist → open hand = DROP |
| When gestures are active | Always | Send page: only after a file and receiver are chosen. Drop page: only when a file is waiting |
| Mistake protection | Sent instantly | 3-second countdown with **Cancel**; waiting transfers can be cancelled from History |
| Receiver | Got the newest upload again and again, history duplicated | Inbox shows "file from X"; each file is delivered exactly once (atomic) |
| Security | `/uploads` folder was public; any user could call `/api/drop/<someone else>` | Files only through the authenticated download; users can only receive their own files; old plain-text passwords are hashed on next login |
| File storage | Server disk (`server/uploads`), lost on free hosting restarts | Inside MongoDB (GridFS); max 50 MB per file, removed 7 days after delivery (`MAX_FILE_MB`, `RETENTION_DAYS`) |
| Integrity | None | SHA-256 computed by the browser and the server on upload, checked again after download ("Integrity verified") |
| Camera | On for every page | Only on Send and Drop pages, with a small preview showing hand state, FPS and inference time |
| App | Website only | Installable PWA (Android and iPhone), icons and offline app shell |

Extra for experiments: **"Send without gesture"** and **"Receive without gesture"** buttons do the same
transfer with a click, so the user study can compare gesture vs. normal use on one system.

## Files

Server (`server/`)
- `index.js` — rewritten routes: `/api/upload`, `/api/incoming` (new), `/api/drop` (now POST, one-time), `/api/files`, download, delete/cancel
- `models/File.js` — new fields: `sha256`, `isFolder`, `sourceFileId`, `deliveredAt`, `audio` category
- `models/User.js` — legacy plain-text passwords are re-hashed on successful login

Client (`client/`)
- `src/lib/gestures.js` — voting + transition logic (describe this in the paper's Method section)
- `src/lib/gestures.test.mjs` — tests: `npm run test:gestures`
- `src/components/GestureDetector.jsx/.css` — MediaPipe camera panel
- `src/pages/HomePage.jsx` (Send), `DropPage.jsx` (Receive), `HistoryPage.jsx`, `Transfer.css`
- `src/components/FileCard.jsx`, `SiteFooter.jsx`, `src/lib/api.js`, `src/lib/files.js`
- `public/manifest.webmanifest`, `public/sw.js`, `public/icons/*` — PWA
- `scripts/prepare-mediapipe.mjs` — runs after `npm install`; copies MediaPipe WASM and downloads the gesture model into `public/`

## How to run

```bash
# 1. Server
cd server
npm install
npm run dev            # needs MONGODB_URI and JWT_SECRET in server/.env

# 2. Client (new terminal)
cd client
npm install            # also prepares the MediaPipe files
npm run dev            # open http://localhost:5173
```

The first time the server starts, older uploads are marked as delivered, so they do not flood anyone's inbox.

Test with two accounts: log in as user A in one browser and user B in another (or a private window).
A: choose a file, type B's username, open hand → close fist. B: open the Drop page, make a fist → open hand.

## Deployment (online, any two devices)

| Part | Service | Notes |
| --- | --- | --- |
| Database + file storage | MongoDB Atlas, free cluster (512 MB) | Network access must allow `0.0.0.0/0`, because Render free has no fixed IP |
| Server | Render, free web service, via `render.yaml` | Sleeps after 15 idle minutes; the first request then takes up to a minute (the app pings `/api/health` on open) |
| Website | Netlify (`netlify.toml`) | Set `VITE_API_URL` to the Render address, then redeploy |

Render setup: New → Blueprint → this repository → paste `MONGODB_URI` when asked (`JWT_SECRET` is generated).
If the Netlify site address changes, update `CLIENT_ORIGIN` on Render.

## Installing on phones (PWA)

The camera only works on **HTTPS** (or `localhost`). The Netlify site is already HTTPS; the server must be HTTPS too
(for example on Render/Railway), otherwise the browser blocks the requests.

- **Android (Chrome):** open the site → menu ⋮ → **Install app** / **Add to Home screen**.
- **iPhone (Safari):** open the site → Share → **Add to Home Screen**.

Notes: iPhone browsers cannot pick folders (choose a `.zip` instead). MediaPipe runs slower on older phones,
so report FPS/latency per device in the paper (shown in the camera panel).

## Next steps

1. Collect a DropIt gesture dataset (15+ people, both hands, 3 lighting × 3 distances) and train a custom model
   with MediaPipe Model Maker; set `VITE_GESTURE_MODEL_URL` to use it. Compare it with the built-in model.
2. Optional: WebSocket push for "file waiting" instead of polling every 4 s.
3. Native wrappers with Capacitor (Android first; iOS needs a Mac or cloud build).
