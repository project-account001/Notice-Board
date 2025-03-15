require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");
const path = require("path");
const bodyParser = require("body-parser");

const app = express();
const PORT = process.env.PORT || 3000;

// Debugging: Check if DATABASE_URL is set
console.log("Database URL:", process.env.DATABASE_URL);

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

// Test database connection
pool.query("SELECT NOW()", (err, res) => {
    if (err) {
        console.error("❌ Database connection failed:", err);
    } else {
        console.log("✅ Connected to PostgreSQL at", res.rows[0].now);
    }
});

app.use(express.json());

// Middleware
app.use(bodyParser.urlencoded({ extended: true })); // false
app.use(bodyParser.json());

app.use(express.static(path.join(__dirname, "public"))); // Ensure correct path for static files

// View Engine Setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views")); // Ensure views directory is correctly set


app.get("/", (req, res) => {
    // res.send("🚀 Node.js server is running successfully!");
    res.render("homepage.ejs");
});

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
