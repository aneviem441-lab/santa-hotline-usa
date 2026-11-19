import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { dirname, join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..');
const PORT = process.env.PORT || 3456;
const HOST = process.env.HOST || '0.0.0.0';

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const path = url.pathname;
    const method = req.method || 'GET';

    if (method !== 'GET' && method !== 'HEAD') {
      res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Method Not Allowed');
      return;
    }

    if (path === '/healthz' || path === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, app: 'santa-hotline-usa', status: 'online' }));
      return;
    }

    // Media assets (/santa/assets/* and /assets/*)
    if (path.startsWith('/santa/assets/') || path.startsWith('/assets/')) {
      const fileName = decodeURIComponent(path.replace(/^\/(?:santa\/assets|assets)\//, ''));
      const safeFile = join(ROOT_DIR, 'public', 'santa', 'assets', fileName);
      if (resolve(safeFile).startsWith(join(ROOT_DIR, 'public', 'santa', 'assets'))) {
        try {
          const ext = extname(safeFile).toLowerCase();
          const mime =
            ext === '.png'
              ? 'image/png'
              : ext === '.jpg' || ext === '.jpeg'
                ? 'image/jpeg'
                : ext === '.mp3'
                  ? 'audio/mpeg'
                  : ext === '.m4a'
                    ? 'audio/mp4'
                    : ext === '.webm'
                      ? 'audio/webm'
                      : 'application/octet-stream';

          const fileStat = await stat(safeFile);
          const totalSize = fileStat.size;
          const range = req.headers.range;

          if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
            const chunkSize = end - start + 1;

            res.writeHead(206, {
              'Content-Range': `bytes ${start}-${end}/${totalSize}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': chunkSize,
              'Content-Type': mime,
              'Cache-Control': 'public, max-age=86400'
            });
            createReadStream(safeFile, { start, end }).pipe(res);
            return;
          }

          res.writeHead(200, {
            'Content-Type': mime,
            'Content-Length': totalSize,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=86400'
          });
          createReadStream(safeFile).pipe(res);
          return;
        } catch {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Asset not found');
          return;
        }
      }
    }

    // Live Voice Call (/call or /call.html)
    if (path === '/call' || path === '/call.html' || path === '/us/call') {
      const html = await readFile(join(ROOT_DIR, 'public', 'santa', 'call.html'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(method === 'HEAD' ? undefined : html);
      return;
    }

    // Robots
    if (path === '/robots.txt') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end("User-agent: *\nAllow: /\n");
      return;
    }

    // Root route: US Santa Landing Page
    const html = await readFile(join(ROOT_DIR, 'public', 'santa', 'index.html'), 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(method === 'HEAD' ? undefined : html);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal Server Error: ' + err.message);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Santa Hotline USA running on http://${HOST}:${PORT}`);
});
