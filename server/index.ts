import express from 'express';
import { createServer } from 'http';
import { createDatabase } from './db/index';
import { sessionsRouter } from './routes/sessions';
import { checkinRouter } from './routes/checkin';
import { assignmentsRouter } from './routes/assignments';
import { authRouter } from './routes/auth';
import { SignalService } from './services/signal';
import { signalSetupRouter } from './routes/signal-setup';
import { purgeExpiredSessions } from './services/cleanup';
import { lockRouter } from './routes/lock';
import { setupWebSocket } from './ws/index';

const app = express();
const server = createServer(app);

const db = createDatabase('./data/canvasmate.db');
const { broadcast } = setupWebSocket(server);

app.use(express.json());
app.use('/api/sessions', sessionsRouter(db));
app.use('/api/checkin', checkinRouter(db));
app.use('/api/assignments', assignmentsRouter(db, broadcast));
app.use('/api/auth', authRouter(db));

const signal = new SignalService(process.env.SIGNAL_API_URL || 'http://localhost:8080');
app.use('/api/signal', signalSetupRouter(db, signal));
app.use('/api/sessions', lockRouter(db, signal, broadcast));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

setInterval(() => purgeExpiredSessions(db), 60 * 60 * 1000); // hourly

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`CanvasMate server running on port ${PORT}`);
});
