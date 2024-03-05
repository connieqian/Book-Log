import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import env from "dotenv";

const app = express();
const port = 4000;
env.config();

const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});
db.connect();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// GET all posts by a user, sorted
app.get("/posts/:user/:sortedBy", async (req, res) => {
  const userID = req.params.user;
  const sortedBy = req.params.sortedBy;
  try {
    let result = await db.query("SELECT * FROM logs WHERE user_id = $1 ORDER BY timestamp DESC", [userID]);
    if (sortedBy === "title") {
      result = await db.query("SELECT * FROM logs WHERE user_id = $1 ORDER BY LOWER(title)", [userID]);
    } else if (sortedBy === "author") {
      result = await db.query("SELECT * FROM logs WHERE user_id = $1 ORDER BY LOWER(author)", [userID]);
    } else if (sortedBy === "rating") {
      result = await db.query("SELECT * FROM logs WHERE user_id = $1 ORDER BY rating DESC NULLS LAST", [userID]);
    }
    const items = result.rows;
    console.log(items);
    res.json(items);
  } catch (err) {
    console.log(err);
    return res.status(404).json({ message: "Posts not found" });
  }
});

// GET a specific post 
app.get("/posts/:id", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM logs WHERE log_id = $1", [req.params.id]);
    const post = result.rows;
    console.log(post);
    res.json(post);
  } catch (err) {
    console.log(err);
    return res.status(404).json({ message: "Post not found" });
  }
});

// GET the number of books a user has read and the date of their first log
app.get("/stat/:user", async (req, res) => {
  try {
    const result = await db.query("SELECT COUNT(*) FROM logs WHERE user_id = $1", [req.params.user]);
    const numBooksLogged = result.rows[0].count;
    console.log(numBooksLogged);
    const earliest = await db.query("SELECT * FROM logs WHERE user_id = $1 ORDER BY timestamp LIMIT 1", [req.params.user]);
    let earliestLog = -1
    if (earliest.rows.length > 0) {
      earliestLog = new Date(earliest.rows[0].timestamp).getFullYear();
    }
    console.log(earliestLog);
    res.json({numBooksLogged: numBooksLogged,
              earliestLog: earliestLog});
  } catch (err) {
    console.log(err);
  }
});

// POST posts searched
app.post("/search/:user", async (req, res) => {
  console.log("keyword: ", req.body);
  try {
    const result = await db.query(
      "SELECT * FROM logs WHERE user_id = $1 AND (LOWER(notes) LIKE '%' || $2 || '%' OR LOWER(review) LIKE '%' || $2 || '%');", 
      [req.params.user, req.body.keyword.toLowerCase()]);
    const items = result.rows;
    console.log(items);
    res.json(items);
  } catch (err) {
    console.log(err);
    return res.status(404).json({ message: "Posts not found" });
  }
});


// POST a new log by user
app.post("/posts/:user/", async (req, res) => {
  const title = req.body.title;
  const author = req.body.author;
  const isbn = parseInt(req.body.isbn);
  const timestamp = new Date().toISOString();
  const rating = parseInt(req.body.rating);
  const review = req.body.review;
  const notes = req.body.notes;
  console.log("isbn: ", isbn, typeof isbn);
  console.log("num: ", req.body.rating, typeof req.body.rating);
  console.log("rating: ", rating, typeof rating);
  
  try {
    const result = await db.query(
        "INSERT INTO logs (title, author, isbn, timestamp, rating, review, notes, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *;", 
        [title, author, isbn, timestamp, rating, review, notes, req.params.user]);
    const post = result.rows[0];
    res.status(201).json(post);
  } catch (err) {
    console.log(err);
    return res.status(404).json({ message: "This title has already been added. Try again." });
  }
});

// PUT a post 
app.put("/posts/:id", async (req, res) => {
  const title = req.body.title ;
  const author = req.body.author;
  const isbn = parseInt(req.body.isbn);
  const rating = parseInt(req.body.rating) ;
  const review = req.body.review ;
  const notes = req.body.notes ;
  // const before = await db.query("SELECT * FROM logs WHERE log_id = $1", [req.params.id]);
  // const existingLog = before.rows[0];
  // const title = req.body.title || existingLog.title;
  // const author = req.body.author || existingLog.author;
  // const isbn = parseInt(req.body.isbn) || existingLog.isbn;
  // const rating = parseInt(req.body.rating) || existingLog.rating;
  // const review = req.body.review || existingLog.review;
  // const notes = req.body.notes || existingLog.notes;
  try {
    const result = await db.query(
      "UPDATE logs SET title = $1, author = $2, isbn = $3, rating = $4, review = $5, notes = $6 WHERE log_id = $7 RETURNING *;", 
      [title, author, isbn, rating, review, notes, req.params.id]);
    res.json(result.rows);
  } catch (err) {
    console.log(err);
  }
});

// DELETE post
app.delete("/posts/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM logs WHERE log_id = $1", [req.params.id]);
    res.json({ message: "Post deleted" });
  } catch (err) {
    console.log(err);
    return res.status(404).json({ message: "Post not found" });
  }
});

app.listen(port, () => {
  console.log(`API is running at http://localhost:${port}`);
});
