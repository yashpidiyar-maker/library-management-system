
import React, { useState } from 'react';
import AdminDashboard from './components/AdminDashboard';
import UserSearch from './components/UserSearch';

export default function App() {
  const [authForm, setAuthForm] = useState({
    username: '',
    email: '',
    password: ''
  });

  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('search');
  const [authMode, setAuthMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');

    if (authMode === 'register' && !authForm.username.trim()) {
      setError('Please enter your username.');
      return;
    }

    setLoading(true);

    try {
      const endpoint =
        authMode === 'login'
          ? '/api/auth/login'
          : '/api/auth/register';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(authForm)
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Authentication failed.');
        return;
      }

      if (authMode === 'login') {
        localStorage.setItem('token', data.token);
        setUser(data.user);
        setTab(data.user.role === 'ADMIN' ? 'admin' : 'search');
        setAuthForm({
          username: '',
          email: '',
          password: ''
        });
      } else {
        alert('Registration successful! Please log in.');
        setAuthMode('login');
        setAuthForm({
          username: '',
          email: authForm.email,
          password: ''
        });
      }

    } catch (err) {
      console.error('Authentication error:', err);
      setError(
        'Cannot connect to the backend. Please check whether the server is running.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setTab('search');
    setAuthMode('login');
    setError('');
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans">

      <nav className="bg-slate-900 text-white p-4 flex flex-wrap justify-between items-center gap-3">
        <h1 className="font-extrabold text-xl tracking-wide">
          MITS-DU Library Ecosystem
        </h1>

        {user && (
          <div className="flex gap-3 items-center">
            <button
              type="button"
              onClick={() => setTab('search')}
              className={`px-3 py-2 rounded ${
                tab === 'search' ? 'bg-emerald-600' : 'hover:bg-slate-700'
              }`}
            >
              Search Catalog
            </button>

            {user.role === 'ADMIN' && (
              <button
                type="button"
                onClick={() => setTab('admin')}
                className={`px-3 py-2 rounded ${
                  tab === 'admin' ? 'bg-blue-600' : 'hover:bg-slate-700'
                }`}
              >
                Admin Controls
              </button>
            )}
          </div>
        )}
      </nav>

      <main className="max-w-6xl mx-auto my-8 px-4">

        {!user ? (
          <div className="max-w-md mx-auto bg-white p-6 rounded-xl shadow-md">

            <h3 className="text-xl font-bold mb-2 text-center">
              Identity Portal Authentication
            </h3>

            <p className="text-sm text-gray-500 text-center mb-5">
              {authMode === 'login'
                ? 'Login to access your library account.'
                : 'Create your library account.'}
            </p>

            <form onSubmit={handleAuth} className="space-y-4">

              {authMode === 'register' && (
                <input
                  type="text"
                  placeholder="Username"
                  value={authForm.username}
                  onChange={e =>
                    setAuthForm({
                      ...authForm,
                      username: e.target.value
                    })
                  }
                  className="w-full border p-3 rounded-lg"
                  required
                />
              )}

              <input
                type="email"
                placeholder="Email Address"
                value={authForm.email}
                onChange={e =>
                  setAuthForm({
                    ...authForm,
                    email: e.target.value
                  })
                }
                className="w-full border p-3 rounded-lg"
                required
              />

              <input
                type="password"
                placeholder="Password"
                value={authForm.password}
                onChange={e =>
                  setAuthForm({
                    ...authForm,
                    password: e.target.value
                  })
                }
                className="w-full border p-3 rounded-lg"
                required
              />

              {error && (
                <div className="bg-red-100 text-red-700 p-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-slate-900 hover:bg-slate-700 disabled:bg-gray-400 text-white p-3 rounded-lg font-semibold"
              >
                {loading
                  ? 'Please wait...'
                  : authMode === 'login'
                    ? 'Log In'
                    : 'Create Account'}
              </button>

            </form>

            <div className="text-center mt-5 text-sm">
              {authMode === 'login' ? (
                <p>
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('register');
                      setError('');
                    }}
                    className="text-blue-600 font-semibold hover:underline"
                  >
                    Register
                  </button>
                </p>
              ) : (
                <p>
                  Already registered?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('login');
                      setError('');
                    }}
                    className="text-blue-600 font-semibold hover:underline"
                  >
                    Login
                  </button>
                </p>
              )}
            </div>

          </div>
        ) : (
          <div>

            <div className="mb-4 text-sm text-gray-600 flex flex-wrap justify-between items-center gap-3 bg-white p-3 rounded-lg shadow-sm">
              <span>
                Logged in as: <strong>{user.username}</strong> ({user.role})
              </span>

              <button
                type="button"
                onClick={handleLogout}
                className="text-red-600 underline font-semibold"
              >
                Sign Out
              </button>
            </div>

            {tab === 'admin' && user.role === 'ADMIN'
              ? <AdminDashboard />
              : <UserSearch />}

          </div>
        )}

      </main>
    </div>
  );
}
