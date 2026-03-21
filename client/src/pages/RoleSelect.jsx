import React, { useState } from 'react';

export default function RoleSelect({ onSelect }) {
  const [loading, setLoading] = useState('');

  async function choose(role) {
    setLoading(role);
    await onSelect(role);
    setLoading('');
  }

  return (
    <div className="role-select-page">
      <h2 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Welcome to Betternome!</h2>
      <p style={{ color: '#636e72', marginTop: '.5rem' }}>
        How will you be using this platform?
      </p>
      <div className="role-cards">
        <button
          className="role-card"
          onClick={() => choose('instructor')}
          disabled={!!loading}
          aria-label="Join as instructor"
        >
          <div className="role-card-icon">🎓</div>
          <div className="role-card-title">Instructor</div>
          <p style={{ fontSize: '.82rem', color: '#636e72', marginTop: '.4rem' }}>
            Create and manage classrooms, upload resources
          </p>
        </button>
        <button
          className="role-card"
          onClick={() => choose('student')}
          disabled={!!loading}
          aria-label="Join as student"
        >
          <div className="role-card-icon">📚</div>
          <div className="role-card-title">Student</div>
          <p style={{ fontSize: '.82rem', color: '#636e72', marginTop: '.4rem' }}>
            Enroll in classrooms, access resources, submit work
          </p>
        </button>
      </div>
      {loading && <p style={{ marginTop: '1.5rem', color: '#6c63ff' }}>Setting up your account…</p>}
    </div>
  );
}
