const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { expect } = require('chai');

// Use a temp sqlite file per test run to isolate state
const tmpDb = path.join(__dirname, `test-bookmarks-${Date.now()}.db`);
process.env.DB_CLIENT = 'sqlite3';
process.env.DB_FILE = tmpDb;
process.env.JWT_SECRET = 'test-secret';

const app = require('../app');

describe('MYBookmarks API', function() {
  this.timeout(5000);

  before(async () => {
    const sql = require('../utils/sql');
    await sql.initSchema();
  });

  after(async function() {
    // close knex connection if available
    try {
      const sql = require('../utils/sql');
      await sql.close();
    } catch (e) {
      // ignore
    }

    // remove temp db file
    try { fs.unlinkSync(tmpDb); } catch (e) {}
  });

  let tokenA = null;
  let tokenB = null;
  let folderId = null;
  let bmId = null;
  let userAId = null;

  it('should register user A', async () => {
    const res = await request(app)
      .post('/v0/register')
      .send({ username: 'alice', password: 'password' });
    expect(res.status).to.equal(201);
    expect(res.body).to.have.property('id');
  userAId = res.body.id;
  });

  it('should login user A and receive token', async () => {
    const res = await request(app)
      .post('/v0/login')
      .send({ username: 'alice', password: 'password' });
    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('token');
    tokenA = res.body.token;
  });

  it('should register user B and login', async () => {
    const r1 = await request(app).post('/v0/register').send({ username: 'bob', password: 'secret' });
    expect(r1.status).to.equal(201);
    const r2 = await request(app).post('/v0/login').send({ username: 'bob', password: 'secret' });
    expect(r2.status).to.equal(200);
    tokenB = r2.body.token;
  });

  it('user A creates a folder', async () => {
    const res = await request(app)
      .post('/v0/folders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Work' });
    expect(res.status).to.equal(201);
    expect(res.body).to.have.property('id');
    folderId = res.body.id;
  });

  it('user B cannot delete user A folder', async () => {
    const res = await request(app)
      .delete(`/v0/folders/${folderId}`)
      .set('Authorization', `Bearer ${tokenB}`);
  expect(res.status).to.equal(403);
  expect(res.body).to.have.property('error');
  expect(res.body).to.have.property('code');
  expect(res.body.code).to.equal('FORBIDDEN');
  });

  it('user A creates a bookmark in the folder', async () => {
    const res = await request(app)
      .post('/v0/bookmarks')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Example', url: 'https://example.com', folderId });
    expect(res.status).to.equal(201);
    expect(res.body).to.have.property('id');
    bmId = res.body.id;
  });

  it('user B cannot delete user A bookmark', async () => {
    const res = await request(app)
      .delete(`/v0/bookmarks/${bmId}`)
      .set('Authorization', `Bearer ${tokenB}`);
  expect(res.status).to.equal(403);
  expect(res.body).to.have.property('error');
  expect(res.body).to.have.property('code');
  expect(res.body.code).to.equal('FORBIDDEN');
  });

  it('user-specific structure endpoint returns created folder and bookmark', async () => {
    const res = await request(app).get(`/v0/users/${userAId}/structure`);
    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('folders');
    const folders = res.body.folders;
    const found = folders.some(f => f.id === folderId);
    expect(found).to.be.true;
  });

  it('user A can delete own bookmark and folder', async () => {
    const r1 = await request(app).delete(`/v0/bookmarks/${bmId}`).set('Authorization', `Bearer ${tokenA}`);
    expect(r1.status).to.equal(200);
    const r2 = await request(app).delete(`/v0/folders/${folderId}`).set('Authorization', `Bearer ${tokenA}`);
    expect(r2.status).to.equal(200);
  });

});
