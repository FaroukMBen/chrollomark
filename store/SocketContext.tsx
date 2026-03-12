import React, { createContext, useContext, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import Constants from 'expo-constants';

interface SocketContextType {
  socket: Socket | null;
}

const SocketContext = createContext<SocketContextType>({ socket: null });

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (isAuthenticated && user) {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';
      // Socket.io host should be the same as API but without /api suffix if it has one
      const socketHost = apiUrl.replace(/\/api$/, '');
      
      const socket = io(socketHost, {
        transports: ['websocket'],
        reconnection: true,
      });

      socket.on('connect', () => {
        console.log('⚡ Connected to socket server');
        socket.emit('join', user._id);
      });

      socket.on('disconnect', () => {
        console.log('🔌 Disconnected from socket server');
      });

      socketRef.current = socket;

      return () => {
        socket.disconnect();
        socketRef.current = null;
      };
    }
  }, [isAuthenticated, user]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current }}>
      {children}
    </SocketContext.Provider>
  );
};
