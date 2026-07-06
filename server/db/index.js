// server/db/index.js
// This file sets up a single, reusable connection pool to our Postgres database.
// A "pool" manages multiple connections efficiently instead of opening/closing
// a brand new connection for every single query — important once we have
// more than one request happening at a time.

const { Pool } = require('pg');
require('dotenv').config(); // loads variables from server/.env into process.env

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // pulled from .env, never hardcoded
  ssl: { rejectUnauthorized: false } // Neon requires SSL; this setting allows their certificate setup to work
});

// We export a query function instead of the raw pool so other files
// (like our route handlers) don't need to import 'pg' directly.
// This also gives us one central place to add logging or error handling later.
module.exports = {
  query: (text, params) => pool.query(text, params),
};