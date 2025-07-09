import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

// Try to get socket URL from environment or try common ports
const getSocketUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_WS_URL;
  if (envUrl) return envUrl;
  
  // Try common ports
  const commonPorts = [3001, 3002, 3003, 3004, 3005];
  const currentPort = window.location.port;
  
  // If we're on a specific port, try the backend port
  if (currentPort) {
    const backendPort = parseInt(currentPort) - 29; // 3030 -> 3001
    if (backendPort > 0) {
      return `ws://localhost:${backendPort}`;
    }
  }
  
  // Default fallback
  return 'ws://localhost:3001';
};

export interface SocketState {
  socket: Socket | null;
  isConnected: boolean;
  error: string | null;
  reconnectAttempts: number;
}

export const useSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  useEffect(() => {
    const SOCKET_URL = getSocketUrl();
    console.log('Attempting to connect to:', SOCKET_URL);
    
    const socketInstance = io(SOCKET_URL, {
      transports: ['websocket'],
      timeout: 20000,
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      reconnectionDelayMax: 5000,
    });

    socketInstance.on('connect', () => {
      setIsConnected(true);
      setError(null);
      setReconnectAttempts(0);
      console.log('Socket connected to:', SOCKET_URL);
    });

    socketInstance.on('disconnect', (reason) => {
      setIsConnected(false);
      console.log('Socket disconnected:', reason);
      
      if (reason === 'io server disconnect') {
        // Server disconnected, try to reconnect
        socketInstance.connect();
      }
    });

    socketInstance.on('connect_error', (err) => {
      setError(err.message);
      setIsConnected(false);
      setReconnectAttempts(prev => prev + 1);
      console.error('Socket connection error:', err);
    });

    socketInstance.on('error', (err) => {
      setError(err.message);
      console.error('Socket error:', err);
    });

    socketInstance.on('reconnect', (attemptNumber) => {
      console.log('Socket reconnected after', attemptNumber, 'attempts');
      setReconnectAttempts(0);
    });

    socketInstance.on('reconnect_attempt', (attemptNumber) => {
      console.log('Socket reconnection attempt:', attemptNumber);
      setReconnectAttempts(attemptNumber);
    });

    socketInstance.on('reconnect_error', (err) => {
      console.error('Socket reconnection error:', err);
    });

    socketInstance.on('reconnect_failed', () => {
      console.error('Socket reconnection failed');
      setError('Failed to reconnect to server');
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.close();
    };
  }, []);

  const emit = useCallback((event: string, data?: any) => {
    if (socket && isConnected) {
      socket.emit(event, data);
      return true;
    }
    return false;
  }, [socket, isConnected]);

  const on = useCallback((event: string, callback: (data: any) => void) => {
    if (socket) {
      socket.on(event, callback);
    }
  }, [socket]);

  const off = useCallback((event: string, callback?: (data: any) => void) => {
    if (socket) {
      socket.off(event, callback);
    }
  }, [socket]);

  const forceReconnect = useCallback(() => {
    if (socket) {
      socket.disconnect();
      socket.connect();
    }
  }, [socket]);

  return {
    socket,
    isConnected,
    error,
    reconnectAttempts,
    emit,
    on,
    off,
    forceReconnect,
  };
};