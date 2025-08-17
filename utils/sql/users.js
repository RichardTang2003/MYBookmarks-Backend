const { db } = require('./base');

async function insert({ username, passwordHash }) {
  const [id] = await db('users').insert({ username, passwordHash });
  return id;
}

async function getByUsername(username) {
  return db('users').where({ username }).first();
}

async function getById(id) {
  return db('users').where({ id }).first();
}

module.exports = { insert, getByUsername, getById };
