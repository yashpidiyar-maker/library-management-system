import React, { useState, useEffect } from 'react';

export default function UserSearch() {
  const [query, setQuery] = useState('');
  const [books, setBooks] = useState([]);

  useEffect(() => {
    const delay = setTimeout(async () => {
      const res = await fetch(`/api/books?search=${encodeURIComponent(query)}`);
      const data = await res.json();
      setBooks(Array.isArray(data) ? data : []);
    }, 300);
    return () => clearTimeout(delay);
  }, [query]);

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Public Archive Search</h2>
      <input 
        type="text" 
        placeholder="Search books by title, author, or ISBN code..." 
        value={query} 
        onChange={e => setQuery(e.target.value)} 
        className="w-full p-3 border border-gray-300 rounded-lg mb-6 focus:ring-2 focus:ring-emerald-500 outline-none"
      />
      <div className="space-y-3">
        {books.map(b => (
          <div key={b.id} className="p-4 border rounded-xl flex justify-between items-center bg-gray-50">
            <div>
              <h4 className="font-bold text-gray-800 text-lg">{b.title}</h4>
              <p className="text-sm text-gray-600">Author: {b.author} | Category: {b.category || 'General'}</p>
            </div>
            <div className="text-right">
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${b.available_copies > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {b.available_copies > 0 ? `Available (${b.available_copies})` : 'Out of Stock'}
              </span>
              <p className="text-xs text-gray-400 mt-2">Rack: {b.location_rack || 'A1'}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
