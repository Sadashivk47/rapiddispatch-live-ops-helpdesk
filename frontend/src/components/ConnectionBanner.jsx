import { useState, useEffect } from 'react';
import { socket } from '../socket';

export default function ConnectionBanner() {
  const [isConnected, setIsConnected] = useState(socket.connected);

  useEffect(() => {
    function onConnect() {
      setIsConnected(true);
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    // Initial check
    setIsConnected(socket.connected);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  if (isConnected) {
    return null;
  }

  return (
    <div className="connection-banner" role="alert">
      <span className="banner-icon">⚠️</span>
      <span className="banner-text">Connection Lost: Reconnecting...</span>
    </div>
  );
}
