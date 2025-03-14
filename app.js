require("dotenv").config(); // Load environment variables
const express = require("express");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL Connection Pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // Get from .env file
    ssl: { rejectUnauthorized: false } // Needed for Railway hosting
});

// Test database connection
pool.query("SELECT NOW()", (err, res) => {
    if (err) {
        console.error("❌ Database connection failed:", err.stack);
    } else {
        console.log("✅ Connected to PostgreSQL:", res.rows[0]);
    }
});

// Middleware for JSON body parsing
app.use(express.json());

// Default route
app.get("/", (req, res) => {
    res.send("🚀 Node.js server is running successfully!");
});

// Sample route to fetch all notices
app.get("/notices", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM notices ORDER BY created_at DESC");
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("❌ Server Error");
    }
});

app.listen(PORT, () => {
    console.log(`✅ Server is running at http://localhost:${PORT}`);
});
