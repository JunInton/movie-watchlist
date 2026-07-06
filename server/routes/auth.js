// This file handles account creation and login. Keeping these routes
// separate from index.js keeps things organized as the app grows —
// index.js will eventually just wire together many small route files
// like this one, rather than containing all the logic itself.

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db'); // our Postgres connection pool

const router = express.Router(); // Router lets us define routes here and "mount" them in index.js

// POST /signup
// Creates a new user account. Expects { email, password } in the request body.
router.post('/signup', async (req, res) => {
  const { email, password } = req.body;

  // Basic validation — without this, a missing email/password would cause
  // a confusing crash further down instead of a clear error message.
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    // bcrypt.hash's second argument is the "salt rounds" — how many times
    // the hashing algorithm runs. 10 is a widely-used default that balances
    // security with speed (higher = slower to hash, but also slower for
    // an attacker to brute-force if your DB ever leaked).
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert the new user and return their id/email back (never return the hash!).
    // $1/$2 are parameterized query placeholders — using these (instead of
    // building the SQL string with template literals) prevents SQL injection,
    // since pg safely escapes whatever values we pass in the array.
    const result = await db.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, passwordHash]
    );

    const newUser = result.rows[0];

    // Issue a JWT immediately after signup so the user is auto-logged-in,
    // rather than making them log in again right after creating an account.
    // The token's payload just needs enough to identify the user later (their id).
    const token = jwt.sign(
      { userId: newUser.id },
      process.env.JWT_SECRET, // the secret from .env — signs the token so it can't be forged
      { expiresIn: '7d' } // token stays valid for 7 days, then the user must log in again
    );

    res.status(201).json({ user: newUser, token });
  } catch (error) {
    // Postgres error code 23505 = unique constraint violation.
    // Since our `email` column is UNIQUE, this fires if someone tries to
    // sign up with an email that's already taken — we catch it specifically
    // to give a clear message instead of a generic 500 error.
    if (error.code === '23505') {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }

    console.error('Signup error:', error);
    res.status(500).json({ error: 'Something went wrong creating your account.' });
  }
});

// POST /login
// Verifies credentials and returns a JWT if they're correct.
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    // Deliberately vague error message here (not "email not found" vs "wrong password") —
    // being specific about which part was wrong helps attackers confirm which emails
    // have accounts registered. A single generic message avoids leaking that info.
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // bcrypt.compare re-hashes the submitted password using the same salt
    // stored in the existing hash, then checks if the results match —
    // this is why we never need to "decrypt" the stored hash to check it.
    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ user: { id: user.id, email: user.email }, token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Something went wrong logging in.' });
  }
});

module.exports = router;