import http from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { getConfig } from '@unifix/shared-config';
import { TokenPayload, SocketEvent } from '@unifix/shared-types';
import logger from './logger';

let io: Server | null = null;

export interface AuthenticatedSocket extends Socket {
  data: {
    user: TokenPayload;
    userId: string;
    campusIds: string[];
    roles: string[];
  };
}

/**
 * Initialize the Socket.io real-time server
 */
export function initSocketServer(httpServer: http.Server): Server {
  const config = getConfig();
  const allowedOrigins = config.webOrigin ? [config.webOrigin] : ['*'];

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins.includes('*') ? true : allowedOrigins,
      credentials: true,
    },
    pingTimeout: 30000,
    pingInterval: 25000,
  });

  // Authentication middleware for socket connections
  io.use((socket: Socket, next) => {
    let token = socket.handshake.auth?.token || socket.handshake.headers?.authorization;

    if (token && typeof token === 'string' && token.startsWith('Bearer ')) {
      token = token.slice(7).trim();
    }

    if (!token || typeof token !== 'string') {
      logger.warn('Socket connection rejected: No token provided', { socketId: socket.id });
      return next(new Error('Authentication required'));
    }

    try {
      const payload = jwt.verify(token, config.jwt.accessSecret) as TokenPayload;
      socket.data = {
        user: payload,
        userId: payload.userId,
        campusIds: payload.campusIds || [],
        roles: payload.roles || [],
      };
      next();
    } catch (err: any) {
      logger.warn('Socket connection rejected: Invalid token', { socketId: socket.id, error: err.message });
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (rawSocket: Socket) => {
    const socket = rawSocket as AuthenticatedSocket;
    const { userId, campusIds, roles } = socket.data;

    logger.info(`⚡ Socket client connected: ${socket.id} (User: ${userId})`);

    // Automatically join personal user room for targeted notifications
    socket.join(`user:${userId}`);

    // Automatically join authorized campus rooms
    campusIds.forEach((campusId) => {
      socket.join(`campus:${campusId}`);
    });

    // Handle room joining requests (e.g. focused ticket details)
    socket.on(SocketEvent.JOIN_ROOM, (data: { room: string }) => {
      const { room } = data || {};
      if (!room || typeof room !== 'string') return;

      if (room.startsWith('campus:')) {
        const campusId = room.split(':')[1];
        const isAuthorized =
          campusIds.includes(campusId) || roles.includes('SUPERMANAGEMENT');
        if (isAuthorized) {
          socket.join(room);
          logger.debug(`Socket ${socket.id} joined room ${room}`);
        } else {
          logger.warn(`Unauthorized room join attempt for ${room} by socket ${socket.id}`);
        }
      } else if (room.startsWith('ticket:')) {
        socket.join(room);
        logger.debug(`Socket ${socket.id} joined room ${room}`);
      }
    });

    // Handle room leaving requests
    socket.on(SocketEvent.LEAVE_ROOM, (data: { room: string }) => {
      const { room } = data || {};
      if (room && typeof room === 'string') {
        socket.leave(room);
        logger.debug(`Socket ${socket.id} left room ${room}`);
      }
    });

    socket.on('disconnect', (reason) => {
      logger.info(`⚡ Socket client disconnected: ${socket.id} (Reason: ${reason})`);
    });
  });

  logger.info('✅ Socket.io real-time engine initialized');
  return io;
}

/**
 * Access the active Socket.io server instance
 */
export function getIO(): Server | null {
  return io;
}

/**
 * Emit an event to all clients in a specific campus
 */
export function emitToCampus(campusId: string, event: SocketEvent | string, data: any): void {
  if (!io) return;
  io.to(`campus:${campusId}`).emit(event, data);
}

/**
 * Emit an event to all clients viewing/subscribed to a specific ticket
 */
export function emitToTicket(ticketId: string, event: SocketEvent | string, data: any): void {
  if (!io) return;
  io.to(`ticket:${ticketId}`).emit(event, data);
}

/**
 * Emit an event to a specific user
 */
export function emitToUser(userId: string, event: SocketEvent | string, data: any): void {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
}

/**
 * Broadcast an event to all connected clients
 */
export function emitGlobal(event: SocketEvent | string, data: any): void {
  if (!io) return;
  io.emit(event, data);
}
