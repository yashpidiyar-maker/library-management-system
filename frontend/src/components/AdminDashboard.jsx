
import React, { useState, useEffect, useCallback } from 'react';

export default function AdminDashboard() {
  const token = localStorage.getItem('token');

  const [books, setBooks] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [users, setUsers] = useState([]);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [form, setForm] = useState({
    title: '',
    author: '',
    isbn: '',
    category: '',
    total_copies: 1,
    shelf_location: ''
  });

  const [issueForm, setIssueForm] = useState({
    user_id: '',
    book_id: ''
  });

  const fetchInventory = useCallback(async () => {
    try {
      const res = await fetch('/api/books');
      const data = await res.json();

      if (res.ok) {
        setBooks(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Inventory error:', err);
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await fetch('/api/transactions', {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();

      if (res.ok) {
        setTransactions(Array.isArray(data) ? data : []);
      } else {
        console.error(data.error);
      }
    } catch (err) {
      console.error('Transaction error:', err);
    }
  }, [token]);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);

    try {
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();

      if (res.ok) {
        setUsers(Array.isArray(data) ? data : []);
      } else {
        alert(data.error || 'Could not fetch users.');
      }
    } catch (err) {
      console.error('Users error:', err);
      alert('Unable to connect to the server.');
    } finally {
      setLoadingUsers(false);
    }
  }, [token]);

  useEffect(() => {
    fetchInventory();
    fetchTransactions();
  }, [fetchInventory, fetchTransactions]);

  useEffect(() => {
    if (activeSection === 'users') {
      fetchUsers();
    }
  }, [activeSection, fetchUsers]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await fetch('/api/books', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Book addition failed.');
        return;
      }

      alert('Book added successfully!');

      setForm({
        title: '',
        author: '',
        isbn: '',
        category: '',
        total_copies: 1,
        shelf_location: ''
      });

      await fetchInventory();
      setActiveSection('inventory');
    } catch (err) {
      alert('Backend connection failed.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to remove this book?')) {
      return;
    }

    try {
      const res = await fetch(`/api/books/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Book deletion failed.');
        return;
      }

      alert('Book removed successfully.');
      await fetchInventory();
    } catch (err) {
      alert('Backend connection failed.');
    }
  };

  const handleIssue = async (e) => {
    e.preventDefault();

    try {
      const res = await fetch('/api/transactions/issue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: Number(issueForm.user_id),
          book_id: Number(issueForm.book_id)
        })
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Book issue failed.');
        return;
      }

      alert(
        'Book issued successfully! Due date: ' +
        new Date(data.transaction.due_date).toLocaleDateString()
      );

      setIssueForm({ user_id: '', book_id: '' });

      await fetchInventory();
      await fetchTransactions();
      setActiveSection('transactions');
    } catch (err) {
      alert('Backend connection failed.');
    }
  };

  const handleReturn = async (id) => {
    if (!window.confirm('Confirm book return?')) return;

    try {
      const res = await fetch(`/api/transactions/${id}/return`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Book return failed.');
        return;
      }

      alert(
        `Book returned successfully!\nLate days: ${data.late_days}\nFine: ₹${data.fine_amount}`
      );

      await fetchInventory();
      await fetchTransactions();
    } catch (err) {
      alert('Backend connection failed.');
    }
  };

  const handleFinePayment = async (transactionId) => {
    if (!window.confirm('Confirm that the fine has been received?')) {
      return;
    }

    try {
      const res = await fetch(`/api/fines/${transactionId}/pay`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Fine payment update failed.');
        return;
      }

      alert('Fine marked as PAID successfully!');
      await fetchTransactions();
    } catch (err) {
      console.error(err);
      alert('Backend connection failed.');
    }
  };

  const formatDate = (date) => {
    return date ? new Date(date).toLocaleDateString() : 'N/A';
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
    { id: 'addBook', label: 'Add Book', icon: '➕' },
    { id: 'inventory', label: 'Book Inventory', icon: '📚' },
    { id: 'issue', label: 'Issue Book', icon: '📖' },
    { id: 'transactions', label: 'Transactions', icon: '🔄' },
    { id: 'borrowing', label: 'Borrowing History', icon: '📋' },
    { id: 'returned', label: 'Returned Books', icon: '✅' },
    { id: 'fines', label: 'Fine Report', icon: '💰' },
    { id: 'users', label: 'All Users', icon: '👥' }
  ];

  const borrowedBooks = transactions.filter(
    t => t.status === 'borrowed'
  );

  const returnedBooks = transactions.filter(
    t => t.status === 'returned'
  );

  const fineRecords = transactions.filter(
    t => Number(t.fine_amount) > 0
  );

  const totalFines = fineRecords.reduce(
    (sum, t) => sum + Number(t.fine_amount), 0
  );

  const renderTableMessage = (message, columns) => (
    <tr>
      <td colSpan={columns} className="p-5 text-center text-gray-500">
        {message}
      </td>
    </tr>
  );

  return (
    <div className="min-h-screen bg-gray-100 md:flex">

      {/* SIDEBAR */}
      <aside className="w-full md:w-64 bg-slate-900 text-white md:min-h-screen p-5">
        <h1 className="text-xl font-bold mb-2">
          📚 Library System
        </h1>

        <p className="text-xs text-slate-400 mb-8">
          ADMIN CONTROL PANEL
        </p>

        <nav className="space-y-2">
          {menuItems.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveSection(item.id)}
              className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition ${
                activeSection === item.id
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <span>{item.icon}</span>
              <span className="text-sm font-medium">
                {item.label}
              </span>
            </button>
          ))}
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 min-w-0 p-4 md:p-8">

        <div className="flex flex-wrap justify-between items-center gap-3 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              {menuItems.find(item => item.id === activeSection)?.label}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Manage your library activities
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              fetchInventory();
              fetchTransactions();
              if (activeSection === 'users') fetchUsers();
            }}
            className="bg-white border px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
          >
            ↻ Refresh
          </button>
        </div>

        {/* DASHBOARD */}
        {activeSection === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

              <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-blue-500">
                <p className="text-gray-500 text-sm">Total Books</p>
                <h3 className="text-3xl font-bold mt-2">{books.length}</h3>
              </div>

              <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-green-500">
                <p className="text-gray-500 text-sm">Available Copies</p>
                <h3 className="text-3xl font-bold mt-2">
                  {books.reduce((sum, b) => sum + Number(b.available_copies || 0), 0)}
                </h3>
              </div>

              <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-orange-500">
                <p className="text-gray-500 text-sm">Currently Borrowed</p>
                <h3 className="text-3xl font-bold mt-2">
                  {borrowedBooks.length}
                </h3>
              </div>

              <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-purple-500">
                <p className="text-gray-500 text-sm">Registered Users</p>
                <h3 className="text-3xl font-bold mt-2">
                  {users.length || '—'}
                </h3>
                <button
                  onClick={() => setActiveSection('users')}
                  className="text-xs text-blue-600 mt-2"
                >
                  View users
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <h3 className="font-bold text-lg mb-4">Quick Actions</h3>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setActiveSection('addBook')}
                    className="bg-blue-600 text-white p-3 rounded-lg"
                  >
                    + Add Book
                  </button>

                  <button
                    onClick={() => setActiveSection('issue')}
                    className="bg-green-600 text-white p-3 rounded-lg"
                  >
                    Issue Book
                  </button>

                  <button
                    onClick={() => setActiveSection('users')}
                    className="bg-slate-700 text-white p-3 rounded-lg"
                  >
                    All Users
                  </button>

                  <button
                    onClick={() => setActiveSection('fines')}
                    className="bg-purple-600 text-white p-3 rounded-lg"
                  >
                    Fine Report
                  </button>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm">
                <h3 className="font-bold text-lg mb-4">Library Summary</h3>
                <div className="space-y-3 text-sm">
                  <p className="flex justify-between">
                    <span>Total Transactions</span>
                    <strong>{transactions.length}</strong>
                  </p>
                  <p className="flex justify-between">
                    <span>Returned Books</span>
                    <strong>{returnedBooks.length}</strong>
                  </p>
                  <p className="flex justify-between">
                    <span>Fine Records</span>
                    <strong>{fineRecords.length}</strong>
                  </p>
                  <p className="flex justify-between">
                    <span>Total Fine Amount</span>
                    <strong>₹{totalFines}</strong>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ADD BOOK */}
        {activeSection === 'addBook' && (
          <section className="bg-white p-6 rounded-xl shadow-sm">
            <h3 className="text-lg font-bold mb-5">Add New Book</h3>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Book Title"
                required
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                className="border p-3 rounded-lg"
              />

              <input
                type="text"
                placeholder="Author"
                required
                value={form.author}
                onChange={e => setForm({ ...form, author: e.target.value })}
                className="border p-3 rounded-lg"
              />

              <input
                type="text"
                placeholder="ISBN"
                required
                value={form.isbn}
                onChange={e => setForm({ ...form, isbn: e.target.value })}
                className="border p-3 rounded-lg"
              />

              <input
                type="text"
                placeholder="Category"
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
                className="border p-3 rounded-lg"
              />

              <input
                type="number"
                min="1"
                required
                placeholder="Total Copies"
                value={form.total_copies}
                onChange={e => setForm({
                  ...form,
                  total_copies: Number(e.target.value)
                })}
                className="border p-3 rounded-lg"
              />

              <input
                type="text"
                placeholder="Shelf Location"
                value={form.shelf_location}
                onChange={e => setForm({ ...form, shelf_location: e.target.value })}
                className="border p-3 rounded-lg"
              />

              <button
                type="submit"
                className="md:col-span-2 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg font-semibold"
              >
                Add Book
              </button>
            </form>
          </section>
        )}

        {/* BOOK INVENTORY */}
        {activeSection === 'inventory' && (
          <section className="bg-white rounded-xl shadow-sm overflow-x-auto">
            <div className="p-5 border-b">
              <h3 className="font-bold text-lg">Book Inventory</h3>
              <p className="text-sm text-gray-500">
                Total book titles: {books.length}
              </p>
            </div>

            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3">Book</th>
                  <th className="p-3">ISBN</th>
                  <th className="p-3">Available / Total</th>
                  <th className="p-3">Location</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {books.map(b => (
                  <tr key={b.id} className="border-b">
                    <td className="p-3">
                      <strong>{b.title}</strong>
                      <span className="block text-xs text-gray-500">
                        {b.author}
                      </span>
                    </td>
                    <td className="p-3">{b.isbn}</td>
                    <td className="p-3">
                      {b.available_copies} / {b.total_copies}
                    </td>
                    <td className="p-3">{b.shelf_location || 'N/A'}</td>
                    <td className="p-3">
                      <button
                        onClick={() => handleDelete(b.id)}
                        className="text-red-600 font-semibold"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}

                {books.length === 0 && renderTableMessage('No books found.', 5)}
              </tbody>
            </table>
          </section>
        )}

        {/* ISSUE BOOK */}
        {activeSection === 'issue' && (
          <section className="bg-white p-6 rounded-xl shadow-sm">
            <h3 className="text-lg font-bold mb-2">Issue Book</h3>
            <p className="text-sm text-gray-500 mb-5">
              Enter the registered user ID and select an available book.
            </p>

            <form onSubmit={handleIssue} className="space-y-4 max-w-xl">
              <input
                type="number"
                min="1"
                placeholder="Enter User ID"
                required
                value={issueForm.user_id}
                onChange={e => setIssueForm({
                  ...issueForm,
                  user_id: e.target.value
                })}
                className="w-full border p-3 rounded-lg"
              />

              <select
                required
                value={issueForm.book_id}
                onChange={e => setIssueForm({
                  ...issueForm,
                  book_id: e.target.value
                })}
                className="w-full border p-3 rounded-lg"
              >
                <option value="">Select Book</option>
                {books
                  .filter(b => Number(b.available_copies) > 0)
                  .map(b => (
                    <option key={b.id} value={b.id}>
                      {b.title} (Available: {b.available_copies})
                    </option>
                  ))}
              </select>

              <button
                type="submit"
                className="w-full bg-green-600 hover:bg-green-700 text-white p-3 rounded-lg"
              >
                Issue Book
              </button>
            </form>

            <p className="text-sm text-gray-500 mt-5">
              Return period: 20 days | Late fine: ₹5 per day
            </p>
          </section>
        )}

        {/* TRANSACTIONS */}
        {activeSection === 'transactions' && (
          <section className="bg-white rounded-xl shadow-sm overflow-x-auto">
            <h3 className="text-lg font-bold p-5">All Transactions</h3>

            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3">ID</th>
                  <th className="p-3">User</th>
                  <th className="p-3">Book</th>
                  <th className="p-3">Due Date</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Fine</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(t => (
                  <tr key={t.id} className="border-b">
                    <td className="p-3">{t.id}</td>
                    <td className="p-3">
                      {t.username || `User #${t.user_id}`}
                    </td>
                    <td className="p-3">
                      {t.book_title || `Book #${t.book_id}`}
                    </td>
                    <td className="p-3">{formatDate(t.due_date)}</td>
                    <td className="p-3">{t.status}</td>
                    <td className="p-3">
                      ₹{t.fine_amount}
                      {Number(t.fine_amount) > 0 && (
                        <span className="block text-xs text-gray-500">
                          {t.payment_status || 'unpaid'}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {t.status === 'borrowed' ? (
                        <button
                          onClick={() => handleReturn(t.id)}
                          className="bg-green-600 text-white px-3 py-1 rounded"
                        >
                          Return
                        </button>
                      ) : Number(t.fine_amount) > 0 &&
                        t.payment_status !== 'paid' ? (
                        <button
                          onClick={() => handleFinePayment(t.id)}
                          className="bg-blue-600 text-white px-3 py-1 rounded"
                        >
                          Mark Paid
                        </button>
                      ) : (
                        <span className="text-gray-400">Completed</span>
                      )}
                    </td>
                  </tr>
                ))}

                {transactions.length === 0 &&
                  renderTableMessage('No transaction records found.', 7)}
              </tbody>
            </table>
          </section>
        )}

        {/* BORROWING HISTORY */}
        {activeSection === 'borrowing' && (
          <section className="bg-white rounded-xl shadow-sm overflow-x-auto">
            <h3 className="text-lg font-bold p-5">Borrowing History</h3>

            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3">Transaction ID</th>
                  <th className="p-3">User</th>
                  <th className="p-3">Book</th>
                  <th className="p-3">Issue Date</th>
                  <th className="p-3">Due Date</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(t => (
                  <tr key={t.id} className="border-b">
                    <td className="p-3">{t.id}</td>
                    <td className="p-3">
                      {t.username || `User #${t.user_id}`}
                    </td>
                    <td className="p-3">
                      {t.book_title || `Book #${t.book_id}`}
                    </td>
                    <td className="p-3">{formatDate(t.issue_date)}</td>
                    <td className="p-3">{formatDate(t.due_date)}</td>
                    <td className="p-3">{t.status}</td>
                  </tr>
                ))}

                {transactions.length === 0 &&
                  renderTableMessage('No borrowing records found.', 6)}
              </tbody>
            </table>
          </section>
        )}

        {/* RETURNED BOOKS */}
        {activeSection === 'returned' && (
          <section className="bg-white rounded-xl shadow-sm overflow-x-auto">
            <h3 className="text-lg font-bold p-5">Returned Books</h3>

            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3">Transaction ID</th>
                  <th className="p-3">User</th>
                  <th className="p-3">Book</th>
                  <th className="p-3">Issue Date</th>
                  <th className="p-3">Return Date</th>
                </tr>
              </thead>
              <tbody>
                {returnedBooks.map(t => (
                  <tr key={t.id} className="border-b">
                    <td className="p-3">{t.id}</td>
                    <td className="p-3">
                      {t.username || `User #${t.user_id}`}
                    </td>
                    <td className="p-3">
                      {t.book_title || `Book #${t.book_id}`}
                    </td>
                    <td className="p-3">{formatDate(t.issue_date)}</td>
                    <td className="p-3">{formatDate(t.return_date)}</td>
                  </tr>
                ))}

                {returnedBooks.length === 0 &&
                  renderTableMessage('No returned books found.', 5)}
              </tbody>
            </table>
          </section>
        )}

        {/* FINE REPORT */}
        {activeSection === 'fines' && (
          <section className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-xl shadow-sm">
                <p className="text-gray-500 text-sm">Fine Records</p>
                <h3 className="text-2xl font-bold">{fineRecords.length}</h3>
              </div>

              <div className="bg-white p-5 rounded-xl shadow-sm">
                <p className="text-gray-500 text-sm">Total Fine Amount</p>
                <h3 className="text-2xl font-bold">₹{totalFines}</h3>
              </div>

              <div className="bg-white p-5 rounded-xl shadow-sm">
                <p className="text-gray-500 text-sm">Unpaid Fines</p>
                <h3 className="text-2xl font-bold">
                  ₹{fineRecords
                    .filter(t => t.payment_status !== 'paid')
                    .reduce((sum, t) => sum + Number(t.fine_amount), 0)}
                </h3>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
              <h3 className="text-lg font-bold p-5">Fine Details</h3>

              <table className="w-full text-left text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-3">Transaction ID</th>
                    <th className="p-3">User</th>
                    <th className="p-3">Book</th>
                    <th className="p-3">Fine</th>
                    <th className="p-3">Payment Status</th>
                  </tr>
                </thead>
                <tbody>
                  {fineRecords.map(t => (
                    <tr key={t.id} className="border-b">
                      <td className="p-3">{t.id}</td>
                      <td className="p-3">
                        {t.username || `User #${t.user_id}`}
                      </td>
                      <td className="p-3">
                        {t.book_title || `Book #${t.book_id}`}
                      </td>
                      <td className="p-3">₹{t.fine_amount}</td>
                      <td className="p-3">
                        {t.payment_status || 'unpaid'}
                      </td>
                    </tr>
                  ))}

                  {fineRecords.length === 0 &&
                    renderTableMessage('No fine records found.', 5)}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ALL USERS */}
        {activeSection === 'users' && (
          <section className="bg-white rounded-xl shadow-sm overflow-x-auto">
            <div className="p-5 border-b flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">Registered Users</h3>
                <p className="text-sm text-gray-500">
                  Total users: {users.length}
                </p>
              </div>

              <button
                onClick={fetchUsers}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm"
              >
                Refresh Users
              </button>
            </div>

            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3">User ID</th>
                  <th className="p-3">Username</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Role</th>
                </tr>
              </thead>
              <tbody>
                {loadingUsers ? (
                  renderTableMessage('Loading users...', 4)
                ) : users.length > 0 ? (
                  users.map(user => (
                    <tr key={user.id} className="border-b">
                      <td className="p-3">{user.id}</td>
                      <td className="p-3">{user.username}</td>
                      <td className="p-3">{user.email}</td>
                      <td className="p-3">{user.role || 'USER'}</td>
                    </tr>
                  ))
                ) : (
                  renderTableMessage('No registered users found.', 4)
                )}
              </tbody>
            </table>
          </section>
        )}

      </main>
    </div>
  );
}
