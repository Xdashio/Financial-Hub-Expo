import * as fs from 'fs';
import * as path from 'path';

// Regression guard for H14: database.types.ts used to hand-type only 11 of
// 27+ tables, so every new migration's table silently started without a
// Database['public']['Tables'] row — no compile error, just drift. Supabase
// CLI type generation (`supabase gen types typescript`) is unavailable in
// this environment, so this test is the fallback "types are current" check:
// it fails loudly when a migration creates a table with no Tables entry, or
// when a Tables entry has no backing table.
//
// It is deliberately regex-based (not a full SQL parser): the repo's own
// migrations use one `CREATE TABLE IF NOT EXISTS public.<name> (` statement
// per table, always at the start of a line, and Tables keys are the 6-space
// indented `name: {` entries — a stable convention guarded by this same test.

const MIGRATIONS_DIR = path.resolve(__dirname, 'migrations');
const TYPES_FILE = path.resolve(__dirname, 'database.types.ts');

function migrationTableNames(): string[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  const names = new Set<string>();
  for (const file of fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql'))) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    for (const line of sql.split('\n')) {
      const m = line.match(/^CREATE TABLE (?:IF NOT EXISTS )?(?:public\.)?([a-z_]+)\s*\(/i);
      if (m) names.add(m[1]);
    }
  }
  return [...names].sort();
}

function typedTableNames(): string[] {
  if (!fs.existsSync(TYPES_FILE)) return [];
  const src = fs.readFileSync(TYPES_FILE, 'utf8');
  const names = new Set<string>();
  for (const line of src.split('\n')) {
    // Database['public']['Tables'] keys are indented exactly 6 spaces.
    const m = line.match(/^ {6}([a-z_]+): \{/);
    if (m) names.add(m[1]);
  }
  return [...names].sort();
}

describe('database.types.ts vs migration schema (H14)', () => {
  const tables = migrationTableNames();
  const typed = typedTableNames();

  it('finds the migrations to check', () => {
    expect(tables.length).toBeGreaterThan(0);
  });

  it('every table created by a migration has a Database.Tables entry', () => {
    const missing = tables.filter(t => !typed.includes(t));
    expect(missing).toEqual([]);
  });

  it('every Database.Tables entry is backed by a real migration table (no phantom types)', () => {
    const phantom = typed.filter(t => !tables.includes(t));
    expect(phantom).toEqual([]);
  });
});