import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const publicRoot = await realpath(fileURLToPath(new URL('../public', import.meta.url)));
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('PORT must be an integer between 1 and 65535.');
  process.exit(1);
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function isInsidePublic(filePath) {
  const relative = path.relative(publicRoot, filePath);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

async function findFile(pathname) {
  const target = path.resolve(publicRoot, `.${pathname}`);
  if (!isInsidePublic(target)) return null;

  // Firebase clean URLs allow /resume to serve resume.html.
  const candidates = [target];
  if (!path.extname(target) && !pathname.endsWith('/')) candidates.push(`${target}.html`);
  candidates.push(path.join(target, 'index.html'));

  for (const candidate of candidates) {
    try {
      const resolved = await realpath(candidate);
      if (isInsidePublic(resolved) && (await stat(resolved)).isFile()) return resolved;
    } catch (error) {
      if (!['ENOENT', 'ENOTDIR', 'EACCES'].includes(error.code)) throw error;
    }
  }
  return null;
}

const server = createServer(async (request, response) => {
  const sendText = (status, message, headers = {}) => {
    response.writeHead(status, {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    });
    response.end(request.method === 'HEAD' ? undefined : message);
  };

  if (!['GET', 'HEAD'].includes(request.method)) {
    sendText(405, 'Method not allowed', { Allow: 'GET, HEAD' });
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    if (pathname.includes('\0') || pathname.includes('\\')) throw new Error('Invalid path');
  } catch {
    sendText(400, 'Bad request');
    return;
  }

  // Match Firebase's exclusion of hidden files and directories.
  if (pathname.split('/').some(segment => segment.startsWith('.'))) {
    sendText(404, 'Not found');
    return;
  }

  try {
    const file = await findFile(pathname);
    if (!file) {
      sendText(404, 'Not found');
      return;
    }
    const contents = await readFile(file);
    response.writeHead(200, {
      'Content-Type': mimeTypes[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': contents.length,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(request.method === 'HEAD' ? undefined : contents);
  } catch (error) {
    console.error('Could not serve request:', error.message);
    sendText(500, 'Internal server error');
  }
});

server.on('error', error => {
  console.error(error.code === 'EADDRINUSE'
    ? `Port ${port} is already in use. Set PORT to another port and retry.`
    : error.message);
  process.exitCode = 1;
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Portfolio running at http://127.0.0.1:${port}`);
  console.log('Serving public/. Press Ctrl+C to stop.');
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close());
}
