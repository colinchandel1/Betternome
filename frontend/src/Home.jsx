import { Link } from 'react-router-dom';

function Home() {
  const token = localStorage.getItem('token');
  const isLoggedIn = !!token;

  return (
    <div className="home">
      <h1>Welcome to Betternome</h1>
      {isLoggedIn ? (
        <div>
          <p>You are logged in!</p>
          <Link to="/dashboard">
            <button>Go to Dashboard</button>
          </Link>
          <button onClick={() => { localStorage.removeItem('token'); window.location.reload(); }}>Logout</button>
        </div>
      ) : (
        <div>
          <p>Please choose an option:</p>
          <Link to="/signup">
            <button>Sign Up</button>
          </Link>
          <Link to="/login">
            <button>Login</button>
          </Link>
        </div>
      )}
    </div>
  );
}

export default Home;