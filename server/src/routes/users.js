const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { checkJwt } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/users/me
 * Returns the current user's profile.
 * Creates a new DB record if this is the user's first request (auto-provisioning).
 */
router.get('/me', checkJwt, (req, res) => {
  const auth0Id = req.auth.sub;

  let user = db.prepare('SELECT * FROM users WHERE auth0_id = ?').get(auth0Id);

  if (!user) {
    // Auto-provision: extract name/email from Auth0 token claims
    const name =
      req.auth['https://betternome.app/name'] ||
      req.auth.name ||
      req.auth.nickname ||
      'New User';
    const email =
      req.auth['https://betternome.app/email'] || req.auth.email || '';

    // Default role can be set during registration via custom claim;
    // fall back to 'student'.
    const role =
      req.auth['https://betternome.app/role'] || 'student';

    const id = uuidv4();
    db.prepare(
      `INSERT INTO users (id, auth0_id, name, email, role) VALUES (?, ?, ?, ?, ?)`
    ).run(id, auth0Id, name, email, role);

    user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  }

  res.json(user);
});

/**
 * PATCH /api/users/me/role
 * Updates the current user's role (student or instructor).
 * Allows a user to self-select their role once.
 */
router.patch('/me/role', checkJwt, (req, res) => {
  const auth0Id = req.auth.sub;
  const { role } = req.body;

  if (!role || !['student', 'instructor'].includes(role)) {
    return res.status(400).json({ error: "Role must be 'student' or 'instructor'" });
  }

  const user = db.prepare('SELECT * FROM users WHERE auth0_id = ?').get(auth0Id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  db.prepare('UPDATE users SET role = ? WHERE auth0_id = ?').run(role, auth0Id);
  const updated = db.prepare('SELECT * FROM users WHERE auth0_id = ?').get(auth0Id);
  res.json(updated);
});

module.exports = router;
