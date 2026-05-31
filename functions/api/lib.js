var corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

export function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: corsHeaders,
  });
}

export function error(msg, status) {
  return json({ error: msg }, status || 400);
}

function db(context) {
  var d1 = context.env && context.env.FLAIR_DB;
  if (d1) return d1;
  return null;
}

var mem = { boards: {}, pins: {}, users: {} };
var memId = 0;

export async function query(context, sql, ...params) {
  var d = db(context);
  if (d) {
    var stmt = d.prepare(sql);
    if (params.length) stmt = stmt.bind(...params);
    var result = await stmt.all();
    return result.results || [];
  }
  return memQuery(sql, params);
}

export async function run(context, sql, ...params) {
  var d = db(context);
  if (d) {
    var stmt = d.prepare(sql);
    if (params.length) stmt = stmt.bind(...params);
    var result = await stmt.run();
    return result;
  }
  return memRun(sql, params);
}

export async function first(context, sql, ...params) {
  var rows = await query(context, sql, ...params);
  return rows.length ? rows[0] : null;
}

export function genId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function memQuery(sql, params) {
  var table = parseTable(sql);
  if (!table) return [];
  var data = Object.values(mem[table]);
  var where = parseWhere(sql, params);
  if (where) data = data.filter(where);
  var order = parseOrder(sql);
  if (order) data.sort(order);
  return data;
}

function memRun(sql, params) {
  var lower = sql.toLowerCase().trim();
  if (lower.startsWith('insert')) return memInsert(sql, params);
  if (lower.startsWith('update')) return memUpdate(sql, params);
  if (lower.startsWith('delete')) return memDelete(sql, params);
  return {};
}

function memInsert(sql, params) {
  var m = sql.match(/INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
  if (!m) return {};
  var table = m[1];
  var cols = m[2].split(',').map(function(c) { return c.trim().toLowerCase(); });
  var row = {};
  for (var i = 0; i < cols.length; i++) row[cols[i]] = params[i];
  mem[table][row.id] = row;
  return {};
}

function memUpdate(sql, params) {
  var m = sql.match(/UPDATE\s+(\w+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/i);
  if (!m) return {};
  var table = m[1], setClause = m[2], whereClause = m[3];
  var setPairs = setClause.split(',').map(function(s) {
    var parts = s.split('=').map(function(p) { return p.trim(); });
    return { col: parts[0].replace(/"/g, '').toLowerCase(), val: parts[1] };
  });
  var paramIdx = 0;
  var rows = Object.values(mem[table]);
  for (var row of rows) {
    if (whereClause && !simpleMatch(whereClause, row, params, paramIdx)) {
      paramIdx += countParams(whereClause);
      continue;
    }
    for (var pair of setPairs) {
      var v = pair.val;
      if (v === '?') { row[pair.col] = params[paramIdx++]; }
      else if (v === '?1' || v === '?2' || v === '?3') { paramIdx++; }
      else { row[pair.col] = eval(v); }
    }
    if (whereClause) paramIdx += countParams(whereClause);
  }
  return {};
}

function memDelete(sql, params) {
  var m = sql.match(/DELETE\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+))?$/i);
  if (!m) return {};
  var table = m[1], whereClause = m[2];
  if (!whereClause) { mem[table] = {}; return {}; }
  var toDelete = [];
  var paramIdx = 0;
  for (var id in mem[table]) {
    if (simpleMatch(whereClause, mem[table][id], params, paramIdx)) toDelete.push(id);
    paramIdx += countParams(whereClause);
  }
  for (var did of toDelete) delete mem[table][did];
  return {};
}

function parseTable(sql) {
  var m = sql.match(/\bFROM\s+(\w+)/i);
  if (m) return m[1];
  m = sql.match(/\bINTO\s+(\w+)/i);
  if (m) return m[1];
  m = sql.match(/\bUPDATE\s+(\w+)/i);
  if (m) return m[1];
  return null;
}

function parseWhere(sql, params) {
  var m = sql.match(/\bWHERE\s+(.+?)(?:\s+ORDER\s+|\s+LIMIT\s+|$)/i);
  if (!m) return null;
  var clause = m[1];
  return function(row) { return simpleMatch(clause, row, params, 0); };
}

function parseOrder(sql) {
  var m = sql.match(/\bORDER\s+BY\s+(\w+)\s+(ASC|DESC)?/i);
  if (!m) return null;
  var col = m[1].toLowerCase(), dir = (m[2] || 'ASC').toUpperCase();
  if (dir === 'ASC') return function(a, b) { return (a[col] || '') > (b[col] || '') ? 1 : -1; };
  return function(a, b) { return (a[col] || '') < (b[col] || '') ? 1 : -1; };
}

function simpleMatch(clause, row, params, startIdx) {
  var parts = clause.split(/\s+AND\s+/i);
  for (var p of parts) {
    var eq = p.match(/(\w+)\s*=\s*(\?|'.*?'|".*?"|null)/);
    if (eq) {
      var col = eq[1].toLowerCase();
      var val = eq[2];
      if (val === '?') val = params[startIdx++];
      else if (val.startsWith("'") || val.startsWith('"')) val = val.slice(1, -1);
      if (String(row[col]) !== String(val)) return false;
    }
    var neq = p.match(/(\w+)\s*(!=|<>)\s*(\?)/);
    if (neq) {
      var col = neq[1].toLowerCase();
      var val = params[startIdx++];
      if (String(row[col]) === String(val)) return false;
    }
  }
  return true;
}

function countParams(clause) {
  return (clause.match(/\?/g) || []).length;
}
