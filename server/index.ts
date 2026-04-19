import express from 'express';
import { createServer } from 'http';

const app = express();
const server = createServer(app);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`CanvasMate server running on port ${PORT}`);
});
