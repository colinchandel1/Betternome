import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import FileUpload from '../components/FileUpload';

function fileBadge(mimeType) {
  if (mimeType === 'application/pdf') return <span className="badge badge-pdf">PDF</span>;
  return <span className="badge badge-audio">Audio</span>;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Classroom({ api, dbUser }) {
  const { id } = useParams();
  const [classroom, setClassroom] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isInstructor = dbUser.role === 'instructor';
  const isOwner = classroom?.instructor_id === dbUser.id;

  async function loadData() {
    try {
      const [cRes, fRes] = await Promise.all([
        api.get(`/api/classrooms/${id}`),
        api.get(`/api/classrooms/${id}/files`),
      ]);
      setClassroom(cRes.data);
      setFiles(fRes.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load classroom.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, [id]);

  async function handleUpload(formData) {
    const res = await api.post(`/api/classrooms/${id}/files`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    setFiles((prev) => [res.data, ...prev]);
  }

  async function deleteFile(fileId) {
    if (!window.confirm('Remove this file?')) return;
    try {
      await api.delete(`/api/classrooms/${id}/files/${fileId}`);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch {
      setError('Failed to delete file.');
    }
  }

  if (loading) return <div className="spinner-wrap"><div className="spinner" /></div>;
  if (error)   return (
    <div className="container" style={{ padding: '2rem' }}>
      <div className="alert alert-error">{error}</div>
      <Link to="/" className="btn btn-ghost" style={{ marginTop: '1rem' }}>← Back</Link>
    </div>
  );

  const resources    = files.filter((f) => f.file_type === 'classroom_resource');
  const submissions  = files.filter((f) => f.file_type === 'personal_submission');

  return (
    <div className="container" style={{ padding: '2rem 1.25rem' }}>
      <Link to="/" className="nav-link" style={{ display: 'inline-block', marginBottom: '1rem' }}>
        ← Dashboard
      </Link>

      <div className="page-header" style={{ flexWrap: 'wrap', gap: '.5rem' }}>
        <div>
          <h1 className="page-title">{classroom.name}</h1>
          {classroom.description && (
            <p style={{ color: '#636e72', marginTop: '.25rem' }}>{classroom.description}</p>
          )}
          <div style={{ fontSize: '.75rem', color: '#b2bec3', marginTop: '.25rem' }}>
            Classroom ID: <code>{classroom.id}</code>
          </div>
        </div>
      </div>

      {/* ── Classroom Resources ────────────────────── */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '.5rem' }}>
          📂 Classroom Resources
        </h2>
        <p style={{ color: '#636e72', fontSize: '.85rem', marginBottom: '.75rem' }}>
          Shared materials uploaded by the instructor.
        </p>

        {resources.length === 0 ? (
          <p style={{ color: '#b2bec3', fontSize: '.88rem' }}>No resources yet.</p>
        ) : (
          <div className="file-list">
            {resources.map((f) => (
              <div key={f.id} className="file-item">
                {fileBadge(f.mime_type)}
                <span className="file-item-name">{f.original_name}</span>
                <span className="file-item-meta">{formatBytes(f.size)}</span>
                {isOwner && (
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => deleteFile(f.id)}
                    title="Delete"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Only the owning instructor can upload resources */}
        {isOwner && (
          <>
            <hr style={{ margin: '1rem 0', border: 'none', borderTop: '1px solid #f1f2f6' }} />
            <h3 style={{ fontSize: '.95rem', fontWeight: 600 }}>Upload a Resource</h3>
            <FileUpload
              onUpload={handleUpload}
              defaultType="classroom_resource"
              allowResource={true}
            />
          </>
        )}
      </div>

      {/* ── Personal Submissions ───────────────────── */}
      <div className="card">
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '.5rem' }}>
          📤 {isOwner ? 'Student Submissions' : 'My Submissions'}
        </h2>
        <p style={{ color: '#636e72', fontSize: '.85rem', marginBottom: '.75rem' }}>
          {isOwner
            ? 'Personal files submitted by students.'
            : 'Your personal submissions for this classroom.'}
        </p>

        {submissions.length === 0 ? (
          <p style={{ color: '#b2bec3', fontSize: '.88rem' }}>No submissions yet.</p>
        ) : (
          <div className="file-list">
            {submissions.map((f) => (
              <div key={f.id} className="file-item">
                {fileBadge(f.mime_type)}
                <span className="file-item-name">{f.original_name}</span>
                {isOwner && f.uploader_name && (
                  <span className="file-item-meta">by {f.uploader_name}</span>
                )}
                <span className="file-item-meta">{formatBytes(f.size)}</span>
                {(isOwner || f.uploader_id === dbUser.id) && (
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => deleteFile(f.id)}
                    title="Delete"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Students (and non-owner instructors) can upload personal submissions */}
        {!isOwner && (
          <>
            <hr style={{ margin: '1rem 0', border: 'none', borderTop: '1px solid #f1f2f6' }} />
            <h3 style={{ fontSize: '.95rem', fontWeight: 600 }}>Submit a File</h3>
            <FileUpload
              onUpload={handleUpload}
              defaultType="personal_submission"
              allowResource={false}
            />
          </>
        )}
      </div>

      {/* Enrolled students list (instructor only) */}
      {isOwner && classroom.students && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '.75rem' }}>
            👥 Enrolled Students ({classroom.students.length})
          </h2>
          {classroom.students.length === 0 ? (
            <p style={{ color: '#b2bec3', fontSize: '.88rem' }}>No students enrolled yet.</p>
          ) : (
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
              {classroom.students.map((s) => (
                <li key={s.id} style={{ fontSize: '.9rem' }}>
                  {s.name} <span style={{ color: '#b2bec3' }}>({s.email})</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
