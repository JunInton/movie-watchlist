const express = require("express");
const cors = require("cors");
const db= require("./db"); // Import the database connection pool from db/index.js

const app = express();
app.use(cors());
app.use(express.json());

// Health check endpoint to verify that the server is running and responsive
// Runs a trivial query against Postgres to verify that the database connection is working

app.get('/health', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW()'); // NOW() is a built-in Postgres function, returns the current timestamp
    res.json({ status: 'ok', dbTime: result.rows[0].now });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({ status: 'error', message: 'Could not connect to database' });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});