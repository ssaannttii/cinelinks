# Daily reminder push — setup

Web push is fully built but **inert until you configure VAPID keys**. With no key set,
`/api/push?action=config` returns `{ key: null }` and the client never prompts — zero user-facing
change. Flip it on with the steps below.

## 1. Generate VAPID keys (once)
```
npx web-push generate-vapid-keys
```
Gives a public + private key pair.

## 2. Set env vars in Vercel (Project → Settings → Environment Variables)
| Var | Value |
|---|---|
| `VAPID_PUBLIC_KEY` | the public key |
| `VAPID_PRIVATE_KEY` | the private key |
| `VAPID_SUBJECT` | `mailto:you@yourdomain` (optional; defaults to a mailto) |
| `PUSH_SECRET` | any long random string — protects the sender endpoint |

(`KV_REST_API_URL` / `KV_REST_API_TOKEN` are already set — subscriptions live in that Redis.)

Redeploy so the functions pick up the vars.

## 3. What happens then
- The client fetches `/api/push?action=config`, sees a key, and (only for players who've already
  played, once, with a soft pre-prompt) offers "Daily reminder?". On accept it subscribes
  via the service worker and POSTs the subscription to `/api/push?action=subscribe` (stored in the
  Redis set `push:subs`).
- The service worker (`sw.js`) shows the notification on `push` and focuses/opens the app on
  click.

## 4. Send the daily reminder (cron)
Hit the sender once a day. It notifies every stored subscription and prunes dead ones.

```
curl -X POST "https://cinelinks.vercel.app/api/push?action=send" \
  -H "x-push-secret: $PUSH_SECRET" \
  -H "content-type: application/json" \
  -d '{"body":"Today’s CineLinks puzzle is ready 🎬"}'
```

Automate with **Vercel Cron** — add to `vercel.json` (pick your hour, UTC):
```json
"crons": [{ "path": "/api/push?action=send&secret=YOUR_PUSH_SECRET", "schedule": "0 9 * * *" }]
```
…or any external cron (cron-job.org, GitHub Actions) calling the same URL with the header.

> Note: Vercel Cron availability/frequency depends on your plan. An external cron works on any plan.

## 5. Endpoints
- `GET /api/push?action=config` → `{ key }` (public VAPID key or null).
- `POST /api/push?action=subscribe` `{ subscription }` → stores it. `DELETE` removes it.
- `POST /api/push?action=send` (needs `x-push-secret` or `?secret=`) → sends to all, prunes dead.

## Testing
After setting keys + redeploying: open the site (as a returning player), accept the prompt,
then call `/api/push?action=send` manually — you should get the notification. Check the response
`{ sent, pruned, total }`.
