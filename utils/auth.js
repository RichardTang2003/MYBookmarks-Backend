const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const sql = require('./sql');
const errs = require('./error');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

async function createUser(username, password) {
  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(password, salt);
  const id = await sql.insertUser({ username, passwordHash: hash });
  return id;
}

async function verifyUser(username, password) {
  const user = await sql.getUserByUsername(username);
  if (!user) return null;
  const ok = bcrypt.compareSync(password, user.passwordHash);
  if (!ok) return null;
  // sign token
  const token = jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  return { token, user };
}

function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return errs.authRequired(res);
  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return errs.invalidAuthHeader(res);
  const token = parts[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, username: payload.username };
    next();
  } catch (err) {
    return errs.invalidToken(res);
  }
}

module.exports = { createUser, verifyUser, authenticate };
