import { Routes, Route } from 'react-router-dom';
import Home from './Home';
import Signup from './Signup';
import Login from './Login';
import Dashboard from './Dashboard';
import InstructorDashboard from './InstructorDashboard';
import './App.css';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/instructor" element={<InstructorDashboard/>} />
    </Routes>
  );
}

export default App;