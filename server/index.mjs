import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDatabase } from './database.mjs';
import { ValidationError, AuthorizationError, categories, regions, teams, statuses } from './domain.mjs';

const root = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png' };
async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 3 * 1024 * 1024) throw new ValidationError('O envio excede o limite de 3 MB.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString()); }
  catch { throw new ValidationError('JSON inválido.'); }
}
export function createApp(store) {
  return createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    const json = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(data));
    };
    try {
      const url = new URL(req.url, 'http://localhost');
      const actor = () => store.actor(String(req.headers['x-demo-actor'] || ''));
      if (url.pathname.startsWith('/api/')) {
        if (['POST', 'PATCH'].includes(req.method)) {
          if (!String(req.headers['content-type']).startsWith('application/json')) return json(415, { error: 'Envie application/json.' });
          const origin = req.headers.origin;
          if (origin && !['127.0.0.1', 'localhost', '::1'].includes(new URL(origin).hostname)) return json(403, { error: 'Origem não permitida.' });
        }
        if (req.method === 'GET' && url.pathname === '/api/health') return json(200, { ok: true, mode: 'demo' });
        if (req.method === 'GET' && url.pathname === '/api/options') return json(200, { categories, regions, teams, statuses });
        if (req.method === 'GET' && url.pathname === '/api/occurrences') return json(200, store.list(url.searchParams.get('mine') === '1' ? 'cidadao-demo' : undefined));
        if (req.method === 'POST' && url.pathname === '/api/occurrences') {
          const input = await readBody(req);
          if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ValidationError('Relato inválido.');
          return json(201, store.create(input));
        }
        const match = url.pathname.match(/^\/api\/occurrences\/([a-zA-Z0-9-]+)$/);
        if (match && req.method === 'GET') { const record = store.get(match[1]); return json(record ? 200 : 404, record ?? { error: 'Ocorrência não encontrada.' }); }
        if (match && req.method === 'PATCH') {
          const input = await readBody(req);
          if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ValidationError('Atualização inválida.');
          const record = store.update(match[1], input, actor());
          return json(record ? 200 : 404, record ?? { error: 'Ocorrência não encontrada.' });
        }
        if (req.method === 'GET' && url.pathname === '/api/collaborators') return json(200, store.listCollaborators(actor()));
        if (req.method === 'POST' && url.pathname === '/api/collaborators') {
          const input = await readBody(req); return json(201, store.createCollaborator(input, actor()));
        }
        const collaboratorMatch = url.pathname.match(/^\/api\/collaborators\/([a-zA-Z0-9-]+)$/);
        if (collaboratorMatch && req.method === 'PATCH') { const input = await readBody(req); const person = store.setCollaborator(collaboratorMatch[1], input, actor()); return json(person ? 200 : 404, person ?? { error:'Colaborador não encontrado.' }); }
        if (req.method === 'GET' && url.pathname === '/api/collaborator/tasks') return json(200, store.collaboratorTasks(actor()));
        const action = url.pathname.match(/^\/api\/occurrences\/([a-zA-Z0-9-]+)\/(assign|start|progress|conclude|validate)$/);
        if (action && req.method === 'POST') {
          const input = await readBody(req); const [id, name] = [action[1], action[2]]; const user = actor();
          const record = name === 'assign' ? store.assign(id,input,user) : name === 'start' ? store.start(id,user) : name === 'progress' ? store.progress(id,input,user) : name === 'conclude' ? store.conclude(id,input,user) : store.validate(id,input,user);
          return json(record ? 200 : 404, record ?? { error:'Ocorrência não encontrada.' });
        }
        return json(404, { error: 'Rota não encontrada.' });
      }
      if (req.method !== 'GET') return json(405, { error: 'Método não permitido.' });
      const pathname = decodeURIComponent(url.pathname);
      const target = resolve(root, '.' + pathname);
      if (target !== root && !target.startsWith(root + sep)) return json(403, { error: 'Caminho inválido.' });
      const file = extname(target) ? target : resolve(root, 'index.html');
      try {
        const data = await readFile(file);
        res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' });
        res.end(data);
      } catch { json(404, { error: 'Arquivo não encontrado. Execute npm run build antes de npm start.' }); }
    } catch (e) {
      if (e instanceof AuthorizationError) return json(403, { error: e.message });
      if (e instanceof ValidationError) return json(400, { error: e.message });
      console.error(e);
      json(500, { error: 'Não foi possível concluir a operação.' });
    }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const store = createDatabase(process.env.DATABASE_PATH || 'data/observamarilia.sqlite');
  const server = createApp(store);
  const host = process.env.HOST || '127.0.0.1';
  if (!['127.0.0.1', 'localhost', '::1'].includes(host) && process.env.ALLOW_PUBLIC_DEMO !== 'true') {
    console.error('Este protótipo não tem autenticação. Use localhost; para um ambiente isolado de demonstração defina ALLOW_PUBLIC_DEMO=true.');
    store.close(); process.exit(1);
  }
  server.listen(Number(process.env.PORT || 3001), host, () => console.log(`ObservaMarília API • http://${host}:${server.address().port} • modo demonstração`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { store.close(); process.exit(0); }));
}
