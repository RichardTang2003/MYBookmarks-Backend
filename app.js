require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const PORT = process.env.PORT || 3001; // 设置服务器端口
const DB_FILE = process.env.DB_FILE || 'bookmarks.db'; // 数据库文件名

app.use(cors()); // 允许跨域请求
app.use(express.json()); // 解析JSON格式的请求体

// Swagger (OpenAPI) setup
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'MYBookmarks API',
            version: '0.1.0',
            description: 'API for MYBookmarks backend'
        },
        servers: [
            { url: 'http://localhost:' + PORT }
        ],
        components: {
            schemas: {
                Folder: {
                    type: 'object',
                    description: '文件夹对象，支持多级嵌套',
                    properties: {
                        id: { type: 'integer', description: '文件夹ID', example: 1 },
                        name: { type: 'string', description: '文件夹名称', example: '工作' },
                        parentId: { type: ['integer','null'], description: '父文件夹ID，null表示根目录', example: null },
                        createdAt: { type: 'string', format: 'date-time', description: '创建时间', example: '2025-08-17T12:34:56Z' },
                        children: { type: 'array', description: '子文件夹列表', items: { $ref: '#/components/schemas/Folder' } },
                        bookmarks: { type: 'array', description: '该文件夹下的书签列表', items: { $ref: '#/components/schemas/Bookmark' } }
                    }
                },
                Bookmark: {
                    type: 'object',
                    description: '书签对象',
                    properties: {
                        id: { type: 'integer', description: '书签ID', example: 1 },
                        title: { type: 'string', description: '书签标题', example: '示例网站' },
                        url: { type: 'string', format: 'uri', description: '书签链接', example: 'https://example.com' },
                        folderId: { type: ['integer','null'], description: '所属文件夹ID，null为根目录', example: null },
                        createdAt: { type: 'string', format: 'date-time', description: '创建时间', example: '2025-08-17T12:34:56Z' }
                    }
                },
                Error: {
                    type: 'object',
                    description: '统一的错误响应结构',
                    properties: {
                        error: { type: 'string', description: '错误信息' },
                        code: { type: 'string', description: '错误代码（可选）', example: 'INVALID_INPUT' }
                    }
                }
            },
            responses: {
                InvalidInput: {
                    description: 'Invalid request input',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                            examples: {
                                invalid: { value: { error: 'Invalid input', code: 'INVALID_INPUT' } }
                            }
                        }
                    }
                },
                NotFound: {
                    description: 'Resource not found',
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
                },
                Forbidden: {
                    description: 'Forbidden',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                            examples: { forbidden: { value: { error: 'Forbidden', code: 'FORBIDDEN' } } }
                        }
                    }
                },
                AuthRequired: {
                    description: 'Authentication required',
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
                },
                AuthFailed: {
                    description: 'Authentication failed',
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
                },
                DBError: {
                    description: 'Database error',
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
                },
                ServerError: {
                    description: 'Internal server error',
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
                },
                RegistrationDisabled: {
                    description: 'Registration disabled',
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
                },
                SuccessStructure: {
                    description: 'User folders and bookmarks structure',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    folders: { type: 'array', items: { $ref: '#/components/schemas/Folder' } },
                                    bookmarks: { type: 'array', items: { $ref: '#/components/schemas/Bookmark' } }
                                }
                            }
                        }
                    }
                }
            }
        }
    },
    apis: [__filename] // use this file's JSDoc comments
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/v0/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const sql = require('./utils/sql');
const auth = require('./utils/auth');
// 配置：是否允许新用户注册，默认允许。设置环境变量 REGISTRATION_ENABLED=false 可以关闭注册。
const REGISTRATION_ENABLED = !['0', 'false', 'no'].includes((process.env.REGISTRATION_ENABLED || 'true').toLowerCase());

app.get('/v0/users/:id/structure', async (req, res) => {
    const userId = parseInt(req.params.id, 10);
    if (Number.isNaN(userId)) return require('./utils/error').badRequest(res, 'Invalid user id', 'INVALID_INPUT');

    try {
        // 取出该用户拥有的文件夹和书签
        const folders = (await sql.allFolders()).filter(f => f.userId === userId);
        const bookmarks = (await sql.allBookmarks()).filter(b => b.userId === userId);

        const folderMap = {};
        folders.forEach(folder => {
            folderMap[folder.id] = { ...folder, children: [], bookmarks: [] };
        });

        bookmarks.forEach(bookmark => {
            const parentFolder = folderMap[bookmark.folderId];
            if (parentFolder) {
                parentFolder.bookmarks.push(bookmark);
            }
        });

        const structure = [];
        folders.forEach(folder => {
            const parentFolder = folderMap[folder.parentId];
            if (parentFolder) {
                parentFolder.children.push(folderMap[folder.id]);
            } else {
                structure.push(folderMap[folder.id]);
            }
        });

        const rootBookmarks = bookmarks.filter(b => b.folderId === null || b.folderId === undefined);
    res.json({ folders: structure, bookmarks: rootBookmarks });
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve user structure', code: 'DB_ERROR' });
    }
});

/**
 * @openapi
 * /v0/users/{id}/structure:
 *   get:
 *     summary: Get folders and bookmarks structure for a user
 *     description: 返回指定用户的文件夹树以及根目录下的书签
 *     tags:
 *       - structure
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 用户ID
 *     responses:
 *       200:
 *         $ref: '#/components/responses/SuccessStructure'
 *       400:
 *         $ref: '#/components/responses/InvalidInput'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/DBError'
 */

app.post('/v0/folders', auth.authenticate, async (req, res) => {
    const { name, parentId = null } = req.body;

    if (!name) {
        return require('./utils/error').badRequest(res, 'Folder name is required', 'INVALID_INPUT');
    }

    try {
    const id = await sql.insertFolder({ name, parentId, userId: req.user.id });
    res.status(201).json({ id, name, parentId, userId: req.user.id });
    } catch (err) {
    return require('./utils/error').serverError(res, 'Failed to create folder');
    }
});

/**
 * @openapi
 * /v0/folders:
 *   post:
 *     summary: 创建文件夹
 *     description: 创建一个新的文件夹，可指定 parentId 放到某个父文件夹下
 *     tags:
 *       - folders
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 description: 文件夹名称
 *                 example: 工作
 *               parentId:
 *                 oneOf:
 *                   - type: integer
 *                   - type: "null"
 *                 description: 父文件夹ID，null 表示根目录
 *                 example: null
 *     responses:
 *       201:
 *         description: 已创建
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   example: 12
 *                 name:
 *                   type: string
 *                   example: 工作
 *                 parentId:
 *                   oneOf:
 *                     - type: integer
 *                     - type: "null"
 *                   example: null
 *       400:
 *         description: 参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

app.delete('/v0/folders/:id', auth.authenticate, async (req, res) => {
    const { id } = req.params;
    try {
        const folder = await sql.getFolderById(id);
    if (!folder) return res.status(404).json({ error: 'Folder not found', code: 'NOT_FOUND' });
    if (folder.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden: cannot delete another user\'s folder', code: 'FORBIDDEN' });
    const changes = await sql.deleteFolder(id);
    if (changes === 0) return require('./utils/error').notFound(res, 'Folder not found');
    res.status(200).json({ message: 'Folder deleted successfully' });
    } catch (err) {
    return require('./utils/error').serverError(res, 'Failed to delete folder');
    }
});

/**
 * @openapi
 * /v0/folders/{id}:
 *   delete:
 *     summary: 删除文件夹
 *     description: 删除指定ID的文件夹，会级联删除子文件夹与书签
 *     tags:
 *       - folders
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 要删除的文件夹ID
 *     responses:
 *       200:
 *         description: 删除成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 文件夹已成功删除
 *       404:
 *         description: 未找到
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

app.post('/v0/bookmarks', auth.authenticate, async (req, res) => {
    const { title, url, folderId = null } = req.body;

    if (!title || !url) {
        return require('./utils/error').badRequest(res, 'Bookmark title and URL are required', 'INVALID_INPUT');
    }

    try {
    const id = await sql.insertBookmark({ title, url, folderId, userId: req.user.id });
    res.status(201).json({ id, title, url, folderId, userId: req.user.id });
    } catch (err) {
    return require('./utils/error').serverError(res, 'Failed to create bookmark');
    }
});

/**
 * @openapi
 * /v0/bookmarks:
 *   post:
 *     summary: 创建书签
 *     description: 在指定文件夹（folderId）下创建书签，folderId 可为空表示根目录
 *     tags:
 *       - bookmarks
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, url]
 *             properties:
 *               title:
 *                 type: string
 *                 description: 书签标题
 *                 example: 示例网站
 *               url:
 *                 type: string
 *                 description: 书签链接
 *                 example: https://example.com
 *               folderId:
 *                 oneOf:
 *                   - type: integer
 *                   - type: "null"
 *                 description: 所属文件夹ID，null 表示根目录
 *                 example: null
 *     responses:
 *       201:
 *         description: 已创建
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Bookmark'
 *       400:
 *         description: 参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

app.delete('/v0/bookmarks/:id', auth.authenticate, async (req, res) => {
    const { id } = req.params;
    try {
        const bm = await sql.getBookmarkById(id);
    if (!bm) return require('./utils/error').notFound(res, 'Bookmark not found');
    if (bm.userId !== req.user.id) return require('./utils/error').forbidden(res, 'Forbidden: cannot delete another user\'s bookmark');
    const changes = await sql.deleteBookmark(id);
        if (changes === 0) return require('./utils/error').notFound(res, 'Bookmark not found');
        res.status(200).json({ message: 'Bookmark deleted successfully' });
    } catch (err) {
    return require('./utils/error').serverError(res, 'Failed to delete bookmark');
    }
});

/**
 * @route POST /v0/register
 * @desc 注册新用户
 */
app.post('/v0/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return require('./utils/error').badRequest(res, 'username/password required', 'INVALID_INPUT');
    if (!REGISTRATION_ENABLED) return require('./utils/error').forbidden(res, 'Registration is disabled', 'REGISTRATION_DISABLED');
    try {
        const id = await sql.insertUser({ username, passwordHash: require('bcryptjs').hashSync(password, 10) });
        res.status(201).json({ id, username });
    } catch (err) {
        return require('./utils/error').serverError(res, 'Registration failed');
    }
});

/**
 * @route POST /v0/login
 * @desc 登录并返回 JWT
 */
app.post('/v0/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await sql.getUserByUsername(username);
    if (!user) return require('./utils/error').authFailed(res, 'Invalid username or password');
    const ok = require('bcryptjs').compareSync(password, user.passwordHash);
    if (!ok) return require('./utils/error').authFailed(res, 'Invalid username or password');
        const jwt = require('jsonwebtoken');
        const token = jwt.sign({ sub: user.id, username: user.username }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '7d' });
        res.json({ token });
    } catch (err) {
    return require('./utils/error').serverError(res, 'Login failed');
    }
});

/**
 * @openapi
 * /v0/bookmarks/{id}:
 *   delete:
 *     summary: 删除书签
 *     description: 根据ID删除单个书签
 *     tags:
 *       - bookmarks
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 要删除的书签ID
 *     responses:
 *       200:
 *         description: 删除成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 书签已成功删除
 *       404:
 *         description: 未找到
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

if (require.main === module) {
    const run = async () => {
        try {
            await sql.initSchema();
            console.log('数据库(使用 knex) 初始化完成。');
        } catch (err) {
            console.error('数据库初始化失败:', err.message);
        }

        app.listen(PORT, () => {
            console.log(`服务器正在 http://localhost:${PORT} 上运行`);
        });
    };
    run();

    process.on('SIGINT', () => {
        sql.close().then(() => {
            console.log('数据库连接已关闭。');
            process.exit(0);
        }).catch(err => {
            console.error('关闭数据库失败:', err.message);
            process.exit(1);
        });
    });
}

module.exports = app;