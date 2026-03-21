import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { Link, useNavigate } from 'react-router-dom';

export default function Navbar({ user }) {
  const { logout } = useAuth0();
  const navigate = useNavigate();

  return (
    <nav className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="navbar-brand">🎵 Betternome</Link>
        <div className="navbar-nav">
          {user && (
            <>
              <Link to="/" className="nav-link">Dashboard</Link>
              <span className={`badge badge-${user.role}`}>{user.role}</span>
              {user.picture && (
                <img src={user.picture} alt={user.name} className="user-avatar" />
              )}
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  logout({ logoutParams: { returnTo: window.location.origin } });
                }}
              >
                Log out
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
