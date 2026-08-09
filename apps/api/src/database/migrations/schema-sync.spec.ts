import * as fs from 'fs';
import * as path from 'path';

// Regression guard for BACKEND_FRONTEND_AUDIT.md §C1: this repo used to have
// two hand-maintained copies of the schema (src/database/migrations and
// supabase/migrations) that silently drifted apart. supabase/migrations is
// now a generated copy (see scripts/sync-supabase-migrations.sh) — this test
// fails loudly if someone edits one without regenerating the other, instead
// of drifting silently again.

const CANONICAL_DIR = __dirname;
const GENERATED_DIR = path.resolve(__dirname, '../../../supabase/migrations');

function versionedSqlFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(f => /^[0-9]/.test(f) && f.endsWith('.sql'))
    .filter(f => !f.endsWith('.spec.sql') && !f.endsWith('.test.sql'))
    .sort();
}

describe('canonical migrations vs generated supabase/migrations', () => {
  const canonicalFiles = versionedSqlFiles(CANONICAL_DIR);

  it('has at least one canonical migration to check', () => {
    expect(canonicalFiles.length).toBeGreaterThan(0);
  });

  it('supabase/migrations/ exists and has been generated (run `npm run db:sync`)', () => {
    expect(fs.existsSync(GENERATED_DIR)).toBe(true);
  });

  for (const file of canonicalFiles) {
    it(`${file} is byte-identical between canonical and generated copies`, () => {
      const canonicalPath = path.join(CANONICAL_DIR, file);
      const generatedPath = path.join(GENERATED_DIR, file);

      expect(fs.existsSync(generatedPath)).toBe(true);

      const canonical = fs.readFileSync(canonicalPath, 'utf8');
      const generated = fs.readFileSync(generatedPath, 'utf8');
      expect(generated).toBe(canonical);
    });
  }

  it('generated dir has no extra migration files the canonical dir lacks', () => {
    const generatedFiles = versionedSqlFiles(GENERATED_DIR);
    expect(generatedFiles.sort()).toEqual(canonicalFiles.sort());
  });
});
