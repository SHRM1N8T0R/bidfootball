# bidfootball.lol

> Bid to crown the top football club of every country. Highest bid holds the crown. No resets. No refunds.

## What's built

| Layer | Status |
|---|---|
| Frontend (`public/index.html`) | ✅ Done |
| API — leaderboard, checkout, webhook (`functions/api/`) | ✅ Done |
| KV namespaces (prod + preview) | ✅ Done |
| GitHub repo | ✅ Done |
| Cloudflare Pages project deployed | ✅ Done → https://bidfootball.pages.dev |
| Club logos (135 clubs, all resolved) | ✅ Done |
| GitHub → CF Pages auto-deploy | ⚠️ Manual (5 min — see below) |
| KV binding in CF Pages | ⚠️ Manual (1 min — see below) |
| Stripe secrets | ⚠️ Manual (2 min — see below) |
| Custom domain (bidfootball.lol) | ⚠️ Manual (10 min — see below) |

---

## 1. Connect GitHub → Cloudflare Pages (auto-deploy on push)

1. Go to **dash.cloudflare.com → Pages → bidfootball → Settings → Builds & deployments**
2. Click **Connect to Git** → GitHub → authorise → choose `SHRM1N8T0R/bidfootball`
3. Branch: `main` · Build command: *(leave blank)* · Output dir: `public`
4. Save

Every `git push` to `main` now triggers a deploy automatically.

---

## 2. Bind KV to Pages

1. **dash.cloudflare.com → Pages → bidfootball → Settings → Functions**
2. Scroll to **KV namespace bindings → Production**
3. Add binding: Variable name = `BIDS`, KV namespace = `BIDS` (id: `418d4963a54b4b3e954dfecbece2ed74`)
4. Repeat for **Preview**, namespace = `BIDS_preview` (id: `6952ec82caea4c98bb47ccdfaea18031`)
5. Save and re-deploy (or just push a commit)

---

## 3. Stripe — separate account

bidfootball needs its own Stripe account so nothing from Hebrew From Zero appears.

1. Go to **dashboard.stripe.com** → account switcher (top-left) → **New account**
2. Name it "BidFootball" — it lives under the same login but is fully independent (own branding, own keys, own payouts)
3. In the new account: **Developers → API keys** → copy the **Secret key** (`sk_live_...`)
4. Set it in CF Pages: **Pages → bidfootball → Settings → Environment variables → Production**
   - `STRIPE_SECRET_KEY` = `sk_live_xxx`
5. Create a webhook endpoint: **Stripe → Developers → Webhooks → Add endpoint**
   - URL: `https://bidfootball.lol/api/webhook`
   - Events: `checkout.session.completed`
   - Copy the **Signing secret** (`whsec_xxx`)
6. Back in CF Pages env vars:
   - `STRIPE_WEBHOOK_SECRET` = `whsec_xxx`
7. Re-deploy (push any commit, or click "Retry deployment" in the dashboard)

---

## 4. Custom domain — bidfootball.lol

Since the domain is on GoDaddy and we're pointing to Cloudflare:

1. **dash.cloudflare.com → Add a site** → type `bidfootball.lol` → choose Free plan
2. Cloudflare shows you **2 nameservers** (e.g. `xyz.ns.cloudflare.com`)
3. In **GoDaddy → My Domains → bidfootball.lol → DNS → Nameservers → Change** → Custom → paste both CF nameservers → Save
4. Back in Cloudflare, click **Done, check nameservers** — takes 5–30 min to propagate
5. Once active: **Pages → bidfootball → Custom domains → Add domain** → `bidfootball.lol`
   - Also add `www.bidfootball.lol` and set a redirect rule → `bidfootball.lol`
6. Cloudflare issues a free SSL cert automatically

---

## 5. Update Stripe webhook URL

Once the domain is live, update the webhook endpoint URL in Stripe from the test URL to `https://bidfootball.lol/api/webhook`.

---

## Local dev

```bash
cp .dev.vars.example .dev.vars   # fill in test Stripe keys
npm install
npm run dev                       # wrangler pages dev on :8788
```

---

## Re-fetching logos

If you add new clubs or logos break:

```bash
node scripts/patch-logos.mjs   # patches only clubs with null logos
```

Or full re-fetch:

```bash
node scripts/fetch-logos.mjs   # re-fetches all
node scripts/patch-logos.mjs   # patches any that failed
```
