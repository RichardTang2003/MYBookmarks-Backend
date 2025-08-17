const { db } = require('./base');

async function all() {
  return db('folders').select('*').orderBy('name');
}

async function create({ name, parentId = null, userId = null }) {
  const [id] = await db('folders').insert({ name, parentId, userId });
  return id;
}

async function remove(id) {
  return db('folders').where({ id }).del();
}

async function getById(id) {
  return db('folders').where({ id }).first();
}

module.exports = { all, create, remove, getById };
