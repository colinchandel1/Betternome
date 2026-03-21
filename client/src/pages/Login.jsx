import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';

export default function Login() {
  const { loginWithRedirect } = useAuth0();

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">🎵</div>
        <h1 className="login-title">Betternome</h1>
        <p className="login-subtitle">
          A music classroom platform for instructors and students.
        </p>

        <button
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', padding: '0.8rem' }}
          onClick={() => loginWithRedirect()}
        >
          Log in
        </button>

        <hr className="login-divider" />

        <button
          className="btn btn-ghost"
          style={{ width: '100%', justifyContent: 'center', padding: '0.8rem' }}
          onClick={() =>
            loginWithRedirect({
              authorizationParams: { screen_hint: 'signup' },
            })
          }
        >
          Create account
        </button>

        <p className="login-footer">
          Powered by Auth0 · Betternome prototype
        </p>
      </div>
    </div>
  );
}
