# QR Tracker

A QR code analytics and management system for tracking scan activity across events. Runs on Cloudflare Workers with Supabase for metadata storage and Cloudflare KV for fast scan counting.

## Features

- Create and manage multiple QR codes organized by event
- Real-time scan tracking with daily granularity
- Analytics dashboard with customizable date ranges (30/60/90 days)
- Bar chart visualization of scan history per QR code
- Live destination URL editing without regenerating codes
- Export/import event data as JSON

## Architecture

| Layer | Technology |
|-------|-----------|
| Backend | Cloudflare Workers (edge serverless) |
| Scan counts | Cloudflare KV |
| Metadata (events, codes) | Supabase PostgreSQL |
| QR image generation | [QRServer.com API](https://goqr.me/api/) |
| Dashboard | Static HTML + Chart.js |

## Project Structure

```
qr-tracker/
├── worker.js            # Cloudflare Worker — tracking, redirects, stats API
├── QR Dashboard.html    # Single-page analytics and management UI
└── wrangler.toml        # Cloudflare Wrangler config (worker name, KV binding)
```

## Worker API

All endpoints are served from the deployed Cloudflare Worker.

### Track a scan
```
GET /track?qr=<code-id>
```
Increments the daily scan counter in KV and redirects the visitor to the configured destination URL.

### Get scan stats
```
GET /stats?qr=<code-id>&days=<n>
```
Returns daily scan counts for the last `n` days plus today's total.

### Set destination URL
```
GET /destination?qr=<code-id>&url=<destination>
```
Updates the redirect target stored in KV for the given QR code.

### List/update QR code metadata
```
GET  /codes
PUT  /codes
```
Reads or writes the full QR code metadata blob (used by the dashboard to sync Supabase state to KV).

## Supabase Schema

Two tables are required:

**`qr_events`**

| Column | Type |
|--------|------|
| id | text (primary key, slug) |
| name | text |
| date | text |
| promoter | text |

**`qr_codes`**

| Column | Type |
|--------|------|
| id | text (primary key, slug) |
| event_id | text (foreign key → qr_events.id) |
| name | text |
| destination | text |

## Setup

### 1. Prerequisites

- [Node.js](https://nodejs.org/) and npm
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/): `npm install -g wrangler`
- A Cloudflare account with Workers and KV enabled
- A Supabase project with the schema above

### 2. Configure Wrangler

Update `wrangler.toml` with your Cloudflare account details and KV namespace ID:

```toml
name = "qr-tracker"
main = "worker.js"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding = "QR_KV"
id = "<your-kv-namespace-id>"
```

Create the KV namespace if you haven't already:

```bash
wrangler kv:namespace create QR_KV
```

### 3. Deploy the Worker

```bash
wrangler deploy
```

### 4. Configure the Dashboard

Open `QR Dashboard.html` in a text editor and update the constants near the top of the `<script>` block:

```js
const SUPABASE_URL = 'https://<your-project>.supabase.co';
const SUPABASE_KEY = '<your-supabase-anon-key>';
const WORKER_URL  = 'https://<your-worker>.workers.dev';
```

Then open `QR Dashboard.html` directly in a browser — no build step required.

## Usage

1. Open the dashboard in your browser.
2. Use the manager panel (gear icon) to create an event and add QR codes with destination URLs.
3. Share the tracking URL: `https://<worker-url>/track?qr=<code-id>`
4. Scans are counted in real time and visible on the dashboard under each code.

## QR Code Image URL

The dashboard generates QR images via the QRServer.com API pointed at your tracking URL:

```
https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=<tracking-url>
```

Images can be downloaded as PNG directly from the dashboard.
