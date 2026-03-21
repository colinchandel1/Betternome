const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { checkJwt, requireRole } = require('../middleware/auth');

const router = express.Router();

/** Resolve the DB user from the JWT, attaching it to req.dbUser */
function requireUser(req, res, next) {
  const user = db.prepare('SELECT * FROM users WHERE auth0_id = ?').get(req.auth.sub);
  if (!user) {
    return res.status(401).json({ error: 'User not found – call GET /api/users/me first' });
  }
  req.dbUser = user;
  next();
}

/**
 * GET /api/classrooms
 * Instructors see classrooms they own.
 * Students see classrooms they are enrolled in.
 */
router.get('/', checkJwt, requireUser, (req, res) => {
  let classrooms;
  if (req.dbUser.role === 'instructor') {
    classrooms = db
      .prepare('SELECT * FROM classrooms WHERE instructor_id = ? ORDER BY created_at DESC')
      .all(req.dbUser.id);
  } else {
    classrooms = db
      .prepare(
        `SELECT c.* FROM classrooms c
         JOIN classroom_enrollments e ON c.id = e.classroom_id
         WHERE e.student_id = ?
         ORDER BY c.created_at DESC`
      )
      .all(req.dbUser.id);
  }
  res.json(classrooms);
});

/**
 * GET /api/classrooms/:id
 * Returns classroom details (instructor or enrolled student only).
 */
router.get('/:id', checkJwt, requireUser, (req, res) => {
  const classroom = db.prepare('SELECT * FROM classrooms WHERE id = ?').get(req.params.id);
  if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

  const canAccess =
    classroom.instructor_id === req.dbUser.id ||
    !!db
      .prepare(
        'SELECT 1 FROM classroom_enrollments WHERE classroom_id = ? AND student_id = ?'
      )
      .get(req.params.id, req.dbUser.id);

  if (!canAccess) return res.status(403).json({ error: 'Access denied' });

  // Attach enrollment list for instructors
  if (req.dbUser.role === 'instructor') {
    const students = db
      .prepare(
        `SELECT u.id, u.name, u.email FROM users u
         JOIN classroom_enrollments e ON u.id = e.student_id
         WHERE e.classroom_id = ?`
      )
      .all(req.params.id);
    return res.json({ ...classroom, students });
  }

  res.json(classroom);
});

/**
 * POST /api/classrooms
 * Instructors only – create a new classroom.
 */
router.post('/', checkJwt, requireUser, requireRole('instructor'), (req, res) => {
  const { name, description } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Classroom name is required' });
  }

  const id = uuidv4();
  db.prepare(
    `INSERT INTO classrooms (id, name, description, instructor_id) VALUES (?, ?, ?, ?)`
  ).run(id, name.trim(), description || '', req.dbUser.id);

  const classroom = db.prepare('SELECT * FROM classrooms WHERE id = ?').get(id);
  res.status(201).json(classroom);
});

/**
 * DELETE /api/classrooms/:id
 * Instructors only – delete a classroom they own.
 */
router.delete('/:id', checkJwt, requireUser, requireRole('instructor'), (req, res) => {
  const classroom = db.prepare('SELECT * FROM classrooms WHERE id = ?').get(req.params.id);
  if (!classroom) return res.status(404).json({ error: 'Classroom not found' });
  if (classroom.instructor_id !== req.dbUser.id) {
    return res.status(403).json({ error: 'You do not own this classroom' });
  }

  db.prepare('DELETE FROM classrooms WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

/**
 * POST /api/classrooms/:id/enroll
 * Students only – enroll in a classroom.
 */
router.post('/:id/enroll', checkJwt, requireUser, requireRole('student'), (req, res) => {
  const classroom = db.prepare('SELECT * FROM classrooms WHERE id = ?').get(req.params.id);
  if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

  const already = db
    .prepare(
      'SELECT 1 FROM classroom_enrollments WHERE classroom_id = ? AND student_id = ?'
    )
    .get(req.params.id, req.dbUser.id);

  if (already) return res.status(409).json({ error: 'Already enrolled' });

  db.prepare(
    'INSERT INTO classroom_enrollments (classroom_id, student_id) VALUES (?, ?)'
  ).run(req.params.id, req.dbUser.id);

  res.status(201).json({ message: 'Enrolled successfully' });
});

module.exports = router;
