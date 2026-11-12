import { CLIENT_PORT } from '@quiz/shared';
import { createApp } from './app';
import { getLanIp, PORT } from './config';

const { httpServer, clientBuilt } = createApp();

httpServer.listen(PORT, () => {
  // With a client build everything lives on PORT; otherwise the Vite dev server serves the pages.
  const pagesPort = clientBuilt ? PORT : CLIENT_PORT;
  const lanIp = getLanIp();
  console.log(`[server] API і Socket.IO: http://localhost:${PORT}`);
  if (!clientBuilt) {
    console.log('[server] client/dist не знайдено — сервер працює лише як API. Режим одного порту: npm run build');
  }
  const mode = clientBuilt ? '' : '   (dev-режим: запустіть npm run dev)';
  console.log(`[server] Ведучий: http://localhost:${pagesPort}/quizzes${mode}`);
  console.log(`[server] Гравці:  ${lanIp ? `http://${lanIp}:${pagesPort}` : 'LAN-адресу не знайдено — підключіть ноутбук до мережі'}`);
});
