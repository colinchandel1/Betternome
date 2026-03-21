const rateLimit = require('express-rate-limit');
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { checkJwt } = require('../middleware/auth');

const router = express.Router();

// Limit file uploads: 30 per 15 minutes per IP
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many upload requests, please try again later' },
});

// Limit file-list and delete: 120 per 15 minutes per IP
const fileLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

// Allowed MIME types
const ALLOWED_MIME = new Set([
  'application/pdf',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/webm',
  'audio/mp4',
  'audio/aac',
  'audio/flac',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, _file, cb) => {
    const ext = path.extname(_file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and audio files are allowed'));
    }
  },
});

/** Remove a multer-uploaded temp file (if present) then send an error response. */
function rejectWithFile(req, res, status, message) {
  if (req.file) {
    fs.unlink(req.file.path, () => {});
  }
  return res.status(status).json({ error: message });
}

/** Resolve the DB user from the JWT */
function requireUser(req, res, next) {
  const user = db.prepare('SELECT * FROM users WHERE auth0_id = ?').get(req.auth.sub);
  if (!user) {
    return res.status(401).json({ error: 'User not found – call GET /api/users/me first' });
  }
  req.dbUser = user;
  next();
}

/**
 * POST /api/classrooms/:classroomId/files
 * Upload a file into a classroom.
 *
 * Body (multipart/form-data):
 *   file      – the file to upload
 *   file_type – 'classroom_resource' (instructor only) | 'personal_submission' (students)
 */
router.post(
  '/:classroomId/files',
  uploadLimiter,
  checkJwt,
  requireUser,
  upload.single('file'),
  (req, res) => {
    const { classroomId } = req.params;
    const { file_type } = req.body;

    if (!file_type || !['classroom_resource', 'personal_submission'].includes(file_type)) {
      return rejectWithFile(req, res, 400, "file_type must be 'classroom_resource' or 'personal_submission'");
    }

    const classroom = db.prepare('SELECT * FROM classrooms WHERE id = ?').get(classroomId);
    if (!classroom) {
      return rejectWithFile(req, res, 404, 'Classroom not found');
    }

    const isInstructor = req.dbUser.role === 'instructor';
    const isClassroomOwner = classroom.instructor_id === req.dbUser.id;
    const isEnrolled = !!db
      .prepare(
        'SELECT 1 FROM classroom_enrollments WHERE classroom_id = ? AND student_id = ?'
      )
      .get(classroomId, req.dbUser.id);

    if (!isClassroomOwner && !isEnrolled) {
      return rejectWithFile(req, res, 403, 'Access denied to this classroom');
    }

    // Only instructors (owners) can upload classroom resources
    if (file_type === 'classroom_resource' && !isClassroomOwner) {
      return rejectWithFile(req, res, 403, 'Only the classroom instructor can add resources');
    }

    // Students can only upload personal submissions
    if (!isInstructor && file_type !== 'personal_submission') {
      return rejectWithFile(req, res, 403, 'Students may only submit personal submissions');
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const id = uuidv4();
    db.prepare(
      `INSERT INTO files (id, classroom_id, uploader_id, file_type, original_name, stored_name, mime_type, size)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      classroomId,
      req.dbUser.id,
      file_type,
      req.file.originalname,
      req.file.filename,
      req.file.mimetype,
      req.file.size
    );

    const record = db.prepare('SELECT * FROM files WHERE id = ?').get(id);
    res.status(201).json(record);
  }
);

/**
 * GET /api/classrooms/:classroomId/files
 * List files in a classroom.
 * - Instructors see all files.
 * - Students see classroom_resources + their own personal_submissions.
 */
router.get('/:classroomId/files', fileLimiter, checkJwt, requireUser, (req, res) => {
  const { classroomId } = req.params;

  const classroom = db.prepare('SELECT * FROM classrooms WHERE id = ?').get(classroomId);
  if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

  const isClassroomOwner = classroom.instructor_id === req.dbUser.id;
  const isEnrolled = !!db
    .prepare(
      'SELECT 1 FROM classroom_enrollments WHERE classroom_id = ? AND student_id = ?'
    )
    .get(classroomId, req.dbUser.id);

  if (!isClassroomOwner && !isEnrolled) {
    return res.status(403).json({ error: 'Access denied to this classroom' });
  }

  let files;
  if (isClassroomOwner) {
    files = db
      .prepare(
        `SELECT f.*, u.name AS uploader_name FROM files f
         JOIN users u ON f.uploader_id = u.id
         WHERE f.classroom_id = ?
         ORDER BY f.created_at DESC`
      )
      .all(classroomId);
  } else {
    files = db
      .prepare(
        `SELECT f.*, u.name AS uploader_name FROM files f
         JOIN users u ON f.uploader_id = u.id
         WHERE f.classroom_id = ?
           AND (f.file_type = 'classroom_resource' OR f.uploader_id = ?)
         ORDER BY f.created_at DESC`
      )
      .all(classroomId, req.dbUser.id);
  }

  res.json(files);
});

/**
 * DELETE /api/classrooms/:classroomId/files/:fileId
 * Instructors can delete any file in their classroom.
 * Students can delete only their own submissions.
 */
router.delete('/:classroomId/files/:fileId', fileLimiter, checkJwt, requireUser, (req, res) => {
  const { classroomId, fileId } = req.params;

  const classroom = db.prepare('SELECT * FROM classrooms WHERE id = ?').get(classroomId);
  if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

  const file = db
    .prepare('SELECT * FROM files WHERE id = ? AND classroom_id = ?')
    .get(fileId, classroomId);
  if (!file) return res.status(404).json({ error: 'File not found' });

  const isOwner = classroom.instructor_id === req.dbUser.id;
  const isUploader = file.uploader_id === req.dbUser.id;

  if (!isOwner && !isUploader) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Remove from disk
  const filePath = path.join(UPLOADS_DIR, file.stored_name);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  db.prepare('DELETE FROM files WHERE id = ?').run(fileId);
  res.status(204).end();
});

// Multer error handler
router.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large (max 50 MB)' });
  }
  if (err.message === 'Only PDF and audio files are allowed') {
    return res.status(415).json({ error: err.message });
  }
  res.status(500).json({ error: 'Upload error' });
});

module.exports = router;
