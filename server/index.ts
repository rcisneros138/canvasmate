import { buildApp } from './app';
import { purgeExpiredSessions } from './services/cleanup';

const { server, db } = buildApp({
  dbPath: './data/canvasmate.db',
  signalApiUrl: process.env.SIGNAL_API_URL || 'http://localhost:8080',
});

setInterval(() => purgeExpiredSessions(db), 60 * 60 * 1000); // hourly

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`CanvasMate server running on port ${PORT}`);
});
