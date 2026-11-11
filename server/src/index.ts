import { createApp } from './app';
import { getLanIp, PORT } from './config';

const { httpServer } = createApp();

httpServer.listen(PORT, () => {
  console.log(`[server] http://localhost:${PORT}`);
  const lanIp = getLanIp();
  if (lanIp) console.log(`[server] http://${lanIp}:${PORT}`);
});
