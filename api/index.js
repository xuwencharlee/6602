const headers = { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS', 'access-control-allow-headers': 'content-type' };
const send = (res, code, data) => { res.writeHead(code, headers); res.end(JSON.stringify(data)); };
async function redis(command, ...args) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Storage is not configured. Connect a Vercel KV or Upstash Redis database.');
  const response = await fetch(`${url}/${[command, ...args].map(x => encodeURIComponent(x)).join('/')}`, { headers: { Authorization: `Bearer ${token}` } });
  const result = await response.json();
  if (!response.ok || result.error) throw new Error(result.error || 'Storage request failed');
  return result.result;
}
module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, headers); return res.end(); }
  const path = new URL(req.url, 'https://vercel.local').pathname;
  try {
    if (req.method === 'POST' && path === '/webhook') {
      const d = req.body || {};
      for (const key of ['jev_result', 'email_subject', 'email_body', 'ticket_id']) if (typeof d[key] !== 'string' || !d[key].trim()) return send(res, 400, { error: `missing or invalid ${key}` });
      const previous = await redis('GET', `task:${d.ticket_id}`);
      const item = { ...d, created_at: previous ? JSON.parse(previous).created_at : new Date().toISOString(), done: previous ? JSON.parse(previous).done : false };
      await redis('SET', `task:${d.ticket_id}`, JSON.stringify(item));
      await redis('SADD', 'tasks', d.ticket_id);
      return send(res, 201, { ok: true, task: item });
    }
    if (req.method === 'GET' && path === '/api/tasks') {
      const ids = await redis('SMEMBERS', 'tasks');
      const items = await Promise.all(ids.map(id => redis('GET', `task:${id}`)));
      return send(res, 200, items.filter(Boolean).map(JSON.parse).sort((a, b) => b.created_at.localeCompare(a.created_at)));
    }
    if (req.method === 'PATCH' && path.startsWith('/api/tasks/')) {
      const id = decodeURIComponent(path.slice('/api/tasks/'.length));
      const raw = await redis('GET', `task:${id}`);
      if (!raw) return send(res, 404, { error: 'not found' });
      const item = { ...JSON.parse(raw), done: Boolean(req.body?.done) };
      await redis('SET', `task:${id}`, JSON.stringify(item));
      return send(res, 200, item);
    }
    return send(res, 404, { error: 'not found' });
  } catch (error) { return send(res, 503, { error: error.message }); }
};
