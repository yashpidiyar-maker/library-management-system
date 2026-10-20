import React, { useState, useEffect } from 'react';

export default function AdminDashboard() {
  const [books, setBooks] = useState([]);
  const [form, setForm] = useState({ title: '', author: '', isbn: '', category: '', total_copies: 1, shelf_location: '', published_year: 2026 });

  const fetchInventory = async () => {
    const res = await fetch('/api/books', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const data = await res.json();
    setBooks(Array.isArray(data) ? data : []);
  };

  useEffect(() => { fetchInventory(); }, []);

  const handleSubmit = async (e) => {
  e.preventDefault();
  
  // 1. Extract the active JWT token saved during login
  const token = localStorage.getItem('token'); 

  try {
    // 2. Dispatch the network payload request
    const res = await fetch('/api/books', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        // Attach the authorization token right here
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify(form) // Matches your dynamic input text hooks setup
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'Error adding book. Ensure user is logged in as ADMIN.');
    } else {
      alert('Success! New book has been securely added to the PostgreSQL catalog database.');
      // Clear your form fields state variables here...
      setForm({ title: '', author: '', isbn: '', category: '', total_copies: 1, shelf_location: '' });
      fetchInventory(); // Triggers real-time re-fetch to display the new entry in the list
    }
  } catch (err) {
    console.error('Network transaction execution error:', err);
    alert('Failed to connect to the backend server application driver.');
  }
};


  const handleDelete = async (id) => {
    if(window.confirm("Confirm removal?")) {
      await fetch(`/api/books/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      fetchInventory();
    }
  };

  return (
    <div className="p-6 bg-gray-50 rounded-xl">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Admin Control Panel</h2>
      <form onSubmit={handleSubmit} className="bg-white p-4 rounded shadow-sm mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <input type="text" placeholder="Book Title" value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="border p-2 rounded text-sm" required />
        <input type="text" placeholder="Author" value={form.author} onChange={e => setForm({...form, author: e.target.value})} className="border p-2 rounded text-sm" required />
        <input type="text" placeholder="ISBN (Unique)" value={form.isbn} onChange={e => setForm({...form, isbn: e.target.value})} className="border p-2 rounded text-sm" required />
        <input type="text" placeholder="Category" value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="border p-2 rounded text-sm" />
        <input type="number" placeholder="Total Stock" value={form.total_copies} onChange={e => setForm({...form, total_copies: parseInt(e.target.value) || 0})} className="border p-2 rounded text-sm" min="1" required />
        <input type="text" placeholder="Shelf Location" value={form.shelf_location} onChange={e => setForm({...form, shelf_location: e.target.value})} className="border p-2 rounded text-sm" />
        <button type="submit" className="bg-blue-600 text-white p-2 rounded font-medium hover:bg-blue-700 transition md:col-span-3">Add Asset to Catalog</button>
      </form>
      <div className="bg-white rounded shadow-sm overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th className="p-3 font-semibold">Title/Author</th>
              <th className="p-3 font-semibold">ISBN</th>
              <th className="p-3 font-semibold">Available / Total</th>
              <th className="p-3 font-semibold">Location</th>
              <th className="p-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {books.map(b => (
              <tr key={b.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-medium">{b.title} <span className="text-xs text-gray-400 block">by {b.author}</span></td>
                <td className="p-3">{b.isbn}</td>
                <td className="p-3">{b.available_copies} / {b.total_copies}</td>
               <td className="p-3">{b.shelf_location || 'N/A'}</td>
                <td className="p-3"><button onClick={() => handleDelete(b.id)} className="text-red-500 font-semibold hover:underline">Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
