// server/index.js
// Run with: node server/index.js
// Connects to MongoDB Atlas cluster1 / test / behaviours

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const app = express();
app.use(cors());
app.use(express.json());

// ── MongoDB Connection ──────────────────────────────────────────────────────
// Set MONGO_URI in server/.env
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ Missing MONGO_URI. Add it to server/.env.');
  process.exit(1);
}

mongoose
  .connect(MONGO_URI, { dbName: 'test' })
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB error:', err));

// ── Schema (mirrors your seeded data) ──────────────────────────────────────
const behaviorSchema = new mongoose.Schema({
  firstName:            String,
  lastName:             String,
  handle:               String,
  rating:               Number,
  avg_difficulty:       Number,
  contest_count:        Number,
  title:                String,   // CF rank label (lowercase)
  accuracy:             Number,
  total_problems_solved: Number,
});

const Behaviour = mongoose.model('Behaviour', behaviorSchema, 'behaviors');

// ── Routes ─────────────────────────────────────────────────────────────────

// GET /api/behaviours  — returns all documents (projection: exclude _id,__v)
app.get('/api/behaviours', async (req, res) => {
  try {
    const data = await Behaviour.find(
      {},
      { _id: 0, __v: 0, firstName: 0, lastName: 0 }
    ).lean();
    res.json({ ok: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// GET /api/behaviours/summary  — aggregated per rank for bar charts
app.get('/api/behaviours/summary', async (req, res) => {
  try {
    const summary = await Behaviour.aggregate([
      {
        $group: {
          _id: '$title',
          avgDifficulty:  { $avg: '$avg_difficulty' },
          avgContests:    { $avg: '$contest_count' },
          avgProblems:    { $avg: '$total_problems_solved' },
          avgRating:      { $avg: '$rating' },
          avgAccuracy:    { $avg: '$accuracy' },
          count:          { $sum: 1 },
        },
      },
      { $sort: { avgRating: 1 } },
    ]);
    res.json({ ok: true, data: summary });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => {
  console.log(`🚀 API ready at http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Stop the existing process and retry.`);
    console.error(`Tip: run \`ss -ltnp | grep :${PORT}\` to find it, then \`kill <PID>\`.`);
    process.exit(1);
  }
  throw err;
});
