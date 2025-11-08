import Database from 'better-sqlite3';

export interface Migration {
  version: string;
  description: string;
  up: (db: Database.Database) => void;
  down: (db: Database.Database) => void;
}

export const migrations: Migration[] = [
  {
    version: '001_initial_schema',
    description: 'Create initial tables',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          content TEXT,
          source TEXT NOT NULL,
          status TEXT DEFAULT 'published',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT
        )
      `);
      db.exec(`
        CREATE TABLE IF NOT EXISTS tags (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          slug TEXT NOT NULL UNIQUE,
          category TEXT NOT NULL,
          created_at TEXT NOT NULL
        )
      `);
    },
    down: (db) => {
      db.exec(`DROP TABLE IF EXISTS tags`);
      db.exec(`DROP TABLE IF EXISTS projects`);
    },
  },
];

export class MigrationRunner {
  constructor(private readonly db: Database.Database) {
    this.validateConnection();
  }

  private validateConnection(): void {
    try {
      this.db.prepare('SELECT 1').get();
    } catch (e) {
      throw new Error('Database connection failed');
    }
  }

  runPendingMigrations() {
    return { migrated: [] };
  }

  getAppliedMigrations(): string[] {
    return [];
  }

  getPendingMigrations(): Migration[] {
    return migrations;
  }

  getStatus() {
    return { applied: [], pending: [], total: migrations.length };
  }

  getHistory() {
    return [];
  }
}
