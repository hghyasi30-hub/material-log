-- Users (people who can log in)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Projects (self-contained - subs/materials belong to exactly one project)
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_window_days INTEGER NOT NULL DEFAULT 28,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Subcontractors (belong to one project only, never shared)
CREATE TABLE subcontractors (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Materials (belong to one subcontractor)
CREATE TABLE materials (
  id SERIAL PRIMARY KEY,
  subcontractor_id INTEGER NOT NULL REFERENCES subcontractors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  lead_time_weeks NUMERIC NOT NULL DEFAULT 0,
  needed_on_site_date DATE NOT NULL,
  ordered BOOLEAN NOT NULL DEFAULT FALSE,
  ordered_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_subs_project ON subcontractors(project_id);
CREATE INDEX idx_materials_sub ON materials(subcontractor_id);
