import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';

const PORT = parseInt(process.env.PORT || '3002', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_CHANNEL = 'payrollpro:events';

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

async function main() {
  const server = createServer();
  const wss = new WebSocketServer({ server });

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

  const redisClient = new Redis(REDIS_URL);

  wss.on('connection', (socket: AuthedSocket, request) => {
    socket.isAlive = true;

    try {
      const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
      const token = url.searchParams.get('token');
      if (!token) {
        socket.close(4001, 'Missing token');
        return;
      }
      const decoded = jwt.verify(token, JWT_SECRET) as { id: string; role: string; email?: string };
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      socket.userEmail = decoded.email;
      addConnection(socket);

      sendToSocket(socket, {
        event: 'connected',
        type: 'system',
        data: { userId: decoded.id, role: decoded.role },
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