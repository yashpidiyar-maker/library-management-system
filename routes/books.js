const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyAdmin } = require('../middleware/auth');

router.get('/', async (req, res) => {
  const { search, category } = req.query;
  let queryText = `
    SELECT b.*, i.total_copies, i.available_copies, i.location_rack 
    FROM books b 
    LEFT JOIN inventory i ON b.id = i.book_id WHERE 1=1`;
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    queryText += ` AND (b.title ILIKE $${params.length} OR b.author ILIKE $${params.length} OR b.isbn LIKE $${params.length})`;
  }
  if (category) {
    params.push(category);
    queryText += ` AND b.category = $${params.length}`;
  }

  try {
    const result = await db.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', verifyAdmin, async (req, res) => {
  const { title, author, isbn, category, published_year, total_copies, location_rack } = req.body;
  try {
    await db.query('BEGIN');
    const bookRes = await db.query(
      'INSERT INTO books (title, author, isbn, category, published_year) VALUES (\$1, \$2, \$3, \$4, \$5) RETURNING *',
      [title, author, isbn, category, published_year]
    );
    const bookId = bookRes.rows[0].id;
    await db.query(
      'INSERT INTO inventory (book_id, total_copies, available_copies, location_rack) VALUES (\$1, \$2, \$2, \$3)',
      [bookId, total_copies, location_rack]
    );
    await db.query('COMMIT');
    res.status(201).json({ message: 'Book and inventory created', book: bookRes.rows[0] });
  } catch (err) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: 'Transaction failed: ' + err.message });
  }
});

router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM books WHERE id = \$1', [req.params.id]);
    res.json({ message: 'Book eliminated from records' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
