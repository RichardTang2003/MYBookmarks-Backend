const base = require('./base');
const folders = require('./folders');
const bookmarks = require('./bookmarks');
const users = require('./users');

module.exports = {
  initSchema: base.initSchema,
  close: base.close,

  // folders
  allFolders: folders.all,
  insertFolder: folders.create,
  getFolderById: folders.getById,
  deleteFolder: folders.remove,

  // bookmarks
  allBookmarks: bookmarks.all,
  insertBookmark: bookmarks.create,
  getBookmarkById: bookmarks.getById,
  deleteBookmark: bookmarks.remove
  ,
  // users
  insertUser: users.insert,
  getUserByUsername: users.getByUsername,
  getUserById: users.getById
};
