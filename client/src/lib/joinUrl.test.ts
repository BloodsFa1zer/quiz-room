import { describe, expect, it } from 'vitest';
import { buildJoinUrl } from './joinUrl';

const PIN = '123456';
const LAN_IP = '192.168.1.7';

describe('buildJoinUrl', () => {
  it('replaces localhost with the LAN IP and keeps the port', () => {
    const loc = { protocol: 'http:', hostname: 'localhost', port: '5173' };
    expect(buildJoinUrl(PIN, LAN_IP, loc)).toBe('http://192.168.1.7:5173/?pin=123456');
  });

  it('replaces 127.0.0.1 with the LAN IP and keeps the port', () => {
    const loc = { protocol: 'http:', hostname: '127.0.0.1', port: '5173' };
    expect(buildJoinUrl(PIN, LAN_IP, loc)).toBe('http://192.168.1.7:5173/?pin=123456');
  });

  it('keeps localhost when the server reports no LAN IP', () => {
    const loc = { protocol: 'http:', hostname: 'localhost', port: '5173' };
    expect(buildJoinUrl(PIN, null, loc)).toBe('http://localhost:5173/?pin=123456');
  });

  it('keeps the host when the page is already opened by an IP address', () => {
    const loc = { protocol: 'http:', hostname: '192.168.1.7', port: '5173' };
    expect(buildJoinUrl(PIN, '10.0.0.5', loc)).toBe('http://192.168.1.7:5173/?pin=123456');
  });

  it('keeps a tunnel domain without a port as is', () => {
    const loc = { protocol: 'https:', hostname: 'demo.example.com', port: '' };
    expect(buildJoinUrl(PIN, LAN_IP, loc)).toBe('https://demo.example.com/?pin=123456');
  });
});
