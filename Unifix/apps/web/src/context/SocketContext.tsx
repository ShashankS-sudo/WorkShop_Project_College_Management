import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { SocketEvent } from '@unifix/shared-types';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  joinRoom: (room: string) => void;
  leaveRoom: (room: string) => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  joinRoom: () => {},
  leaveRoom: () => {},
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, activeCampus } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    if (!isAuthenticated) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    const token = localStorage.getItem('unifix_access_token');
    if (!token) return;

    // Use production backend host if configured, otherwise current origin in dev
    const envApiUrl = import.meta.env.VITE_API_URL;
    const socketUrl = envApiUrl ? envApiUrl.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '') : window.location.origin;

    const newSocket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    newSocket.on('connect', () => {
      console.log('⚡ Connected to Unifix real-time server:', newSocket.id);
      setIsConnected(true);

      // Join active campus room upon connect
      if (activeCampus?.id) {
        newSocket.emit(SocketEvent.JOIN_ROOM, { room: `campus:${activeCampus.id}` });
      }
    });

    newSocket.on('disconnect', (reason) => {
      console.log('⚡ Disconnected from real-time server:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.warn('Real-time connection error:', err.message);
      setIsConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [isAuthenticated]);

  // Update campus room whenever activeCampus changes
  useEffect(() => {
    if (!socket || !isConnected || !activeCampus?.id) return;

    socket.emit(SocketEvent.JOIN_ROOM, { room: `campus:${activeCampus.id}` });
  }, [activeCampus?.id, socket, isConnected]);

  const joinRoom = (room: string) => {
    if (socket && isConnected) {
      socket.emit(SocketEvent.JOIN_ROOM, { room });
    }
  };

  const leaveRoom = (room: string) => {
    if (socket && isConnected) {
      socket.emit(SocketEvent.LEAVE_ROOM, { room });
    }
  };

  return (
    <SocketContext.Provider value={{ socket, isConnected, joinRoom, leaveRoom }}>
      {children}
    </SocketContext.Provider>
  );
};
