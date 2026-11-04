// Real-Time Socket.io Context - Unifix Mobile (React Native)
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Platform } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { MobileApiClient } from '../api/mobileClient';
import { SocketEvent } from '@unifix/shared-types';

const DEFAULT_HOST = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

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

interface SocketProviderProps {
  children: React.ReactNode;
  isAuthenticated: boolean;
  campusId?: string | null;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({
  children,
  isAuthenticated,
  campusId,
}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    const token = MobileApiClient.getAccessToken();
    if (!token) return;

    // Connect to backend WebSocket server
    const newSocket = io(DEFAULT_HOST, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      forceNew: true,
    });

    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      console.log('⚡ [Mobile] Connected to Unifix real-time server:', newSocket.id);
      setIsConnected(true);

      // Join campus room upon connection
      if (campusId) {
        newSocket.emit(SocketEvent.JOIN_ROOM, { room: `campus:${campusId}` });
      }
    });

    newSocket.on('disconnect', (reason) => {
      console.log('⚡ [Mobile] Disconnected from real-time server:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.warn('⚡ [Mobile] Socket connection error:', err.message);
      setIsConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated]);

  // Update campus room whenever campusId changes
  useEffect(() => {
    if (!socket || !isConnected || !campusId) return;

    socket.emit(SocketEvent.JOIN_ROOM, { room: `campus:${campusId}` });
  }, [campusId, socket, isConnected]);

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
