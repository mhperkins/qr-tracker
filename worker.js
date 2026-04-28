const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    if (url.pathname === '/track') {
      const today = new Date().toISOString().slice(0, 10);
      const count = parseInt((await env.QR_KV.get(`day:${today}`)) || '0') + 1;
      await env.QR_KV.put(`day:${today}`, String(count));
      const dest = url.searchParams.get('dest') || 'https://github.com/mhperkins';
      return Response.redirect(dest, 302);
    }

    if (url.pathname === '/stats') {
      const days = [], counts = [];
      const daysBack = parseInt(url.searchParams.get('days') || '30');
      for (let i = daysBack - 1; i >= 0; i--) {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - i);
        const s = d.toISOString().slice(0, 10);
        days.push(s);
        counts.push(parseInt((await env.QR_KV.get(`day:${s}`)) || '0'));
      }
      const total = counts.reduce((a, b) => a + b, 0);
      return new Response(JSON.stringify({ days, counts, total, today: counts[counts.length - 1] }), { headers: CORS });
    }

    return new Response('Not found', { status: 404 });
  },
};