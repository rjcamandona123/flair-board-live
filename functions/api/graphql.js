import { buildSchema, graphql } from 'graphql';
import { getKV, putKV, deleteKV, corsHeaders } from './lib';

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
    pins(board_id: ID!): [Pin!]!
    pin(id: ID!): Pin
    users: [User!]!
    user(id: ID!): User
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

var root = {
  boards: async function() {
    var boards = await getKV(null, 'boards') || {};
    return Object.values(boards);
  },
  board: async function(args) {
    return await getKV(null, 'board:' + args.id);
  },
  pins: async function(args) {
    var pins = await getKV(null, 'pins:' + args.board_id) || {};
    return Object.values(pins);
  },
  pin: async function(args) {
    return await getKV(null, 'pin:' + args.id);
  },
  users: async function() {
    var users = await getKV(null, 'users') || {};
    return Object.values(users).map(function(u) {
      return { id: u.id, username: u.username, email: u.email, created: u.created };
    });
  },
  user: async function(args) {
    var u = await getKV(null, 'user:' + args.id);
    if (!u) return null;
    return { id: u.id, username: u.username, email: u.email, created: u.created };
  },
  createBoard: async function(args) {
    var boards = await getKV(null, 'boards') || {};
    var id = String(Date.now()) + '-' + Math.random().toString(36).slice(2, 6);
    var board = { id: id, name: args.name, user_id: args.user_id || '', is_public: !!args.is_public, created: Date.now() };
    boards[id] = board;
    await putKV(null, 'boards', boards);
    await putKV(null, 'board:' + id, board);
    return board;
  },
  updateBoard: async function(args) {
    var board = await getKV(null, 'board:' + args.id);
    if (!board) throw new Error('Board not found');
    if (args.name !== undefined) board.name = args.name;
    if (args.is_public !== undefined) board.is_public = !!args.is_public;
    if (args.user_id !== undefined) board.user_id = args.user_id;
    var boards = await getKV(null, 'boards') || {};
    boards[args.id] = board;
    await putKV(null, 'boards', boards);
    await putKV(null, 'board:' + args.id, board);
    return board;
  },
  deleteBoard: async function(args) {
    var boards = await getKV(null, 'boards') || {};
    delete boards[args.id];
    await putKV(null, 'boards', boards);
    await deleteKV(null, 'board:' + args.id);
    var pins = await getKV(null, 'pins:' + args.id) || {};
    for (var pid in pins) await deleteKV(null, 'pin:' + pid);
    await deleteKV(null, 'pins:' + args.id);
    return true;
  },
  createPin: async function(args) {
    if (!args.board_id) throw new Error('board_id required');
    var pins = await getKV(null, 'pins:' + args.board_id) || {};
    var id = String(Date.now()) + '-' + Math.random().toString(36).slice(2, 6);
    var pin = {
      id: id, board_id: args.board_id,
      x: args.x || 200, y: args.y || 200,
      label: args.label || '', url: args.url || '', url_title: args.url_title || '',
      icon: args.icon || '', color: args.color || '#cc3333', text_color: args.text_color || '#ffffff',
      image_upload: args.image_upload || '', visitor_id: args.visitor_id || '', created: Date.now(),
    };
    pins[id] = pin;
    await putKV(null, 'pins:' + args.board_id, pins);
    await putKV(null, 'pin:' + id, pin);
    return pin;
  },
  updatePin: async function(args) {
    var pin = await getKV(null, 'pin:' + args.id);
    if (!pin) throw new Error('Pin not found');
    var fields = ['board_id', 'x', 'y', 'label', 'url', 'url_title', 'icon', 'color', 'text_color', 'image_upload', 'visitor_id'];
    for (var f of fields) {
      if (args[f] !== undefined) pin[f] = args[f];
    }
    var pins = await getKV(null, 'pins:' + pin.board_id) || {};
    pins[args.id] = pin;
    await putKV(null, 'pins:' + pin.board_id, pins);
    await putKV(null, 'pin:' + args.id, pin);
    return pin;
  },
  deletePin: async function(args) {
    var pin = await getKV(null, 'pin:' + args.id);
    if (!pin) throw new Error('Pin not found');
    var pins = await getKV(null, 'pins:' + pin.board_id) || {};
    delete pins[args.id];
    await putKV(null, 'pins:' + pin.board_id, pins);
    await deleteKV(null, 'pin:' + args.id);
    return true;
  },
  createUser: async function(args) {
    if (!args.username || !args.password) throw new Error('Username and password required');
    var users = await getKV(null, 'users') || {};
    for (var k in users) {
      if (users[k].username === args.username) throw new Error('Username taken');
      if (users[k].email === args.email) throw new Error('Email already registered');
    }
    var id = String(Date.now()) + '-' + Math.random().toString(36).slice(2, 6);
    var user = { id: id, username: args.username, email: args.email || '', password: args.password, created: Date.now() };
    users[id] = user;
    await putKV(null, 'users', users);
    await putKV(null, 'user:' + id, user);
    return { id: user.id, username: user.username, email: user.email, created: user.created };
  },
  updateUser: async function(args) {
    var user = await getKV(null, 'user:' + args.id);
    if (!user) throw new Error('User not found');
    if (args.username !== undefined) user.username = args.username;
    if (args.email !== undefined) user.email = args.email;
    if (args.password !== undefined) user.password = args.password;
    var users = await getKV(null, 'users') || {};
    users[args.id] = user;
    await putKV(null, 'users', users);
    await putKV(null, 'user:' + args.id, user);
    return { id: user.id, username: user.username, email: user.email, created: user.created };
  },
};

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: corsHeaders });
  }
  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), {
      status: 405, headers: corsHeaders,
    });
  }
  try {
    var body = await context.request.json();
    if (!body.query) {
      return new Response(JSON.stringify({ error: 'query required' }), {
        status: 400, headers: corsHeaders,
      });
    }
    var result = await graphql({ schema, rootValue: root, source: body.query, variableValues: body.variables });
    return new Response(JSON.stringify(result), {
      status: 200, headers: corsHeaders,
    });
  } catch (e) {
    return new Response(JSON.stringify({ errors: [{ message: e.message }] }), {
      status: 400, headers: corsHeaders,
    });
  }
}
