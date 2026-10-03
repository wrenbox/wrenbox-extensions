/** A tiny static server for e2e fixtures (and generated PDFs). */
import { createServer, type Server } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.pdf': 'application/pdf',
  '.js': 'text/javascript',
};

export interface FixtureServer {
  url: string;
  close(): Promise<void>;
}

/**
 * Serves tests/fixtures. Extra routes:
 *   /spa.html/*      → spa.html (pushState routes)
 *   /cors/<file>.pdf → the file with Access-Control-Allow-Origin: *
 *   /nocors/<file>.pdf → the file without CORS headers
 */
export function startServer(
  root: string,
  extra: Record<string, Buffer> = {},
): Promise<FixtureServer> {
  const server: Server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    if (path === '/favicon.ico') {
      res.writeHead(204);
      res.end();
      return;
    }
    let file = path;
    let cors = false;
    if (path.startsWith('/spa.html')) file = '/spa.html';
    if (path.startsWith('/cors/')) {
      file = path.slice('/cors'.length);
      cors = true;
    }
    if (path.startsWith('/nocors/')) file = path.slice('/nocors'.length);
    const body =
      extra[file] ?? (existsSync(join(root, file)) ? readFileSync(join(root, file)) : null);
    if (!body) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
      return;
    }
    const headers: Record<string, string> = {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    };
    if (cors) headers['access-control-allow-origin'] = '*';
    res.writeHead(200, headers);
    res.end(body);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}
