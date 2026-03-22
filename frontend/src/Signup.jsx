import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

function Signup() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(0);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const response = await fetch('http://localhost:8000/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role })
      });
      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('token', data.token);
        navigate('/dashboard');
      } else {
        const errorData = await response.json();
        setError(errorData.detail);
      }
    } catch (error) { // eslint-disable-line no-unused-vars
      setError('An error occurred. Please try again.');
    }
  };

  return (
    <div>
      <Link to="/">Back to Home</Link>
      <form onSubmit={handleSubmit}>
        <h2>Sign Up</h2>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <input 
          type="text" 
          placeholder="Username" 
          value={username} 
          onChange={(e) => setUsername(e.target.value)} 
          required 
        />
        <input 
          type="password" 
          placeholder="Password" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          required 
        />
        <input
          id="role-checkbox"
          type="checkbox"
          placeholder="Role"
          checked={role}
          onChange={(e) => setRole(e.target.checked ? 1 : 0)}
        />
        <label
          for="role-checkbox"
        >I am an instructor</label>
        <button type="submit">Sign Up</button>
      </form>
    </div>
  );
}

export default Signup;