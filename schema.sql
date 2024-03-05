CREATE TABLE users (
  user_id SERIAL PRIMARY KEY,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(100)
);

CREATE TABLE logs (
  log_id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  author VARCHAR(255) NOT NULL,
  isbn BIGINT NOT NULL CHECK (isbn > 999999999 AND isbn < 10000000000000),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  rating SMALLINT CHECK (rating >= 0 AND rating <= 5),
  review TEXT,
  notes TEXT,
  user_id INTEGER REFERENCES users(user_id),
  UNIQUE (user_id, isbn)
);
