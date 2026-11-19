const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./db'); // Cleanly pulls from your working db.js file
const { verifyToken, verifyAdmin } = require('./middleware/auth');

const app = express();
app.use(cors());
app.use(express.json());



// 1. User Registration Handler
app.post('/api/auth/register', async (req, res) => {
    const { username, email, password, role } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Map frontend role to official role_id (1 for ADMIN, 2 for USER)
      const roleId = 2; // All public registrations are STANDARD USERS

        const result = await db.query(
            'INSERT INTO users (username, email, password_hash, role_id) VALUES (\$1, \$2, \$3, \$4) RETURNING id, username, email, role_id',
            [username, email, hashedPassword, roleId]
        );
        res.status(201).json({ message: 'User registered successfully', user: result.rows[0] });
    } catch (err) {
        console.error(err);
        if (err.code === '23505') {
            return res.status(400).json({ error: 'This email is already registered.' });
        }
        res.status(500).json({ error: 'Internal system registration failure.' });
    }
});

// 2. User Login Handler
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await db.query('SELECT * FROM users WHERE email = \$1', [email]);
        if (result.rows.length === 0) return res.status(400).json({ error: 'No user account found.' });

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(400).json({ error: 'Incorrect credentials.' });

        // Fetch string name of role from roles table
        const roleQuery = await db.query('SELECT name FROM roles WHERE id = \$1', [user.role_id]);
        const roleName = roleQuery.rows[0]?.name || 'USER';

        const token = jwt.sign(
            { id: user.id, role: roleName }, 
            process.env.JWT_SECRET || 'super_secure_vault_token_9988', 
            { expiresIn: '2h' }
        );
        res.json({ token, user: { id: user.id, username: user.username, email: user.email, role: roleName } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server login error.' });
    }
});


// 1. Fetch & Filter Catalog List (Joins books & inventory tables)
app.get('/api/books', async (req, res) => {
    const { search } = req.query;
    try {
        let query = `
            SELECT b.id, b.title, b.author, b.isbn, b.category, 
                   COALESCE(i.available_copies, 0) as available_copies, 
                   COALESCE(i.total_copies, 0) as total_copies, 
                   COALESCE(i.location_rack, 'N/A') as shelf_location
            FROM books b
            LEFT JOIN inventory i ON b.id = i.book_id
            ORDER BY b.id DESC
        `;
        let params = [];
        if (search) {
            query = `
                SELECT b.id, b.title, b.author, b.isbn, b.category, 
                       COALESCE(i.available_copies, 0) as available_copies, 
                       COALESCE(i.total_copies, 0) as total_copies, 
                       COALESCE(i.location_rack, 'N/A') as shelf_location
                FROM books b
                LEFT JOIN inventory i ON b.id = i.book_id
                WHERE b.title ILIKE $1 OR b.author ILIKE $1 OR b.isbn ILIKE $1
                ORDER BY b.id DESC
            `;
            params = [`%${search}%`];
        }
        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch catalog listings.' });
    }
});

// 2. Add New Book Asset Handler (Inserts into both books & inventory tables)
app.post('/api/books', verifyAdmin, async (req, res) => {
    const { title, author, isbn, category, total_copies, shelf_location } = req.body;
    try {
        // Insert into books table first
        const bookResult = await db.query(
            'INSERT INTO books (title, author, isbn, category) VALUES (\$1, \$2, \$3, \$4) RETURNING *',
            [title, author, isbn, category || 'General']
        );
        const newBook = bookResult.rows[0];

        // Insert matching stock fields into inventory table
        const copies = parseInt(total_copies) || 1;
        await db.query(
            'INSERT INTO inventory (book_id, total_copies, available_copies, location_rack) VALUES (\$1, \$2, \$3, \$4)',
            [newBook.id, copies, copies, shelf_location || 'N/A']
        );

        res.status(201).json({ 
            message: 'Book added successfully', 
            book: { ...newBook, available_copies: copies, total_copies: copies, shelf_location: shelf_location || 'N/A' } 
        });
    } catch (err) {
        console.error(err);
        if (err.code === '23505') {
            return res.status(400).json({ error: 'A book with this ISBN already exists.' });
        }
        res.status(500).json({ error: 'Database error: Could not append book asset layout.' });
    }
});

// 3. Remove Book Asset Handler

// ================= SAFE BOOK DELETION =================
app.delete('/api/books/:id', verifyAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        // Check whether the book exists
        const book = await db.query(
            'SELECT id FROM books WHERE id = $1',
            [id]
        );

        if (book.rows.length === 0) {
            return res.status(404).json({
                error: 'Book does not exist in catalog.'
            });
        }

        // Protect books with transaction history
        const transactions = await db.query(
            'SELECT id FROM transactions WHERE book_id = $1 LIMIT 1',
            [id]
        );

        if (transactions.rows.length > 0) {
            return res.status(409).json({
                error: 'Cannot delete this book because transaction history exists.'
            });
        }

        // Protect books with reservation history
        const reservations = await db.query(
            'SELECT id FROM reservations WHERE book_id = $1 LIMIT 1',
            [id]
        );

        if (reservations.rows.length > 0) {
            return res.status(409).json({
                error: 'Cannot delete this book because reservation history exists.'
            });
        }

        // Delete only when no history exists
        await db.query('DELETE FROM books WHERE id = $1', [id]);

        res.json({
            message: 'Book deleted successfully.'
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: 'Internal database deletion error.'
        });
    }
});


// 4. Issue Book API (Admin Only)
app.post('/api/transactions/issue', verifyAdmin, async (req, res) => {
    const { user_id, book_id } = req.body;
    const client = await db.connect();

    try {
        await client.query('BEGIN');

        if (!user_id || !book_id) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'User ID and Book ID are required.' });
        }

        // Check whether user exists
        const user = await client.query(
            'SELECT id FROM users WHERE id = $1',
            [user_id]
        );

        if (user.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'User not found.' });
        }

        // Lock inventory row to prevent simultaneous stock issues
        const inventory = await client.query(
            `SELECT i.available_copies
             FROM inventory i
             JOIN books b ON b.id = i.book_id
             WHERE i.book_id = $1
             FOR UPDATE OF i`,
            [book_id]
        );

        if (inventory.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Book not found in inventory.' });
        }

        if (inventory.rows[0].available_copies <= 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'No copies available.' });
        }

        // Set due date to 20 days from issue date
        const transaction = await client.query(
            `INSERT INTO transactions (user_id, book_id, issue_date, due_date, status)
             VALUES ($1, $2, CURRENT_TIMESTAMP,
                     CURRENT_TIMESTAMP + INTERVAL '20 days', 'borrowed')
             RETURNING *`,
            [user_id, book_id]
        );

        // Reduce available stock
        await client.query(
            `UPDATE inventory
             SET available_copies = available_copies - 1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE book_id = $1`,
            [book_id]
        );

        await client.query('COMMIT');

        res.status(201).json({
            message: 'Book issued successfully.',
            transaction: transaction.rows[0]
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Book issue failed.' });
    } finally {
        client.release();
    }
});


// 5. Return Book API (Admin Only)
app.post('/api/transactions/:id/return', verifyAdmin, async (req, res) => {
    const { id } = req.params;
    const client = await db.connect();

    try {
        await client.query('BEGIN');

        // Lock transaction to prevent duplicate returns
        const result = await client.query(
            'SELECT * FROM transactions WHERE id = $1 FOR UPDATE',
            [id]
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Transaction not found.' });
        }

        const transaction = result.rows[0];

        if (transaction.status !== 'borrowed') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'This book has already been returned.' });
        }

        // Calculate late days using calendar dates
        const fineResult = await client.query(
            `SELECT GREATEST(0, CURRENT_DATE - due_date::date) AS late_days
             FROM transactions WHERE id = $1`,
            [id]
        );

        const lateDays = Number(fineResult.rows[0].late_days);
        const fineAmount = lateDays * 5;

        // Mark transaction as returned
        await client.query(
            `UPDATE transactions
             SET return_date = CURRENT_TIMESTAMP, status = 'returned'
             WHERE id = $1`,
            [id]
        );

        // Restore available stock
        await client.query(
            `UPDATE inventory
             SET available_copies = LEAST(total_copies, available_copies + 1),
                 updated_at = CURRENT_TIMESTAMP
             WHERE book_id = $1`,
            [transaction.book_id]
        );

        // Save fine only when book is late
        if (fineAmount > 0) {
            await client.query(
                `INSERT INTO fines (transaction_id, amount_in_inr, payment_status)
                 VALUES ($1, $2, 'unpaid')
                 ON CONFLICT (transaction_id)
                 DO UPDATE SET amount_in_inr = EXCLUDED.amount_in_inr`,
                [id, fineAmount]
            );
        }

        await client.query('COMMIT');

        res.json({
            message: 'Book returned successfully.',
            late_days: lateDays,
            fine_amount: fineAmount
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Book return failed.' });
    } finally {
        client.release();
    }
});

// 6. Fetch All Transactions (Admin Only)
app.get('/api/transactions', verifyAdmin, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT
                t.id,
                t.user_id,
                u.username,
                t.book_id,
                b.title AS book_title,
                t.issue_date,
                t.due_date,
                t.return_date,
                t.status,
                COALESCE(f.amount_in_inr, 0) AS fine_amount,
                f.payment_status
            FROM transactions t
            LEFT JOIN users u ON u.id = t.user_id
            LEFT JOIN books b ON b.id = t.book_id
            LEFT JOIN fines f ON f.transaction_id = t.id
            ORDER BY t.id DESC
        `);

        res.json(result.rows);

    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: 'Failed to fetch transaction records.'
        });
    }
});

// 7. Mark Fine as Paid (Admin Only)
app.post('/api/fines/:transactionId/pay', verifyAdmin, async (req, res) => {
    const { transactionId } = req.params;

    try {
        const result = await db.query(
            `UPDATE fines
             SET payment_status = 'paid'
             WHERE transaction_id = $1
             RETURNING transaction_id, amount_in_inr, payment_status`,
            [transactionId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Fine record not found for this transaction.'
            });
        }

        res.json({
            message: 'Fine payment marked as paid successfully.',
            fine: result.rows[0]
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: 'Failed to update fine payment status.'
        });
    }
});


// ================= BOOK RESERVATION API =================

app.post('/api/reservations', verifyToken, async (req, res) => {
    const userId = req.user.id;
    const { book_id } = req.body;

    try {
        if (!book_id) {
            return res.status(400).json({
                error: 'Book ID is required.'
            });
        }

        // Check whether the book exists in inventory
        const inventory = await db.query(
            `SELECT available_copies
             FROM inventory
             WHERE book_id = $1`,
            [book_id]
        );

        if (inventory.rows.length === 0) {
            return res.status(404).json({
                error: 'Book not found in inventory.'
            });
        }

        // Reservation is allowed only when no copies are available
        if (inventory.rows[0].available_copies > 0) {
            return res.status(400).json({
                error: 'Book is currently available. You can borrow it directly.'
            });
        }

        // Prevent duplicate pending reservations
        const existing = await db.query(
            `SELECT id FROM reservations
             WHERE user_id = $1
             AND book_id = $2
             AND status = 'pending'`,
            [userId, book_id]
        );

        if (existing.rows.length > 0) {
            return res.status(409).json({
                error: 'You already have a pending reservation for this book.'
            });
        }

        // Create reservation
        const result = await db.query(
            `INSERT INTO reservations (user_id, book_id, reserved_at, status)
             VALUES ($1, $2, CURRENT_TIMESTAMP, 'pending')
             RETURNING *`,
            [userId, book_id]
        );

        res.status(201).json({
            message: 'Book reserved successfully.',
            reservation: result.rows[0]
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: 'Reservation failed.'
        });
    }
});

// 8. Fetch All Registered Users (Admin Only)
app.get('/api/users', verifyAdmin, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT
                u.id,
                u.username,
                u.email,
                COALESCE(r.name, 'USER') AS role
            FROM users u
            LEFT JOIN roles r ON r.id = u.role_id
            ORDER BY u.id ASC
        `);

        res.json(result.rows);

    } catch (err) {
        console.error('Fetch users error:', err);
        res.status(500).json({
            error: 'Failed to fetch registered users.'
        });
    }
});



app.listen(5000, () => console.log('Backend server engine running perfectly on port 5000'));