import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

const PORT = parseInt(process.env.PORT || '3002', 10);
const JWT_SECRET = process.env.JWT_SECRET ?? (() => {
  throw new Error('[websocket] Missing required environment variable: JWT_SECRET');
})();
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_CHANNEL = 'payrollpro:events';
const WS_TICKET_PREFIX = 'ws:ticket:';
const TICKET_TTL_SECONDS = 15;

interface AuthedSocket extends WebSocket {
  userId?: string;
  userRole?: string;
  userEmail?: string;
  isAlive?: boolean;
}

// userId -> set of connections (multiple tabs/devices)
const connections = new Map<string, Set<AuthedSocket>>();
const roleConnections = new Map<string, Set<AuthedSocket>>();

function addConnection(socket: AuthedSocket) {
  if (!socket.userId) return;
  if (!connections.has(socket.userId)) connections.set(socket.userId, new Set());
  connections.get(socket.userId)!.add(socket);
  if (socket.userRole) {
    if (!roleConnections.has(socket.userRole)) roleConnections.set(socket.userRole, new Set());
    roleConnections.get(socket.userRole)!.add(socket);
  }
}

function removeConnection(socket: AuthedSocket) {
  if (!socket.userId) return;
  const userSet = connections.get(socket.userId);
  if (userSet) {
    userSet.delete(socket);
    if (userSet.size === 0) connections.delete(socket.userId);
  }
  if (socket.userRole) {
    const roleSet = roleConnections.get(socket.userRole);
    if (roleSet) {
      roleSet.delete(socket);
      if (roleSet.size === 0) roleConnections.delete(socket.userRole);
    }
  }
}

function sendToSocket(socket: AuthedSocket, payload: unknown) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function broadcastEvent(event: any) {
  const payload = { event: event.event || 'event', type: event.type || 'notification', data: event.data ?? null, timestamp: Date.now() };

  if (event.toUserId) {
    const userSockets = connections.get(event.toUserId);
    if (userSockets) {
      for (const socket of userSockets) sendToSocket(socket, payload);
    }
    return;
  }

  if (event.targetRole) {
    const roleSockets = roleConnections.get(event.targetRole);
    if (roleSockets) {
      for (const socket of roleSockets) sendToSocket(socket, payload);
    }
    return;
  }

  // Broadcast to all connected clients
  for (const sockets of connections.values()) {
    for (const socket of sockets) sendToSocket(socket, payload);
  }
}

async function issueTicket(
  req: import('http').IncomingMessage,
  res: import('http').ServerResponse,
  redisClient: Redis,
): Promise<void> {
  const writeJson = (code: number, body: unknown) => {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) {
    writeJson(401, { success: false, error: 'Missing access token' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; role: string; email?: string; type?: string };
    if (decoded.type === 'refresh' || !decoded.id) {
      writeJson(401, { success: false, error: 'Invalid token' });
      return;
    }

    // Single-use ticket bound to the validated access token, short TTL.
    const ticket = randomUUID();
    const claims = JSON.stringify({ id: decoded.id, role: decoded.role, email: decoded.email ?? undefined });
    await redisClient.set(WS_TICKET_PREFIX + ticket, claims, 'EX', TICKET_TTL_SECONDS);

    writeJson(200, { success: true, data: { ticket, expiresIn: TICKET_TTL_SECONDS } });
  } catch {
    writeJson(401, { success: false, error: 'Invalid token' });
  }
}

async function main() {
  const server = createServer();
  const wss = new WebSocketServer({
    server,
    // Echo the browser-provided Sec-WebSocket-Protocol value so it can carry
    // the access token without ever appearing in the URL (browsers cannot set
    // custom headers on a WebSocket handshake).
    handleProtocols(protocols) {
      const first = protocols.values().next().value;
      return first ? first : false;
    },
  });

  const redisClient = new Redis(REDIS_URL);

  server.on('request', (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', service: 'websocket' }));
      return;
    }
    if (url.pathname === '/ticket') {
      void issueTicket(req, res, redisClient);
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const subscriber = new Redis(REDIS_URL);
  await subscriber.subscribe(REDIS_CHANNEL);
  subscriber.on('message', (channel, message) => {
    if (channel !== REDIS_CHANNEL) return;
    try {
      const event = JSON.parse(message);
      broadcastEvent(event);
    } catch (err) {
      console.error('[websocket] Failed to parse Redis event:', err);
    }
  });

  wss.on('connection', async (socket: AuthedSocket, request) => {
    socket.isAlive = true;

    try {
      const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
      const ticket = url.searchParams.get('ticket');

      let userId: string;
      let role: string;
      let email: string | undefined;

      if (ticket) {
        // Single-use, short-lived ticket issued via POST /ticket against the
        // Authorization header. It binds a freshly validated access token to a
        // user id and expires after TICKET_TTL_SECONDS, so the access token
        // itself never travels through the URL.
        const ticketKey = WS_TICKET_PREFIX + ticket;
        const raw = await redisClient.get(ticketKey);
        await redisClient.del(ticketKey);
        if (!raw) {
          socket.close(4002, 'Invalid or expired ticket');
          return;
        }
        const claims = JSON.parse(raw) as { id: string; role: string; email?: string };
        userId = claims.id;
        role = claims.role;
        email = claims.email;
      } else {
        // Browser-friendly alternative: access token via Sec-WebSocket-Protocol.
        // refresh tokens must NEVER be accepted here.
        const proto = request.headers['sec-websocket-protocol'];
        const token = proto ? proto.split(',')[0].trim() : '';
        if (!token) {
          socket.close(4001, 'Missing token');
          return;
        }
        const decoded = jwt.verify(token, JWT_SECRET) as { id: string; role: string; email?: string; type?: string };
        if (decoded.type === 'refresh' || !decoded.id) {
          socket.close(4003, 'Invalid token');
          return;
        }
        userId = decoded.id;
        role = decoded.role;
        email = decoded.email;
      }

      socket.userId = userId;
      socket.userRole = role;
      socket.userEmail = email;
      addConnection(socket);

      sendToSocket(socket, {
        event: 'connected',
        type: 'system',
        data: { userId, role },
        timestamp: Date.now(),
      });
    } catch {
      socket.close(4003, 'Invalid token');
    }

    socket.on('pong', () => {
      socket.isAlive = true;
    });

    socket.on('message', (raw) => {
      try {
        const message = JSON.parse(raw.toString());
        // Client can request online presence or send an ack; system events are published by services.
        if (message.type === 'ping') {
          sendToSocket(socket, { event: 'pong', type: 'system', timestamp: Date.now() });
        }
      } catch {
        // ignore non-JSON client messages
      }
    });

    socket.on('close', () => {
      removeConnection(socket);
    });
  });

  // Heartbeat: terminate dead connections every 30s
  const heartbeat = setInterval(() => {
    wss.clients.forEach((socket: any) => {
      if (!socket.isAlive) {
        socket.terminate();
        return;
      }
      socket.isAlive = false;
      socket.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(heartbeat));

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`WebSocket server running on port ${PORT}`);
    void redisClient;
  });
}

if (process.env.NODE_ENV !== 'test') {
  main().catch((err) => {
    console.error('[websocket] Fatal error:', err);
    process.exit(1);
  });
}