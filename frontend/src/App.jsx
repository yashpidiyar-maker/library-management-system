import React, { useState } from 'react';
import AdminDashboard from './components/AdminDashboard';
import UserSearch from './components/UserSearch';

export default function App() {
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '', role: 'USER' });
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('search');

  const handleAuth = async (e, type) => {
    e.preventDefault();
    const endpoint = type === 'login' ? '/api/auth/login' : '/api/auth/register';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(authForm)
    });
    const data = await res.json();
    if (res.ok && type === 'login') {
      localStorage.setItem('token', data.token);
      setUser(data.user);
      if(data.user.role === 'ADMIN') setTab('admin');
    } else if (res.ok) {
      alert("Registration successful! Proceed to log in.");
    } else {
      alert(data.error || "Authentication procedure failed.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      <nav className="bg-slate-900 text-white p-4 flex justify-between items-center">
        <h1 className="font-extrabold text-xl tracking-wide">MITS-DU Library Ecosystem</h1>
        <div className="flex gap-4">
          <button onClick={() => setTab('search')} className={`px-3 py-1 rounded ${tab === 'search' ? 'bg-emerald-600' : ''}`}>Search Catalog</button>
          {user?.role === 'ADMIN' && (
            <button onClick={() => setTab('admin')} className={`px-3 py-1 rounded ${tab === 'admin' ? 'bg-blue-600' : ''}`}>Admin Controls</button>
          )}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto my-8 px-4">
        {!user ? (
          <div className="max-w-md mx-auto bg-white p-6 rounded-xl shadow-md">
            <h3 className="text-xl font-bold mb-4 text-center">Identity Portal Authentication</h3>
            <form onSubmit={(e) => handleAuth(e, 'login')} className="space-y-3">
              <input type="text" placeholder="Username (For Registration Only)" onChange={e => setAuthForm({...authForm, username: e.target.value})} className="w-full border p-2 rounded" />
              <input type="email" placeholder="Email Address" onChange={e => setAuthForm({...authForm, email: e.target.value})} className="w-full border p-2 rounded" required />
              <input type="password" placeholder="Password String" onChange={e => setAuthForm({...authForm, password: e.target.value})} className="w-full border p-2 rounded" required />
              <div className="flex gap-2">
                <button type="submit" className="w-1/2 bg-slate-800 text-white p-2 rounded font-medium">Log In</button>
                <button type="button" onClick={(e) => handleAuth(e, 'register')} className="w-1/2 bg-slate-200 p-2 rounded font-medium text-slate-700">Register</button>
              </div>
              <div className="pt-2 text-center">
                <label className="text-xs text-gray-500 font-medium">Desired Account Role (For Registration): </label>
                <select value={authForm.role} onChange={e => setAuthForm({...authForm, role: e.target.value})} className="border text-xs rounded p-1 ml-1 bg-gray-50">
                  <option value="USER">Standard User</option>
                  <option value="ADMIN">System Administrator</option>
                </select>
              </div>
            </form>
          </div>
        ) : (
          <div>
            <div className="mb-4 text-sm text-gray-600 flex justify-between bg-white p-3 rounded-lg shadow-sm">
              <span>Logged in as: <strong>{user.username}</strong> ({user.role})</span>
              <button onClick={() => { localStorage.removeItem('token'); setUser(null); setTab('search'); }} className="text-red-600 underline font-semibold">Sign Out</button>
            </div>
            {tab === 'admin' ? <AdminDashboard /> : <UserSearch />}
          </div>
        )}
      </main>
    </div>
  );
}
