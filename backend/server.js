const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/books', require('./routes/books'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend engine executing smoothly on port ${PORT}`));


// 1. Book Checkout Endpoints
app.post('/api/transactions/checkout', authenticateToken, async (req, res) => {
    const { book_id } = req.body;
    const user_id = req.user.id;
    
    const loanDurationDays = 14;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + loanDurationDays);

    try {
        // Start explicit transactional sequence
        await db.query('BEGIN');

        const invCheck = await db.query('SELECT available_copies FROM inventory WHERE book_id = \$1', [book_id]);
        if (invCheck.rows.length === 0 || invCheck.rows[0].available_copies <= 0) {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: 'No copy prints available for loan checkout' });
        }

        await db.query('UPDATE inventory SET available_copies = available_copies - 1 WHERE book_id = \$1', [book_id]);
        await db.query(
            'INSERT INTO transactions (user_id, book_id, due_date, status) VALUES (\$1, \$2, \$3, \'borrowed\')',
            [user_id, book_id, dueDate]
        );

        await db.query('COMMIT');
        res.status(201).json({ message: 'Book checked out successfully', due_date: dueDate.toDateString() });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: 'Transaction generation failed' });
    }
});

// 2. Book Return & Fine Calculation
app.post('/api/transactions/return/:id', authenticateToken, async (req, res) => {
    const transactionId = req.params.id;
    const fineRatePerDay = 10.00; // ₹10/day fine configuration

    try {
        await db.query('BEGIN');

        const txCheck = await db.query('SELECT * FROM transactions WHERE id = \$1 AND status = \'borrowed\'', [transactionId]);
        if (txCheck.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Active borrowing log instance not found' });
        }

        const tx = txCheck.rows[0];
        await db.query('UPDATE inventory SET available_copies = available_copies + 1 WHERE book_id = \$1', [tx.book_id]);
        await db.query('UPDATE transactions SET return_date = CURRENT_TIMESTAMP, status = \'returned\' WHERE id = \$1', [transactionId]);

        const dueTime = new Date(tx.due_date).getTime();
        const returnTime = new Date().getTime();
        
        if (returnTime > dueTime) {
            const diffDays = Math.ceil((returnTime - dueTime) / (1000 * 60 * 60 * 24));
            const totalFine = diffDays * fineRatePerDay;

            await db.query('INSERT INTO fines (transaction_id, amount_in_inr, payment_status) VALUES (\$1, \$2, \'unpaid\')', [transactionId, totalFine]);
            await db.query('COMMIT');
            return res.json({ message: 'Book returned with fine penalties logged', fine_due: `\u20B9${totalFine}` });
        }

        await db.query('COMMIT');
        res.json({ message: 'Asset item safely returned inside grace terms.' });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: 'Process return operation failed' });
    }
});

// 3. Hold Queue Reservations
app.post('/api/reservations', authenticateToken, async (req, res) => {
    const { book_id } = req.body;
    try {
        await db.query('INSERT INTO reservations (user_id, book_id, status) VALUES (\$1, \$2, \'pending\')', [req.user.id, book_id]);
        res.status(201).json({ message: 'Reservation queue slot secured' });
    } catch (err) {
        res.status(400).json({ error: 'Failed to queue reservation hold request' });
    }
});

// 4. Analytics Report Generation
app.get('/api/reports/summary', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const activeLoans = await db.query('SELECT COUNT(*) FROM transactions WHERE status = \'borrowed\'');
        const pendingHolds = await db.query('SELECT COUNT(*) FROM reservations WHERE status = \'pending\'');
        const finesDue = await db.query('SELECT COALESCE(SUM(amount_in_inr), 0) as total FROM fines WHERE payment_status = \'unpaid\'');

        res.json({
            generated_at: new Date(),
            report_metrics: {
                active_loans_count: parseInt(activeLoans.rows[0].count),
                pending_reservations_count: parseInt(pendingHolds.rows[0].count),
                uncollected_fines_inr: parseFloat(finesDue.rows[0].total)
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Reports dashboard engine compilation error' });
    }
});

