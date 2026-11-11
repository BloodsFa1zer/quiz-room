import { SERVER_PORT } from '@quiz/shared';
import { createApp } from './app';

const { httpServer } = createApp();
const port = Number(process.env.PORT) || SERVER_PORT;

httpServer.listen(port, () => {
  console.log(`[server] http://localhost:${port}`);
});
