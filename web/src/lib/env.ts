/**
 * Signaling server URL: unset (Vite dev) falls back to the local server; empty (built image) becomes
 * undefined so socket.io uses the same origin, since nginx reverse-proxies /socket.io behind the tunnel.
 */
const rawSocketUrl = import.meta.env.VITE_SOCKET_URL;
export const SOCKET_URL: string | undefined =
  rawSocketUrl === undefined ? 'http://localhost:3001' : rawSocketUrl || undefined;

/** Build the WebRTC ICE server list from env, for NAT traversal (STUN always, TURN when configured) */
export const buildIceServers = (): RTCIceServer[] => {
  const servers: RTCIceServer[] = [];

  // Always include a STUN server so peers can discover their public address
  const stunUrl = import.meta.env.VITE_STUN_URL;
  if (stunUrl) {
    servers.push({ urls: stunUrl });
  }

  // Include TURN only when fully configured, so relay fallback works behind strict NATs
  const turnUrl = import.meta.env.VITE_TURN_URL;
  const turnUsername = import.meta.env.VITE_TURN_USERNAME;
  const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL;
  if (turnUrl && turnUsername && turnCredential) {
    servers.push({ urls: turnUrl, username: turnUsername, credential: turnCredential });
  }

  return servers;
};
