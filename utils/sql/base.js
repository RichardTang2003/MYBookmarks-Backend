const knex = require('knex');
const path = require('path');

const DB_CLIENT = process.env.DB_CLIENT || 'sqlite3'; // 'mysql2' for MySQL

function buildConfig() {
  if (DB_CLIENT === 'mysql2') {
    return {
      client: 'mysql2',
      connection: {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'mybookmarks'
      },
      pool: { min: 0, max: 7 }
    };
  }

  return {
    client: 'sqlite3',
    connection: {
      // resolve DB_FILE to an absolute path so it's created where expected
      filename: path.resolve(process.env.DB_FILE || path.join(__dirname, '..', '..', 'bookmarks.db'))
    },
    useNullAsDefault: true,
    pool: { min: 1, max: 1 }
  };
}

const config = buildConfig();
const db = knex(config);

// Log the sqlite filename (helps confirm .env was loaded and which file will be used)
if (config.client === 'sqlite3') {
  try {
    console.log('[sql] sqlite filename:', config.connection.filename);
  } catch (e) {
    // ignore logging errors
  }
}

async function initSchema() {
  // enable foreign keys for sqlite
  if (config.client === 'sqlite3') {
    await db.raw('PRAGMA foreign_keys = ON');
  }

  const hasFolders = await db.schema.hasTable('folders');
  if (!hasFolders) {
    await db.schema.createTable('folders', (t) => {
      t.increments('id').primary();
      t.string('name').notNullable();
      t.integer('parentId').nullable();
      t.integer('userId').nullable();
      t.timestamp('createdAt').defaultTo(db.fn.now());
    });
  } else {
    // ensure userId column exists on existing folders table
    const hasUserId = await db.schema.hasColumn('folders', 'userId');
    if (!hasUserId) {
      await db.schema.alterTable('folders', (t) => {
        t.integer('userId').nullable();
      });
    }
  }

  const hasBookmarks = await db.schema.hasTable('bookmarks');
  if (!hasBookmarks) {
    await db.schema.createTable('bookmarks', (t) => {
      t.increments('id').primary();
      t.string('title').notNullable();
      t.string('url').notNullable();
      t.integer('folderId').nullable();
      t.integer('userId').nullable();
      t.timestamp('createdAt').defaultTo(db.fn.now());
      if (config.client !== 'sqlite3') {
        t.foreign('folderId').references('folders.id').onDelete('CASCADE');
        t.foreign('userId').references('users.id').onDelete('CASCADE');
      }
    });
    // Note: For sqlite, foreign keys are enabled by PRAGMA above; schema created.
  }

  const hasUsers = await db.schema.hasTable('users');
  if (!hasUsers) {
    await db.schema.createTable('users', (t) => {
      t.increments('id').primary();
      t.string('username').notNullable().unique();
      t.string('passwordHash').notNullable();
      t.timestamp('createdAt').defaultTo(db.fn.now());
    });
  }
}

async function close() {
  await db.destroy();
}

module.exports = { db, initSchema, close };
