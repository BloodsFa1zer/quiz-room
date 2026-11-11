import { useEffect, useState } from 'react';
import { socket } from '../lib/socket';

/** Tells whether the socket is connected to the server right now. */
export function useConnection(): boolean {
  const [connected, setConnected] = useState(socket.connected);

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    // The socket may have connected between the first render and this effect.
    setConnected(socket.connected);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  return connected;
}
