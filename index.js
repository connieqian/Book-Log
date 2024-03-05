import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import axios from "axios";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import GoogleStrategy from "passport-google-oauth2";
import session from "express-session";
import env from "dotenv";

const app = express();
const port = 3000;
const API_URL = "http://localhost:4000";
const saltRounds = 10;
env.config();

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(bodyParser.json());
app.use(passport.initialize());
app.use(passport.session());

const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});
db.connect();

let sort_by = "timestamp";

/**********GET ROUTES*********/
// Render hompage
app.get("/", (req, res) => {
  res.render("home.ejs");
  });

// Render login page
app.get("/login", (req, res) => {
  res.render("login.ejs");
});

// Render registration page
app.get("/register", (req, res) => {
  res.render("register.ejs");
});

// Render home page once user logs out
app.get("/logout", (req, res) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

// Render book logs
app.get("/logs", async (req, res) => {
  if (req.isAuthenticated()) {
      console.log("sortby: ", sort_by);
      console.log("main page user: ", req.user.user_id);
      console.log("reqest log url: ", `${API_URL}/posts/${req.user.user_id}/timestamp`);
        try {
            const log_response = await axios.get(`${API_URL}/posts/${req.user.user_id}/${sort_by}`);
            console.log("all user logs: ", log_response.data);
            const stat_response = await axios.get(`${API_URL}/stat/${req.user.user_id}`);
            console.log("user stat: ", stat_response.data);
            res.render("logs.ejs", { posts: log_response.data, 
                                     stat: stat_response.data,
                                     sortby: sort_by,
                                    });
        } catch (error) {
          res.status(500).json({ message: "Error fetching posts" });
        }
    } else {
        res.render("home.ejs",);
    }
  });

// Route to render the page to post new logs
app.get("/new", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("submit.ejs", { heading: "New Log", submit: "Create Post" });
  } else {
    res.render("home.ejs");
  }
  });

// Route to render the edit log page
app.get("/edit/:id", async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      const response = await axios.get(`${API_URL}/posts/${req.params.id}`);
      console.log("edit pre-fill: ", response.data);
      res.render("submit.ejs", {
        heading: "Edit Log",
        submit: "Update Post",
        post: response.data[0],
      });
    } catch (error) {
      res.status(500).json({ message: "Error fetching post" });
    }
  } else {
    res.render("home.ejs");
  }
  });

app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

app.get(
  "/auth/google/logs",
  passport.authenticate("google", {
    successRedirect: "/logs",
    failureRedirect: "/login",
  })
);

/**********POST ROUTES*********/
app.post("/login", passport.authenticate("local", {
    successRedirect: "/logs",
    failureRedirect: "/login",
  })
);

app.post("/register", async (req, res) => {
  const email = req.body.username;
  const password = req.body.password;

  try {
    const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (checkResult.rows.length > 0) {
      req.redirect("/login");
    } else {
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) {
          console.error("Error hashing password:", err);
        } else {
          const result = await db.query(
            "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *",
            [email, hash]
          );
          const user = result.rows[0];
          req.login(user, (err) => {
            console.log("success");
            res.redirect("/logs");
          });
        }
      });
    }
  } catch (err) {
    console.log(err);
  }
});

// Sort logs
app.post("/api/sort", async (req, res) => {
  sort_by = req.body.sortBy;
  console.log('new sortby: ', sort_by);
  if (req.isAuthenticated()) {
      console.log("main page user: ", req.user.user_id);
        try {
            res.redirect('/logs');
        } catch (error) {
          res.status(500).json({ message: "Error fetching posts" });
        }
    } else {
        res.render("home.ejs",);
    }
  });

// Search logs
app.post("/api/search", async (req, res) => {
  if (req.isAuthenticated()) {
      console.log("search user: ", req.user.user_id);
      console.log('search keyword: ', req.body);
      console.log('api search path: ', `${API_URL}/search/${req.user.user_id}`)
        try {
            const log_response = await axios.post(`${API_URL}/search/${req.user.user_id}`, req.body);
            console.log("search results: ", log_response.data);
            const stat_response = await axios.get(`${API_URL}/stat/${req.user.user_id}`);
            console.log("user stat: ", stat_response.data);
            res.render("logs.ejs", { posts: log_response.data, 
                                     stat: stat_response.data,
                                    });
        } catch (error) {
          res.status(500).json({ message: "Error fetching posts" });
        }
    } else {
        res.render("home.ejs",);
    }
  });

// Create a new log
app.post("/api/logs", async (req, res) => {
  console.log('submit post: ', req.body);
  if (req.isAuthenticated()) {
    console.log('user info upon submit: ', req.user);
    try {
      const response = await axios.post(`${API_URL}/posts/${req.user.user_id}`, req.body);
      console.log(response.data);
      res.redirect("/logs");
    } catch (error) {
      console.log("Error creating post");
      res.render("submit.ejs", {
        heading: "New Log",
        submit: "Create Post",
        post: req.body,
        error: "This title has already been submitted"
      });
    }
  } else {
      res.render("home.ejs");
  }
});

// Edit a log
app.post("/api/posts/:id", async (req, res) => {
  console.log("edit api path: ", `${API_URL}/posts/${req.params.id}`);
  console.log("updated data: ", req.body);
  if (req.isAuthenticated()) {
    console.log('edit post user: ', req.user);
    try {
      const response = await axios.put(
        `${API_URL}/posts/${req.params.id}`,
        req.body
      );
      console.log(response.data);
      res.redirect("/logs");
    } catch (error) {
      res.status(500).json({ message: "Error updating post" });
    }
  } else {
    res.render("home.ejs");
  }
  });

// Delete a post
app.get("/api/posts/delete/:id", async (req, res) => {
  console.log("delete id", req.params.id);
  if (req.isAuthenticated()) {
    try {
      await axios.delete(`${API_URL}/posts/${req.params.id}`);
      res.redirect("/logs");
    } catch (error) {
      res.status(500).json({ message: "Error deleting post" });
    }
  } else {
    res.render("home.ejs");
  }
  });

passport.use(
  "local",
  new Strategy(async function verify(username, password, cb) {
    try {
      const result = await db.query("SELECT * FROM users WHERE email = $1 ", [
        username,
      ]);
      if (result.rows.length > 0) {
        const user = result.rows[0];
        const storedHashedPassword = user.password;
        bcrypt.compare(password, storedHashedPassword, (err, valid) => {
          if (err) {
            console.error("Error comparing passwords:", err);
            return cb(err);
          } else {
            if (valid) {
              return cb(null, user);
            } else {
              return cb(null, false);
            }
          }
        });
      } else {
        return cb("User not found");
      }
    } catch (err) {
      console.log(err);
    }
  })
);

passport.use(
  "google",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/logs",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    async (accessToken, refreshToken, profile, cb) => {
      try {
        console.log(profile);
        const result = await db.query("SELECT * FROM users WHERE email = $1", [
          profile.email,
        ]);
        if (result.rows.length === 0) {
          const newUser = await db.query(
            "INSERT INTO users (email, password) VALUES ($1, $2)",
            [profile.email, "google"]
          );
          return cb(null, newUser.rows[0]);
        } else {
          return cb(null, result.rows[0]);
        }
      } catch (err) {
        return cb(err);
      }
    }
  )
);
passport.serializeUser((user, cb) => {
  cb(null, user);
});

passport.deserializeUser((user, cb) => {
  cb(null, user);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
