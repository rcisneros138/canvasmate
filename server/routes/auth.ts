import { Router } from 'express';
import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${buf.toString('hex')}`;
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, key] = hash.split(':');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  const keyBuf = Buffer.from(key, 'hex');
  return timingSafeEqual(buf, keyBuf);
}

export function authRouter(db: Database.Database) {
  const router = Router();

  router.post('/register', async (req, res) => {
    const { email, password } = req.body;
    const id = nanoid(12);
    const passwordHash = await hashPassword(password);

    try {
      db.prepare('INSERT INTO organizers (id, email, password_hash) VALUES (?, ?, ?)').run(id, email, passwordHash);
    } catch {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const token = nanoid(32);
    return res.status(201).json({ id, token });
  });

  router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const org = db.prepare('SELECT * FROM organizers WHERE email = ?').get(email) as any;

    if (!org || !(await verifyPassword(password, org.password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = nanoid(32);
    return res.status(200).json({ id: org.id, token });
  });

  return router;
}
