import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

function CourseList(courses) {

  const listCourses = courses.courses.map(course => <li>{course}</li>)

  return <ul>{listCourses}</ul>
}


function Dashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [error, setError] = useState('');
  const [courseToEnroll, setCourseToEnroll] = useState('');
  const [enrollments, setEnrollments] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [latestFiles, setLatestFiles] = useState({});
  const [latestAudio, setLatestAudio] = useState({});

  // Decode JWT payload to get username and role
  let username = '';
  let role = null;
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      username = payload.username;
      role = payload.role;
    } catch (e) {}
  }

  useEffect(() => {
    if (!token) {
      alert('You must log in first');
      navigate('/login');
    } else if (role === 1) {
      // Instructor role, redirect to instructor dashboard
      navigate('/instructor');
    }
  }, [token, role, navigate]);

  useEffect(() => {
    if (!token || role === 1) return;
    const fetchEnrollments = () => {
      fetch("http://localhost:8000/enrollments", {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(async (response) => {
          if (response.ok) {
            const data = await response.json();
            setEnrollments(data.enrollments);
          } else {
            const errorData = await response.json();
            setError(errorData.detail);
          }
        });
    };
    fetchEnrollments();
    const interval = setInterval(fetchEnrollments, 60000);
    return () => clearInterval(interval);
  }, [token, role]);

  const handleExpand = (course) => {
    setExpanded(prev => ({ ...prev, [course]: !prev[course] }));
    if (!latestFiles[course]) {
      fetch(`http://localhost:8000/music-scores/recent?class_name=${encodeURIComponent(course)}&limit=3`)
        .then(async (response) => {
          if (response.ok) {
            const data = await response.json();
            setLatestFiles(prev => ({ ...prev, [course]: data.files }));
          }
        });
    }

    if (!latestAudio[course]) {
      fetch(`http://localhost:8000/audio-files/recent?class_name=${encodeURIComponent(course)}&limit=3`)
        .then(async (response) => {
          if (response.ok) {
            const data = await response.json();
            setLatestAudio(prev => ({ ...prev, [course]: data.files }));
          }
        });
    }
  };

  /** TODO: make course page and route it (with variable course name) */
  const goToCoursePage = (course) => {
    // Placeholder: navigate to a blank course page
    navigate(`/course/${encodeURIComponent(course)}`);
  };

  /** For sandbox, not production */
  const enrollInClass = (className) => {
    fetch("http://localhost:8000/do-enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json", 'Authorization': `Bearer ${token}`},
      body: JSON.stringify({ class_name: className})
    })
    .then(async (response) => {
      if (response.ok) {
         console.log("enrolled")
      } else {
         console.log("enrollment failed!")
      }
    })
  }

  /** For sandbox, not production */
  const createClass = (className) => {
    fetch("http://localhost:8000/create-class", {
      method: "POST",
      headers: { "Content-Type": "application/json", 'Authorization': `Bearer ${token}`},
      body: JSON.stringify({ class_name: className})
    })
    .then(async (response) => {
      if (response.ok) {
         console.log("class created")
      } else {
         console.log("class creation failed!")
      }
    })
  }

  if (!token || role === 1) {
    return null;
  }

  return (
    <div>
      <h1>Welcome to Betternome, {username}!</h1>
      <p>You are successfully logged in.</p>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <Link to="/">
        <button>Back to Home</button>
      </Link>
      <button onClick={() => { localStorage.removeItem('token'); navigate('/'); }}>Logout</button>
      <CourseList courses={enrollments}></CourseList>
      <input
          type="text"
          placeholder="Course to enroll"
          value={courseToEnroll}
          onChange={(e) => setCourseToEnroll(e.target.value)}
          required
        />
      <button onClick={() => { enrollInClass(courseToEnroll) }}>Enroll (Sandbox)</button>
      <button onClick={() => { createClass(courseToEnroll) }}>Create Class (Sandbox)</button>

      <div style={{ marginTop: '2em' }}>
        {enrollments.map(course => (
          <div key={course} style={{
            border: '1px solid #888',
            borderRadius: '8px',
            margin: '1em 0',
            display: 'flex',
            alignItems: 'center',
            width: '60%',
            minHeight: '60px',
            background: '#f9f9f9'
          }}>
            <button
              style={{
                margin: '0.5em',
                width: '40px',
                height: '40px',
                fontSize: '1.2em'
              }}
              onClick={() => goToCoursePage(course)}
              title="Go to course page"
            >→</button>
            <button
              style={{
                flex: 1,
                textAlign: 'left',
                background: 'none',
                border: 'none',
                fontSize: '1.1em',
                padding: '1em',
                cursor: 'pointer',
                color: '#000000'
              }}
              onClick={() => handleExpand(course)}
            >
              {course}
              <span style={{ float: 'right' }}>{expanded[course] ? '▲' : '▼'}</span>
            </button>
            {expanded[course] && (
              <div style={{ width: '100%', background: '#eef', padding: '1em', marginTop: '1em' }}>
                <strong>Latest Scores:</strong>
                <ul>
                  {(latestFiles[course] || []).length === 0 && <li>No files uploaded yet.</li>}
                  {(latestFiles[course] || []).map(file =>
                    <li key={file.id}>
                      {(() => {
                        const fileName = (file.file_path || '').split(/[\\/]/).pop();
                        const url = `http://localhost:8000/files/uploaded_scores/${encodeURIComponent(fileName)}`;
                        return (
                          <a href={url} target="_blank" rel="noopener noreferrer">
                            {fileName}
                          </a>
                        );
                      })()}
                      ({new Date(file.uploaded_at).toLocaleString()})
                    </li>
                  )}
                </ul>

                <strong>Latest Audio:</strong>
                <ul>
                  {(latestAudio[course] || []).length === 0 && <li>No audio uploaded yet.</li>}
                  {(latestAudio[course] || []).map(file =>
                    <li key={file.id}>
                      {(() => {
                        const fileName = (file.file_path || '').split(/[\\/]/).pop();
                        const url = `http://localhost:8000/files/audio_uploads/${encodeURIComponent(fileName)}`;
                        return (
                          <a href={url} target="_blank" rel="noopener noreferrer">
                            {fileName}
                          </a>
                        );
                      })()}
                      ({new Date(file.uploaded_at).toLocaleString()})
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;
