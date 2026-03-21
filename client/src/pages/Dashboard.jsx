import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

export default function Dashboard({ api, dbUser }) {
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // New-classroom form (instructors only)
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [creating, setCreating] = useState(false);

  // Enroll-by-ID form (students only)
  const [enrollId, setEnrollId] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [enrollMsg, setEnrollMsg] = useState('');

  const isInstructor = dbUser.role === 'instructor';

  async function loadClassrooms() {
    try {
      const res = await api.get('/api/classrooms');
      setClassrooms(res.data);
    } catch {
      setError('Failed to load classrooms.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadClassrooms(); }, []);

  async function createClassroom(e) {
    e.preventDefault();
    if (!formName.trim()) return;
    setCreating(true);
    try {
      const res = await api.post('/api/classrooms', { name: formName, description: formDesc });
      setClassrooms((prev) => [res.data, ...prev]);
      setFormName('');
      setFormDesc('');
      setShowForm(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create classroom.');
    } finally {
      setCreating(false);
    }
  }

  async function enroll(e) {
    e.preventDefault();
    if (!enrollId.trim()) return;
    setEnrolling(true);
    setEnrollMsg('');
    try {
      await api.post(`/api/classrooms/${enrollId.trim()}/enroll`);
      setEnrollMsg('Enrolled! Refreshing…');
      setEnrollId('');
      await loadClassrooms();
    } catch (err) {
      setEnrollMsg(err.response?.data?.error || 'Enrollment failed.');
    } finally {
      setEnrolling(false);
    }
  }

  async function deleteClassroom(id) {
    if (!window.confirm('Delete this classroom? This cannot be undone.')) return;
    try {
      await api.delete(`/api/classrooms/${id}`);
      setClassrooms((prev) => prev.filter((c) => c.id !== id));
    } catch {
      setError('Failed to delete classroom.');
    }
  }

  if (loading) return <div className="spinner-wrap"><div className="spinner" /></div>;

  return (
    <div className="container" style={{ padding: '2rem 1.25rem' }}>
      <div className="page-header">
        <h1 className="page-title">
          {isInstructor ? 'My Classrooms' : 'My Enrolled Classrooms'}
        </h1>
        {isInstructor && (
          <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancel' : '+ New Classroom'}
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Create classroom form */}
      {isInstructor && showForm && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Create a New Classroom</h3>
          <form onSubmit={createClassroom}>
            <div className="form-group">
              <label>Classroom Name *</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Beginner Violin"
                required
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="Optional description…"
                rows={2}
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={creating}>
              {creating ? 'Creating…' : 'Create'}
            </button>
          </form>
        </div>
      )}

      {/* Enroll form for students */}
      {!isInstructor && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '.75rem' }}>Enroll in a Classroom</h3>
          <p style={{ color: '#636e72', fontSize: '.88rem', marginBottom: '.75rem' }}>
            Enter the classroom ID provided by your instructor.
          </p>
          {enrollMsg && (
            <div className={`alert ${enrollMsg.includes('Enrolled') ? 'alert-success' : 'alert-error'}`}>
              {enrollMsg}
            </div>
          )}
          <form onSubmit={enroll} style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              value={enrollId}
              onChange={(e) => setEnrollId(e.target.value)}
              placeholder="Classroom ID"
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" type="submit" disabled={enrolling}>
              {enrolling ? 'Enrolling…' : 'Enroll'}
            </button>
          </form>
        </div>
      )}

      {/* Classroom list */}
      {classrooms.length === 0 ? (
        <div className="empty-state">
          <p style={{ fontSize: '2rem' }}>{isInstructor ? '🏫' : '📖'}</p>
          <p style={{ marginTop: '.5rem' }}>
            {isInstructor
              ? 'No classrooms yet. Create your first one!'
              : 'You are not enrolled in any classrooms yet.'}
          </p>
        </div>
      ) : (
        <div className="classroom-grid">
          {classrooms.map((c) => (
            <div key={c.id} style={{ position: 'relative' }}>
              <Link to={`/classroom/${c.id}`} className="classroom-card">
                <div className="classroom-card-title">{c.name}</div>
                {c.description && (
                  <div className="classroom-card-desc">{c.description}</div>
                )}
                <div style={{ fontSize: '.75rem', color: '#b2bec3', marginTop: '.5rem' }}>
                  ID: {c.id}
                </div>
              </Link>
              {isInstructor && (
                <button
                  className="btn btn-danger btn-sm"
                  style={{ position: 'absolute', top: '.75rem', right: '.75rem' }}
                  onClick={() => deleteClassroom(c.id)}
                  title="Delete classroom"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
