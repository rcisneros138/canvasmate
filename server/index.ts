import express from 'express';
import { createServer } from 'http';
import { createDatabase } from './db/index';
import { sessionsRouter } from './routes/sessions';
import { checkinRouter } from './routes/checkin';
import { setupWebSocket } from './ws/index';

const app = express();
const server = createServer(app);

const db = createDatabase('./data/canvasmate.db');
const { broadcast } = setupWebSocket(server);

app.use(express.json());
app.use('/api/sessions', sessionsRouter(db));
app.use('/api/checkin', checkinRouter(db));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`CanvasMate server running on port ${PORT}`);
});
