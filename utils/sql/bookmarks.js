const { db } = require('./base');

async function all() {
  return db('bookmarks').select('*').orderBy('createdAt', 'desc');
}

async function create({ title, url, folderId = null, userId = null }) {
  const [id] = await db('bookmarks').insert({ title, url, folderId, userId });
  return id;
}

async function remove(id) {
  return db('bookmarks').where({ id }).del();
}

async function getById(id) {
  return db('bookmarks').where({ id }).first();
}

module.exports = { all, create, remove, getById };
