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

//
// async function updatePasswords() {
//     try {
//         const users = await pool.query("SELECT id, password FROM users");

//         for (let user of users.rows) {
//             const hashedPassword = await bcrypt.hash(user.password, 10);
//             await pool.query("UPDATE users SET password = $1 WHERE id = $2", [hashedPassword, user.id]);
//             console.log(`Updated password for user ID ${user.id}`);
//         }

//         console.log("✅ All passwords updated successfully!");
//         process.exit();
//     } catch (error) {
//         console.error("Error updating passwords:", error);
//         process.exit(1);
//     }
// }

// updatePasswords();
//

const ADMIN_PASSKEY = "SuperSecretKey123";

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

// Middleware to check if the user is logged in
function isAuthenticated(req, res, next) {
    if (!req.session.user) {
        return res.redirect("/login");
    }
    next();
}

// Middleware to check if the user is a teacher
function isTeacher(req, res, next) {
    if (req.session.user.role !== "teacher") {
        return res.status(403).send("Access denied");
    }
    next();
}

// Middleware to check if the user is an admin
function isAdmin(req, res, next) {
    if (!req.session.user || req.session.user.role !== "admin") {
        return res.status(403).send("Access denied. Only admins can access this page.");
    }
    next();
}

app.get("/myNotices", isAuthenticated, isTeacher, async (req, res) => {
    try {
        const query = `
            SELECT * FROM notices WHERE posted_by = $1 ORDER BY created_at DESC
        `;
        const result = await pool.query(query, [req.session.user.id]);
        res.render("myNotices", { user: req.session.user, notices: result.rows });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
});



// Route to show all notices (Admin Only)
app.get("/manageNotice", isAuthenticated, isAdmin, async (req, res) => {
    try {
        const query = `
            SELECT notices.id, notices.title, notices.content, users.name AS teacher_name, notices.created_at
            FROM notices
            JOIN users ON notices.posted_by = users.id
            ORDER BY notices.created_at DESC
        `;

        const result = await pool.query(query);
        res.render("manageNotice", { user: req.session.user, notices: result.rows });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
});

// Route to Delete Notice (Admin Only)
app.post("/deleteNotice/:id", isAuthenticated, isAdmin, async (req, res) => {
    const noticeId = req.params.id;
    try {
        const deleteQuery = `DELETE FROM notices WHERE id = $1`;
        await pool.query(deleteQuery, [noticeId]);
        res.redirect("/manageNotice");
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
});

app.get("/manageUsers", isAuthenticated, isAdmin, async(req, res) => {
    res.render("manageuser.ejs");
});

app.get("/", (req, res) => {
    // res.send("🚀 Node.js server is running successfully!");
    res.render("homepage.ejs");
});

// GET Route - Render Signup Page
app.get("/signup", (req, res) => {
    res.render("signup", { error: null });
});


// POST Route - Handle Signup
app.post("/signup", async (req, res) => {
    const { name, email, password, passKey } = req.body;

    try {
        if (passKey !== ADMIN_PASSKEY) {
            return res.render("signup", { error: "Invalid PassKey! Signup failed." });
        }

        // Check if email already exists
        const checkQuery = "SELECT * FROM users WHERE email = $1";
        const existingUser = await pool.query(checkQuery, [email]);

        if (existingUser.rows.length > 0) {
            return res.render("signup", { error: "Email already registered!" });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);
        const createdAt = new Date();

        // Insert new admin into the database
        const insertQuery = "INSERT INTO users (name, email, password, role_id, created_at) VALUES ($1, $2, $3, $4, $5)";
        await pool.query(insertQuery, [name, email, hashedPassword, 3, createdAt]); // Assuming role_id 3 is for admins

        res.redirect("/login/admin"); // Redirect to login after successful signup
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
});

// login page
app.get("/login/:role", (req, res) => {
    const role = req.params.role;
    res.render("login", { role });
});

// Handle Login Submission
app.post("/login", async (req, res) => {
    const { email, password, role } = req.body;
    console.log(email);
    console.log(password);
    console.log(role);
    try {
        // Check user existence and role
        const query = `
            SELECT users.*, user_roles.role_name 
            FROM users 
            JOIN user_roles ON users.role_id = user_roles.id 
            WHERE email = $1 AND user_roles.role_name = $2
        `;

        const result = await pool.query(query, [email, role]);

        if (result.rows.length === 0) {
            return res.render("login", { role, error: "Invalid email or role." });
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
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});

// Dashboard Route
app.get("/dashboard", async (req, res) => {
    if (!req.session.user) {
        return res.redirect("/");
    }

    try {
        const query = `
            SELECT notices.title, notices.content, users.name AS teacher_name, notices.created_at
            FROM notices
            JOIN users ON notices.posted_by = users.id
            ORDER BY notices.created_at DESC
        `;

        const result = await pool.query(query);

        res.render("dashboard", {
            user: req.session.user,
            notices: result.rows
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
});



// app.get("/notices", async (req, res) => {
//     try {
//         const result = await pool.query("SELECT * FROM notices ORDER BY created_at DESC");
//         res.json(result.rows);
//     } catch (err) {
//         console.error(err);
//         res.status(500).send("❌ Server Error");
//     }
// });

// Logout Route
app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/");
    });
});

app.listen(PORT, () => {
    console.log(`✅ Server is running at http://localhost:${PORT}`);
});
