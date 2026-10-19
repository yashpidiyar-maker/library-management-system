import React, { useState, useEffect } from 'react';

export default function IntegratedDashboard({ userRole }) {
  const [books, setBooks] = useState([]);
  const [search, setSearch] = useState('');
  const [report, setReport] = useState(null);
  const [feedback, setFeedback] = useState({ msg: '', isError: false });

  useEffect(() => {
    fetchCatalog();
    if (userRole === 'admin') fetchAdminReport();
  }, [search]);

  const fetchCatalog = async () => {
    const res = await fetch(`/api/books?search=${encodeURIComponent(search)}`);
    const data = await res.json();
    setBooks(data);
  };

  const fetchAdminReport = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/reports/summary', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      setReport(data.report_metrics);
    }
  };

  const triggerAction = async (endpoint, bodyPayload) => {
    const token = localStorage.getItem('token');
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(bodyPayload)
    });
    const result = await res.json();
    
    if (!res.ok) {
      setFeedback({ msg: result.error || 'Operation failed', isError: true });
    } else {
      setFeedback({ msg: result.message + (result.fine_due ? ` Due: ${result.fine_due}` : ''), isError: false });
      fetchCatalog();
      if (userRole === 'admin') fetchAdminReport();
    }
  };

  return (
    <div style={{ padding: '24px', fontFamily: 'sans-serif', color: '#333' }}>
      <h1>Library Unified Management Grid</h1>

      {feedback.msg && (
        <div style={{ padding: '12px', marginBottom: '16px', borderRadius: '4px', background: feedback.isError ? '#fce8e6' : '#e6f4ea', color: feedback.isError ? '#c5221f' : '#137333' }}>
          {feedback.msg}
        </div>
      )}

      {userRole === 'admin' && report && (
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
          <div style={{ border: '1px solid #ccc', padding: '16px', borderRadius: '6px', minWidth: '150px' }}>
            <h3>Active Borrow Loans</h3>
            <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{report.active_loans_count}</p>
          </div>
          <div style={{ border: '1px solid #ccc', padding: '16px', borderRadius: '6px', minWidth: '150px' }}>
            <h3>Queue Hold Requests</h3>
            <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{report.pending_reservations_count}</p>
          </div>
          <div style={{ border: '1px solid #ccc', padding: '16px', borderRadius: '6px', minWidth: '150px' }}>
            <h3>Uncollected Fines</h3>
            <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>₹{report.uncollected_fines_inr.toFixed(2)}</p>
          </div>
        </div>
      )}

      <input 
        type="text" 
        placeholder="Filter catalog records..." 
        value={search} 
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: '100%', maxWidth: '400px', padding: '8px', marginBottom: '20px' }}
      />

      <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        {books.map(book => (
          <div key={book.id} style={{ border: '1px solid #ddd', padding: '16px', borderRadius: '6px' }}>
            <h4>{book.title}</h4>
            <p style={{ fontSize: '14px', margin: '4px 0' }}>By {book.author}</p>
            <p style={{ fontSize: '12px', color: '#666' }}>Available: {book.available_copies} / {book.total_copies}</p>
            
            <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
              <button 
                disabled={book.available_copies === 0}
                onClick={() => triggerAction('/api/transactions/checkout', { book_id: book.id })}
                style={{ opacity: book.available_copies === 0 ? 0.5 : 1, cursor: 'pointer', background: '#28a745', color: '#fff', border: 'none', padding: '6px 12px' }}
              >
                Loan Checkout
              </button>
              
              <button 
                onClick={() => triggerAction('/api/reservations', { book_id: book.id })}
                style={{ cursor: 'pointer', background: '#ffc107', color: '#000', border: 'none', padding: '6px 12px' }}
              >
                Place Reserve Hold
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
