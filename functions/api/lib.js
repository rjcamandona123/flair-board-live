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

export function handleOptions() {
  return new Response('', { status: 204, headers: corsHeaders });
}

export function error(msg, status) {
  return json({ error: msg }, status || 400);
}

var inMemory = {};

export async function getKV(context, key) {
  var kv = context.env && context.env.FLAIR_KV;
  if (kv) {
    var val = await kv.get(key);
    return val ? JSON.parse(val) : null;
  }
  return inMemory[key] || null;
}

export async function putKV(context, key, data) {
  var kv = context.env && context.env.FLAIR_KV;
  if (kv) {
    await kv.put(key, JSON.stringify(data));
  } else {
    inMemory[key] = data;
  }
}

export async function deleteKV(context, key) {
  var kv = context.env && context.env.FLAIR_KV;
  if (kv) {
    await kv.delete(key);
  } else {
    delete inMemory[key];
  }
}

export async function listKV(context, prefix) {
  var kv = context.env && context.env.FLAIR_KV;
  if (kv) {
    var result = await kv.list({ prefix: prefix });
    var items = [];
    for (var key of result.keys) {
      var val = await kv.get(key.name);
      if (val) items.push(JSON.parse(val));
    }
    return items;
  }
  var items = [];
  for (var key in inMemory) {
    if (key.startsWith(prefix)) items.push(inMemory[key]);
  }
  return items;
}
