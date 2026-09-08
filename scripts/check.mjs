import { readFile, realpath, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const publicRoot = await realpath(fileURLToPath(new URL('../public', import.meta.url)));
const origin = 'http://portfolio.local';
const errors = new Set();
const visited = new Set();
const documents = new Map();
let references = 0;
let scripts = 0;

function relativeName(file) {
  return path.relative(publicRoot, file).split(path.sep).join('/');
}

function isInsidePublic(file) {
  const relative = path.relative(publicRoot, file);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function decodeEntities(value) {
  return value.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi, entity => {
    const named = { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>' };
    if (named[entity.toLowerCase()]) return named[entity.toLowerCase()];
    const code = entity[2].toLowerCase() === 'x'
      ? parseInt(entity.slice(3, -1), 16)
      : parseInt(entity.slice(2, -1), 10);
    return code <= 0x10ffff ? String.fromCodePoint(code) : entity;
  });
}

async function resolveFile(pathname) {
  const decoded = decodeURIComponent(pathname);
  if (decoded.includes('\0') || decoded.includes('\\')) return null;
  const target = path.resolve(publicRoot, `.${decoded}`);
  if (!isInsidePublic(target)) return null;
  const candidates = [target];
  if (!path.extname(target) && !decoded.endsWith('/')) candidates.push(`${target}.html`);
  candidates.push(path.join(target, 'index.html'));
  for (const candidate of candidates) {
    try {
      const resolved = await realpath(candidate);
      if (isInsidePublic(resolved) && (await stat(resolved)).isFile()) return resolved;
    } catch (error) {
      if (!['ENOENT', 'ENOTDIR'].includes(error.code)) throw error;
    }
  }
  return null;
}

async function getDocument(file) {
  if (!documents.has(file)) {
    const source = (await readFile(file, 'utf8')).replace(/<!--[\s\S]*?-->/g, '');
    const ids = new Set();
    for (const match of source.matchAll(/\b(?:id|name)\s*=\s*(["'])(.*?)\1/gis)) {
      ids.add(decodeEntities(match[2]));
    }
    documents.set(file, { source, ids });
  }
  return documents.get(file);
}

async function checkReference(value, sourceFile, { moduleImport = false } = {}) {
  const reference = decodeEntities(value).trim();
  if (!reference) return;
  if (moduleImport && !reference.startsWith('.') && !reference.startsWith('/')) return;
  let url;
  try {
    url = new URL(reference, `${origin}/${relativeName(sourceFile)}`);
  } catch {
    errors.add(`${relativeName(sourceFile)}: invalid URL ${reference}`);
    return;
  }
  if (url.origin !== origin) return;
  references += 1;
  let target;
  try {
    target = await resolveFile(url.pathname);
  } catch {
    errors.add(`${relativeName(sourceFile)}: invalid local path ${reference}`);
    return;
  }
  if (!target) {
    errors.add(`${relativeName(sourceFile)}: missing local resource ${reference}`);
    return;
  }
  if (url.hash && path.extname(target) === '.html') {
    let id;
    try {
      id = decodeURIComponent(url.hash.slice(1));
    } catch {
      errors.add(`${relativeName(sourceFile)}: invalid fragment ${reference}`);
      return;
    }
    if (!(await getDocument(target)).ids.has(id)) {
      errors.add(`${relativeName(sourceFile)}: missing anchor ${reference}`);
    }
  }
  await inspect(target);
}

async function inspect(file) {
  if (visited.has(file)) return;
  visited.add(file);
  const extension = path.extname(file).toLowerCase();
  if (extension === '.html') {
    const { source } = await getDocument(file);
    for (const match of source.matchAll(/\b(?:href|src|poster)\s*=\s*(["'])(.*?)\1/gis)) {
      await checkReference(match[2], file);
    }
  } else if (extension === '.css') {
    const source = (await readFile(file, 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
    for (const match of source.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gi)) {
      await checkReference(match[1] ?? match[2] ?? match[3], file);
    }
    for (const match of source.matchAll(/@import\s+(["'])(.*?)\1/gi)) {
      await checkReference(match[2], file);
    }
  } else if (['.js', '.mjs'].includes(extension)) {
    scripts += 1;
    const source = await readFile(file, 'utf8');
    const result = spawnSync(process.execPath, ['--check', '--input-type=module'], {
      input: source,
      encoding: 'utf8',
      windowsHide: true,
    });
    if (result.status !== 0) {
      errors.add(`${relativeName(file)}: JavaScript syntax check failed\n${result.stderr || result.error?.message}`);
    }
    for (const match of source.matchAll(/(?:\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?|\bimport\s*\(\s*)["']([^"']+)["']/g)) {
      await checkReference(match[1], file, { moduleImport: true });
    }
  }
}

for (const name of ['index.html', 'styles.css', 'app.js', 'world.js', 'resume.html', 'Resume_Amaldev.pdf']) {
  const file = await resolveFile(`/${name}`);
  if (!file) errors.add(`Missing required file: public/${name}`);
  else await inspect(file);
}

if (errors.size) {
  console.error(`Static checks failed (${errors.size}):\n${[...errors].map(error => `- ${error}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Static checks passed: ${visited.size} files, ${references} local references, ${scripts} JavaScript syntax checks.`);
}
