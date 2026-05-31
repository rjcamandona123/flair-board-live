import { buildSchema, graphql } from 'graphql';
import { query, run, first, genId, corsHeaders } from './lib';

var schema = buildSchema(`
  type Board {
    id: ID!, name: String!, user_id: String!, is_public: Boolean!
    pin_count: Int, created: Float
  }
  type Pin {
    id: ID!, board_id: String!, x: Float!, y: Float!
    label: String!, url: String!, url_title: String!, icon: String!
    color: String!, text_color: String!, image_upload: String!
    visitor_id: String!, created: Float
  }
  type User {
    id: ID!, username: String!, email: String!, created: Float
  }
  type Query {
    boards: [Board!]!
    board(id: ID!): Board
    pins(board_id: ID!, search: String, label: String, sort: String): [Pin!]!
    pin(id: ID!): Pin
    pinsByUrl(url: String!): [Pin!]!
    pinsByVisitor(visitor_id: String!): [Pin!]!
    users: [User!]!
    user(id: ID!): User
    userByEmail(email: String!): User
    userByUsername(username: String!): User
    boardCount(user_id: String): Int!
    pinCount(board_id: ID!): Int!
  }
  type Mutation {
    createBoard(name: String!, user_id: String, is_public: Boolean): Board!
    updateBoard(id: ID!, name: String, is_public: Boolean, user_id: String): Board!
    deleteBoard(id: ID!): Boolean!
    createPin(board_id: ID!, x: Float, y: Float, label: String, url: String, url_title: String, icon: String, color: String, text_color: String, image_upload: String, visitor_id: String): Pin!
    updatePin(id: ID!, board_id: String, x: Float, y: Float, label: String, url: String, url_title: String, icon: String, color: String, text_color: String, image_upload: String, visitor_id: String): Pin!
    deletePin(id: ID!): Boolean!
    createUser(username: String!, email: String, password: String!): User!
    updateUser(id: ID!, username: String, email: String, password: String): User!
  }
`);

function ctx(context) { return context; }

var root = {
  boards: async function(args, context) {
    var c = ctx(context);
    return await query(c, 'SELECT * FROM boards ORDER BY created DESC');
  },
  board: async function(args, context) {
    return await first(ctx(context), 'SELECT * FROM boards WHERE id = ?', args.id);
  },
  pins: async function(args, context) {
    var c = ctx(context);
    var sql = 'SELECT * FROM pins WHERE board_id = ?';
    var params = [args.board_id];
    if (args.search) { sql += ' AND (label LIKE ? OR url LIKE ?)'; params.push('%' + args.search + '%', '%' + args.search + '%'); }
    if (args.label) { sql += ' AND label = ?'; params.push(args.label); }
    if (args.sort === 'created') sql += ' ORDER BY created DESC';
    else if (args.sort === 'label') sql += ' ORDER BY label ASC';
    else sql += ' ORDER BY created DESC';
    return await query(c, sql, ...params);
  },
  pin: async function(args, context) {
    return await first(ctx(context), 'SELECT * FROM pins WHERE id = ?', args.id);
  },
  pinsByUrl: async function(args, context) {
    return await query(ctx(context), 'SELECT * FROM pins WHERE url = ? ORDER BY created DESC', args.url);
  },
  pinsByVisitor: async function(args, context) {
    return await query(ctx(context), 'SELECT * FROM pins WHERE visitor_id = ? ORDER BY created DESC', args.visitor_id);
  },
  users: async function(args, context) {
    return await query(ctx(context), 'SELECT id, username, email, created FROM users ORDER BY created DESC');
  },
  user: async function(args, context) {
    return await first(ctx(context), 'SELECT id, username, email, created FROM users WHERE id = ?', args.id);
  },
  userByEmail: async function(args, context) {
    return await first(ctx(context), 'SELECT id, username, email, created FROM users WHERE email = ?', args.email);
  },
  userByUsername: async function(args, context) {
    return await first(ctx(context), 'SELECT id, username, email, created FROM users WHERE username = ?', args.username);
  },
  boardCount: async function(args, context) {
    var c = ctx(context);
    if (args.user_id) {
      var row = await first(c, 'SELECT COUNT(*) AS count FROM boards WHERE user_id = ?', args.user_id);
      return row ? row.count : 0;
    }
    var row = await first(c, 'SELECT COUNT(*) AS count FROM boards');
    return row ? row.count : 0;
  },
  pinCount: async function(args, context) {
    var row = await first(ctx(context), 'SELECT COUNT(*) AS count FROM pins WHERE board_id = ?', args.board_id);
    return row ? row.count : 0;
  },
  createBoard: async function(args, context) {
    var c = ctx(context);
    var id = genId();
    await run(c, 'INSERT INTO boards (id, name, user_id, is_public, created) VALUES (?, ?, ?, ?, ?)',
      id, args.name, args.user_id || '', args.is_public ? 1 : 0, Date.now());
    return await first(c, 'SELECT * FROM boards WHERE id = ?', id);
  },
  updateBoard: async function(args, context) {
    var c = ctx(context);
    var b = await first(c, 'SELECT * FROM boards WHERE id = ?', args.id);
    if (!b) throw new Error('Board not found');
    var name = args.name !== undefined ? args.name : b.name;
    var pub = args.is_public !== undefined ? (args.is_public ? 1 : 0) : b.is_public;
    var uid = args.user_id !== undefined ? args.user_id : b.user_id;
    await run(c, 'UPDATE boards SET name = ?, is_public = ?, user_id = ? WHERE id = ?', name, pub, uid, args.id);
    return await first(c, 'SELECT * FROM boards WHERE id = ?', args.id);
  },
  deleteBoard: async function(args, context) {
    var c = ctx(context);
    await run(c, 'DELETE FROM pins WHERE board_id = ?', args.id);
    await run(c, 'DELETE FROM boards WHERE id = ?', args.id);
    return true;
  },
  createPin: async function(args, context) {
    var c = ctx(context);
    var id = genId();
    await run(c,
      'INSERT INTO pins (id, board_id, x, y, label, url, url_title, icon, color, text_color, image_upload, visitor_id, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id, args.board_id, args.x || 200, args.y || 200, args.label || '', args.url || '', args.url_title || '',
      args.icon || '', args.color || '#cc3333', args.text_color || '#ffffff', args.image_upload || '', args.visitor_id || '', Date.now());
    return await first(c, 'SELECT * FROM pins WHERE id = ?', id);
  },
  updatePin: async function(args, context) {
    var c = ctx(context);
    var p = await first(c, 'SELECT * FROM pins WHERE id = ?', args.id);
    if (!p) throw new Error('Pin not found');
    var bid = args.board_id !== undefined ? args.board_id : p.board_id;
    await run(c,
      'UPDATE pins SET board_id = ?, x = ?, y = ?, label = ?, url = ?, url_title = ?, icon = ?, color = ?, text_color = ?, image_upload = ?, visitor_id = ? WHERE id = ?',
      bid,
      args.x !== undefined ? args.x : p.x,
      args.y !== undefined ? args.y : p.y,
      args.label !== undefined ? args.label : p.label,
      args.url !== undefined ? args.url : p.url,
      args.url_title !== undefined ? args.url_title : p.url_title,
      args.icon !== undefined ? args.icon : p.icon,
      args.color !== undefined ? args.color : p.color,
      args.text_color !== undefined ? args.text_color : p.text_color,
      args.image_upload !== undefined ? args.image_upload : p.image_upload,
      args.visitor_id !== undefined ? args.visitor_id : p.visitor_id,
      args.id);
    return await first(c, 'SELECT * FROM pins WHERE id = ?', args.id);
  },
  deletePin: async function(args, context) {
    await run(ctx(context), 'DELETE FROM pins WHERE id = ?', args.id);
    return true;
  },
  createUser: async function(args, context) {
    var c = ctx(context);
    var existing = await first(c, 'SELECT id FROM users WHERE username = ?', args.username);
    if (existing) throw new Error('Username taken');
    if (args.email) {
      existing = await first(c, 'SELECT id FROM users WHERE email = ?', args.email);
      if (existing) throw new Error('Email already registered');
    }
    var id = genId();
    await run(c, 'INSERT INTO users (id, username, email, password, created) VALUES (?, ?, ?, ?, ?)',
      id, args.username, args.email || '', args.password, Date.now());
    return await first(c, 'SELECT id, username, email, created FROM users WHERE id = ?', id);
  },
  updateUser: async function(args, context) {
    var c = ctx(context);
    var u = await first(c, 'SELECT * FROM users WHERE id = ?', args.id);
    if (!u) throw new Error('User not found');
    var username = args.username !== undefined ? args.username : u.username;
    var email = args.email !== undefined ? args.email : u.email;
    var password = args.password !== undefined ? args.password : u.password;
    await run(c, 'UPDATE users SET username = ?, email = ?, password = ? WHERE id = ?', username, email, password, args.id);
    return await first(c, 'SELECT id, username, email, created FROM users WHERE id = ?', args.id);
  },
};

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: corsHeaders });
  }
  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers: corsHeaders });
  }
  try {
    var body = await context.request.json();
    if (!body.query) {
      return new Response(JSON.stringify({ error: 'query required' }), { status: 400, headers: corsHeaders });
    }
    var result = await graphql({
      schema,
      rootValue: root,
      source: body.query,
      variableValues: body.variables,
      contextValue: context,
    });
    return new Response(JSON.stringify(result), { status: 200, headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ errors: [{ message: e.message }] }), { status: 400, headers: corsHeaders });
  }
}
