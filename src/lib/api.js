var base = '/api';

async function req(method, path, body) {
  var res = await fetch(base + path, {
    method: method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  var text = await res.text();
  if (!text) return null;
  var data = JSON.parse(text);
  if (!res.ok) throw new Error(data.error || 'API error ' + res.status);
  return data;
}

export var API = {
  boards: {
    list: function() { return req('GET', '/boards'); },
    get: function(id) { return req('GET', '/boards/' + id); },
    create: function(data) { return req('POST', '/boards', data); },
    update: function(id, data) { return req('PUT', '/boards/' + id, data); },
    delete: function(id) { return req('DELETE', '/boards/' + id); },
  },
  pins: {
    list: function(boardId) { return req('GET', '/pins?board_id=' + encodeURIComponent(boardId)); },
    get: function(id) { return req('GET', '/pins/' + id); },
    create: function(data) { return req('POST', '/pins', data); },
    update: function(id, data) { return req('PUT', '/pins/' + id, data); },
    delete: function(id) { return req('DELETE', '/pins/' + id); },
  },
  users: {
    list: function() { return req('GET', '/users'); },
    get: function(id) { return req('GET', '/users/' + id); },
    create: function(data) { return req('POST', '/users', data); },
    update: function(id, data) { return req('PUT', '/users/' + id, data); },
  },
};
