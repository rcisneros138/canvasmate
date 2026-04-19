import Database from 'better-sqlite3';
import { readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createDatabase(path: string) {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Run migrations
  db.exec(`CREATE TABLE IF NOT EXISTS migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  const applied = new Set(
    db.prepare('SELECT name FROM migrations').all().map((r: any) => r.name)
  );

  const migrationFile = '001-initial-schema.sql';
  if (!applied.has(migrationFile)) {
    const sql = readFileSync(join(__dirname, 'migrations', migrationFile), 'utf-8');
    db.exec(sql);
    db.prepare('INSERT INTO migrations (name) VALUES (?)').run(migrationFile);
  }

  return db;
}
