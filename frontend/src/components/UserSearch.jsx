
import React, { useState, useEffect } from 'react';

export default function UserSearch() {
  const [query, setQuery] = useState('');
  const [books, setBooks] = useState([]);
  const [reservingId, setReservingId] = useState(null);

  useEffect(() => {
    const delay = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/books?search=${encodeURIComponent(query)}`
        );
        const data = await res.json();
        setBooks(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Book search failed:', err);
      }
    }, 300);

    return () => clearTimeout(delay);
  }, [query]);

  const handleReserve = async (bookId) => {
    const token = localStorage.getItem('token');

    if (!token) {
      alert('Please login first to reserve a book.');
      return;
    }

    setReservingId(bookId);

    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ book_id: bookId })
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Reservation failed.');
        return;
      }

      alert('Book reserved successfully!');
    } catch (err) {
      console.error('Reservation error:', err);
      alert('Unable to connect to the server.');
    } finally {
      setReservingId(null);
    }
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">
        Public Archive Search
      </h2>

      <input
        type="text"
        placeholder="Search books by title, author, or ISBN code..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        className="w-full p-3 border border-gray-300 rounded-lg mb-6 focus:ring-2 focus:ring-emerald-500 outline-none"
      />

      <div className="space-y-3">
        {books.map(b => (
          <div
            key={b.id}
            className="p-4 border rounded-xl flex justify-between items-center bg-gray-50"
          >
            <div>
              <h4 className="font-bold text-gray-800 text-lg">
                {b.title}
              </h4>

              <p className="text-sm text-gray-600">
                Author: {b.author} | Category: {b.category || 'General'}
              </p>
            </div>

            <div className="text-right">
              <span
                className={`text-xs font-bold px-3 py-1 rounded-full ${
                  b.available_copies > 0
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {b.available_copies > 0
                  ? `Available (${b.available_copies})`
                  : 'Out of Stock'}
              </span>

              <p className="text-xs text-gray-400 mt-2">
                Rack: {b.location_rack || 'A1'}
              </p>

              {b.available_copies <= 0 && (
                <button
                  type="button"
                  onClick={() => handleReserve(b.id)}
                  disabled={reservingId === b.id}
                  className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {reservingId === b.id
                    ? 'Reserving...'
                    : 'Reserve Book'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
