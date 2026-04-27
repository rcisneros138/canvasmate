import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase } from './index';

describe('database', () => {
  let db: ReturnType<typeof createDatabase>;

  beforeEach(() => {
    db = createDatabase(':memory:');
  });

  it('creates sessions table', () => {
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'"
    ).all();
    expect(tables).toHaveLength(1);
  });

  it('creates lists table', () => {
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='lists'"
    ).all();
    expect(tables).toHaveLength(1);
  });

  it('creates groups table', () => {
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='groups'"
    ).all();
    expect(tables).toHaveLength(1);
  });

  it('creates canvassers table', () => {
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='canvassers'"
    ).all();
    expect(tables).toHaveLength(1);
  });

  it('creates settings table', () => {
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='settings'"
    ).all();
    expect(tables).toHaveLength(1);
  });

  it('groups have a group_lead_canvasser_id column', () => {
    const cols = db.prepare("PRAGMA table_info(groups)").all() as any[];
    expect(cols.some(c => c.name === 'group_lead_canvasser_id')).toBe(true);
  });
});
