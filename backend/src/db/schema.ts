/**
 * SQLite Database Schema
 */
export const SCHEMA = {
  projects: `CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    content TEXT,
    source TEXT NOT NULL CHECK (source IN ('manual', 'github', 'medium', 'resume')),
    source_id TEXT UNIQUE,
    source_url TEXT,
    featured BOOLEAN DEFAULT 0,
    status TEXT DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
    metadata TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    created_by TEXT,
    updated_by TEXT
  )`,
};
