require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const bcrypt = require("bcrypt");

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

// Session setup
app.use(session({
    secret: "your_secret_key",
    resave: false,
    saveUninitialized: false
}));

// View Engine Setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views")); // Ensure views directory is correctly set


app.get("/", (req, res) => {
    // res.send("🚀 Node.js server is running successfully!");
    res.render("homepage.ejs");
});

// login page
app.get("/login/:role", (req, res) => {
    const role = req.params.role;
    res.render("login", { role });
});

// Handle Login submission 
app.post("/login", async(req, res) => {
    const {email, password, role } = req.body;

    try{
        // check user existence and role
        const query = `
        SELECT users.*, user_roles.role_name
        FROM users
        JOIN user_roles ON users.role_id = user_roles.id
        WHERE email = $1 AND user_roles.role_name = $2
        `;

        const result = await pool.query(query, [email, role]);

        if(result.rows.length === 0) {
            return res.render("login", {role, error: "Invalid email or role." });
        }

        const user = result.rows[0];

        // Check Password
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.render("login", { role, error: "Incorrect password." });
        }

        // Save session and redirect to dashboard
        req.session.user = { id: user.id, name: user.name, role: user.role_name };
        res.redirect("/dashboard");
    }catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});

// Dashboard Route
app.get("/dashboard", (req, res) => {
    if (!req.session.user) {
        return res.redirect("/");
    }
    res.render("dashboard", { user: req.session.user });
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

// Logout Route
app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/");
    });
});

app.listen(PORT, () => {
    console.log(`✅ Server is running at http://localhost:${PORT}`);
});
