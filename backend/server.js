const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./db'); // Cleanly pulls from your working db.js file

const app = express();
app.use(cors());
app.use(express.json());



// 1. User Registration Handler
app.post('/api/auth/register', async (req, res) => {
    const { username, email, password, role } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Map frontend role to official role_id (1 for ADMIN, 2 for USER)
        const roleId = (role === 'System Administrator' || role === 'ADMIN') ? 1 : 2;

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
app.post('/api/books', async (req, res) => {
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
app.delete('/api/books/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Inventory table drops automatically via ON DELETE CASCADE configuration rule
        const result = await db.query('DELETE FROM books WHERE id = \$1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Target asset does not exist in catalog.' });
        }
        res.json({ message: 'Book resource dropped successfully.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal database deletion error.' });
    }
});

app.listen(5000, () => console.log('Backend server engine running perfectly on port 5000'));