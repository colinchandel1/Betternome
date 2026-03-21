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

  useEffect(() => {
    if (!token) {
      alert('You must log in first');
      navigate('/login');
    }
  }, [token, navigate]);

  const [enrollments, setEnrollments] = useState([]);

  useEffect(() => {
    const response = fetch("http://localhost:8000/enrollments", {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    response.then(async (response) => {
      if (response.ok) {
          const data = await (response).json();
          setEnrollments(data.enrollments)
        } else {
          const errorData = await response.json();
          setError(errorData.detail);
        }
    })
  })

  if (!token) {
    return null; // Prevent rendering while redirecting
  }

  // Decode JWT payload to get username
  const payload = JSON.parse(atob(token.split('.')[1]));
  const username = payload.username;

  // todo: make different page for teachers
  const role = payload.role;

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
    </div>
  );
}

export default Dashboard;