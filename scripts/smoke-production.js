#!/usr/bin/env node

const DEFAULT_BASE_URL = 'https://cinelinks.vercel.app';
const DEPTH_SAMPLE = 'bjiHEhuiwhIygzjczbTPAA07cGc.jpg';

function madridDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function parseArgs(argv) {
  const args = { baseUrl: process.env.CINELINKS_BASE_URL || DEFAULT_BASE_URL, skipDepth: false };
  for (const arg of argv) {
    if (arg === '--skip-depth') args.skipDepth = true;
    else if (arg.startsWith('--base-url=')) args.baseUrl = arg.slice('--base-url='.length);
    else if (/^https?:\/\//i.test(arg)) args.baseUrl = arg;
    else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  args.baseUrl = args.baseUrl.replace(/\/+$/, '');
  return args;
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal, redirect: 'follow' });
  } finally {
    clearTimeout(timer);
  }
}

async function check(name, path, options = {}) {
  const {
    baseUrl,
    timeoutMs = 15000,
    status = 200,
    contentType,
    minBytes = 1,
    validateJson
  } = options;
  const url = `${baseUrl}${path}`;
  const res = await fetchWithTimeout(url, timeoutMs);
  const body = Buffer.from(await res.arrayBuffer());
  const actualType = res.headers.get('content-type') || '';

  if (res.status !== status) {
    throw new Error(`${name}: expected HTTP ${status}, got ${res.status}`);
  }
  if (contentType && !contentType.test(actualType)) {
    throw new Error(`${name}: expected content-type ${contentType}, got ${actualType || '(none)'}`);
  }
  if (body.length < minBytes) {
    throw new Error(`${name}: expected at least ${minBytes} bytes, got ${body.length}`);
  }
  if (validateJson) {
    let json;
    try {
      json = JSON.parse(body.toString('utf8'));
    } catch (error) {
      throw new Error(`${name}: response is not valid JSON`);
    }
    validateJson(json);
  }

  console.log(`ok ${name} ${res.status} ${actualType} ${body.length}b`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const today = madridDateKey();

  await check('home', '/', {
    baseUrl: args.baseUrl,
    contentType: /text\/html/,
    minBytes: 10000
  });
  await check('manifest', '/manifest.webmanifest', {
    baseUrl: args.baseUrl,
    contentType: /(application\/manifest\+json|application\/json)/
  });
  await check('service-worker', '/sw.js', {
    baseUrl: args.baseUrl,
    contentType: /(application|text)\/javascript/
  });
  await check('share-landing', '/s?g=cl&a=Alien&b=Jaws&n=4&to=/', {
    baseUrl: args.baseUrl,
    contentType: /text\/html/,
    minBytes: 500
  });
  await check('daily-api', `/api/daily?date=${today}`, {
    baseUrl: args.baseUrl,
    contentType: /application\/json/,
    validateJson(json) {
      if (!Object.prototype.hasOwnProperty.call(json, 'challenge')) {
        throw new Error('daily-api: missing challenge field');
      }
    }
  });

  if (!args.skipDepth) {
    await check('depth-api', `/api/depth?im=${DEPTH_SAMPLE}`, {
      baseUrl: args.baseUrl,
      timeoutMs: 90000,
      contentType: /image\/jpeg/,
      minBytes: 500
    });
  }
}

main().catch((error) => {
  console.error(`not ok ${error.message}`);
  process.exitCode = 1;
});
