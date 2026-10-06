/** A tiny static server for e2e fixtures, on two origins (for cross-origin iframes). */
import { createServer, type Server } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
};

export interface FixtureServer {
  /** http://127.0.0.1:<port> */
  url: string;
  /** A second origin serving the same files: http://127.0.0.1:<other port> */
  other: string;
  close(): Promise<void>;
}

function listen(handler: Parameters<typeof createServer>[1]): Promise<{ server: Server; url: string }> {
  const server = createServer(handler);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

/**
 * Serves tests/fixtures. In HTML, __OTHER__ is replaced by the other origin.
 *   /csp/<file>   the file with a strict Content-Security-Policy (no inline styles)
 *   /spa/<route>  spa.html (pushState routes)
 */
export async function startServer(root: string): Promise<FixtureServer> {
  const origins: string[] = [];
  const handler = (self: number) => (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => {
    let path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    if (path === '/favicon.ico') {
      res.writeHead(204);
      res.end();
      return;
    }
    const headers: Record<string, string> = { 'cache-control': 'no-store' };
    if (path.startsWith('/csp/')) {
      path = path.slice(4);
      headers['content-security-policy'] =
        "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:";
    }
    if (path.startsWith('/spa/')) path = '/spa.html';
    const file = join(root, path);
    if (!existsSync(file)) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
      return;
    }
    let body: Buffer | string = readFileSync(file);
    if (extname(file) === '.html') body = body.toString('utf8').replaceAll('__OTHER__', origins[1 - self]!);
    headers['content-type'] = TYPES[extname(file)] ?? 'application/octet-stream';
    res.writeHead(200, headers);
    res.end(body);
  };
  const a = await listen(handler(0));
  const b = await listen(handler(1));
  origins.push(a.url, b.url);
  return {
    url: a.url,
    other: b.url,
    close: async () => {
      await Promise.all([a, b].map(({ server }) => new Promise<void>((r) => server.close(() => r()))));
    },
  };
}
