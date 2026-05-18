const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
const CORS_PREFLIGHT = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS_PREFLIGHT });

if (url.pathname === '/track') {

      const qr        = url.searchParams.get('qr');
      const inlineDest = url.searchParams.get('dest');
      const today     = new Date().toISOString().slice(0, 10);

      // ── Dynamic code: ?qr= present (with or without ?dest=) ──
      if (qr) {
        const key   = `${qr}:day:${today}`;
        const count = parseInt((await env.QR_KV.get(key)) || '0') + 1;
        await env.QR_KV.put(key, String(count));
        // Use inline ?dest= if present, otherwise fall back to KV lookup
        const dest  = inlineDest || await env.QR_KV.get(`${qr}:dest`);
        if (!dest) return new Response('QR destination not configured.', { status: 404 });
        return Response.redirect(dest, 302);
      }

      // ── Legacy passthrough: ?dest= only, no ?qr= (Groove Theory printed flyer) ──
      if (inlineDest) {
        if (!inlineDest.startsWith('https://')) {
          return new Response('Invalid destination.', { status: 400 });
        }
        const key   = `legacy-flyer:day:${today}`;
        const count = parseInt((await env.QR_KV.get(key)) || '0') + 1;
        await env.QR_KV.put(key, String(count));
        return Response.redirect(inlineDest, 302);
      }

      return new Response('QR destination not configured.', { status: 404 });
    }

    if (url.pathname === '/destination') {
      if (request.method !== 'PUT') return new Response('Method not allowed', { status: 405 });
      const qr  = url.searchParams.get('qr');
      const dst = url.searchParams.get('url');
      if (!qr || !dst || !dst.startsWith('http')) return new Response('Invalid params', { status: 400 });
      await env.QR_KV.put(`${qr}:dest`, dst);
      return new Response(JSON.stringify({ ok: true, qr, dest: dst }), { headers: CORS });
    }

if (url.pathname === '/stats') {
      const qr       = url.searchParams.get('qr') || 'default';
      const daysBack = parseInt(url.searchParams.get('days') || '30');
      const days = [], counts = [];
      for (let i = daysBack - 1; i >= 0; i--) {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - i);
        const s = d.toISOString().slice(0, 10);
        days.push(s);
        counts.push(parseInt((await env.QR_KV.get(`${qr}:day:${s}`)) || '0'));
      }
      const total = counts.reduce((a, b) => a + b, 0);
      return new Response(JSON.stringify({ days, counts, total, today: counts[counts.length - 1] }), { headers: CORS });
    }

    // ── GET /codes — list all QR codes that have a :dest key ──
    if (url.pathname === '/codes' && request.method === 'GET') {
      const list = await env.QR_KV.list();
      const destKeys = list.keys.filter(k => k.name.endsWith(':dest'));
      const codes = await Promise.all(destKeys.map(async k => {
        const id   = k.name.slice(0, -5); // strip ':dest'
        const dest = await env.QR_KV.get(k.name);
        const meta = await env.QR_KV.get(`meta:${id}`);
        return meta ? JSON.parse(meta) : { id, dest, label: id, type: 'Uncategorized', eventId: null };
      }));
      return new Response(JSON.stringify(codes), { headers: CORS });
    }

    // ── PUT /codes — write full metadata blob for a code ──
    if (url.pathname === '/codes' && request.method === 'PUT') {
      let body;
      try { body = await request.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }
      const { id } = body;
      if (!id) return new Response('Missing id', { status: 400 });
      await env.QR_KV.put(`meta:${id}`, JSON.stringify(body));
      await env.QR_KV.put(`${id}:dest`, body.dest);
      return new Response(JSON.stringify({ ok: true }), { headers: CORS });
    }

    return new Response('Not found', { status: 404 });
  },
};