/**
 * Container healthcheck for notification-service.
 *
 * The service is a queue consumer with no HTTP surface, so the meaningful
 * liveness question is "can it still reach Redis?". The previous healthcheck
 * was `node -e "process.exit(0)"`, which always succeeded and therefore told
 * the operator nothing at all.
 *
 * Exits 0 when Redis answers PING, 1 otherwise. Deliberately dependency-free
 * (raw RESP over a TCP socket) so it does not load the service's bundle or
 * open a Prisma connection on every probe.
 */

const net = require('node:net');
const { URL } = require('node:url');

const TIMEOUT_MS = 5000;

function fail(message) {
  // Never print the URL itself: it carries the Redis password.
  console.error(`[healthcheck] unhealthy: ${message}`);
  process.exit(1);
}

const raw = process.env.REDIS_URL;
if (!raw) fail('REDIS_URL is not set');

let url;
try {
  url = new URL(raw);
} catch {
  fail('REDIS_URL is not a valid URL');
}

const host = url.hostname || '127.0.0.1';
const port = Number(url.port || 6379);
const password = url.password ? decodeURIComponent(url.password) : '';

/** Encode a Redis command as a RESP array. */
function resp(...args) {
  return (
    `*${args.length}\r\n` +
    args.map((arg) => `$${Buffer.byteLength(arg)}\r\n${arg}\r\n`).join('')
  );
}

const socket = net.connect({ host, port });
socket.setTimeout(TIMEOUT_MS);

let buffer = '';
let authPending = password !== '';

socket.on('connect', () => {
  if (authPending) socket.write(resp('AUTH', password));
  socket.write(resp('PING'));
});

socket.on('data', (chunk) => {
  buffer += chunk.toString('utf8');

  if (buffer.includes('-NOAUTH') || buffer.includes('-ERR invalid password')) {
    socket.destroy();
    fail('Redis rejected our credentials');
  }

  if (buffer.includes('+PONG')) {
    socket.end();
    process.exit(0);
  }

  // An error reply to AUTH on a server with no password set is harmless; keep
  // waiting for the PONG from the PING that follows it.
  if (buffer.includes('-ERR') && !authPending) {
    socket.destroy();
    fail(`Redis returned an error reply: ${buffer.trim().split('\r\n')[0]}`);
  }
  authPending = false;
});

socket.on('timeout', () => {
  socket.destroy();
  fail(`no response from Redis at ${host}:${port} within ${TIMEOUT_MS}ms`);
});

socket.on('error', (err) => {
  fail(`cannot reach Redis at ${host}:${port} (${err.code || err.message})`);
});
