import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';

function Dashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) {
      alert('You must log in first');
      navigate('/login');
    }
  }, [token, navigate]);

  if (!token) {
    return null; // Prevent rendering while redirecting
  }

  // Decode JWT payload to get username
  const payload = JSON.parse(atob(token.split('.')[1]));
  const username = payload.username;

  return (
    <div>
      <h1>Welcome to Betternome, {username}!</h1>
      <p>You are successfully logged in.</p>
      <Link to="/">
        <button>Back to Home</button>
      </Link>
      <button onClick={() => { localStorage.removeItem('token'); navigate('/'); }}>Logout</button>
    </div>
  );
}

export default Dashboard;