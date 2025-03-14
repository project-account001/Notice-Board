require("dotenv").config();
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
    res.send("🚀 Node.js server is running successfully!");
});

app.listen(PORT, () => {
    console.log(`✅ Server is running at http://localhost:${PORT}`);
});
