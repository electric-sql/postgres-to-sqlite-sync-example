-- Crate a basic items table in Postgres
CREATE TABLE IF NOT EXISTS items (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT
);

-- Some initial data
INSERT INTO items (name, description) VALUES ('Item 1', 'Description 1');
INSERT INTO items (name, description) VALUES ('Item 2', 'Description 2');
INSERT INTO items (name, description) VALUES ('Item 3', 'Description 3');
