/**
 * Address encoded in the QR code on the host screen.
 * A host who opened the page via localhost would hand out an address that phones cannot reach,
 * so the hostname is replaced with the laptop's LAN IP (reported by the server).
 */
export function buildJoinUrl(
  pin: string,
  lanIp: string | null,
  loc: Pick<Location, 'protocol' | 'hostname' | 'port'> = window.location,
): string {
  const isLocal = loc.hostname === 'localhost' || loc.hostname === '127.0.0.1';
  const hostname = isLocal && lanIp !== null ? lanIp : loc.hostname;
  const port = loc.port === '' ? '' : `:${loc.port}`;
  return `${loc.protocol}//${hostname}${port}/?pin=${pin}`;
}
