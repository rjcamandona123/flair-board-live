async function gql(query, vars) {
  try {
    var res = await fetch('/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: query, variables: vars || {} }),
    });
    var text = await res.text();
    if (!text) return null;
    var data = JSON.parse(text);
    if (data.errors) return null;
    return data.data;
  } catch { return null; }
}

function syncToAPI(name, data) {
  if (!navigator.onLine) return;
  if (name === 'users' && data) {
    for (var id in data) {
      var u = data[id];
      gql('mutation($id:ID!,$username:String,$email:String,$password:String){updateUser(id:$id,username:$username,email:$email,password:$password){id}}', {
        id: id, username: u.username, email: u.email, password: u.password,
      });
    }
  } else if (name === 'boards' && data) {
    for (var id in data) {
      var b = data[id];
      gql('mutation($id:ID!,$name:String,$is_public:Boolean,$user_id:String){updateBoard(id:$id,name:$name,is_public:$is_public,user_id:$user_id){id}}', {
        id: id, name: b.name, is_public: !!b.is_public, user_id: b.user_id,
      });
    }
  } else if (name === 'pins' && data) {
    for (var id in data) {
      var p = data[id];
      gql('mutation($id:ID!,$board_id:String,$x:Float,$y:Float,$label:String,$url:String,$url_title:String,$icon:String,$color:String,$text_color:String,$image_upload:String,$visitor_id:String){updatePin(id:$id,board_id:$board_id,x:$x,y:$y,label:$label,url:$url,url_title:$url_title,icon:$icon,color:$color,text_color:$text_color,image_upload:$image_upload,visitor_id:$visitor_id){id}}', {
        id: id, board_id: p.board_id, x: p.x, y: p.y, label: p.label,
        url: p.url, url_title: p.url_title, icon: p.icon,
        color: p.color, text_color: p.text_color,
        image_upload: p.image_upload, visitor_id: p.visitor_id,
      });
    }
  }
}

function loadFromAPI(name) {
  if (!navigator.onLine) return null;
  if (name === 'boards') {
    return gql('{boards{id name user_id is_public created}}').then(function(d) { return d ? d.boards : null; });
  }
  if (name === 'users') {
    return gql('{users{id username email created}}').then(function(d) { return d ? d.users : null; });
  }
  return null;
}

export const Store = {
  read(name) {
    try { return JSON.parse(localStorage.getItem(name)); } catch { return null; }
  },
  write(name, data) {
    localStorage.setItem(name, JSON.stringify(data));
    syncToAPI(name, data);
  },
  delete(name) {
    localStorage.removeItem(name);
  },
  nextId(name) {
    var id = this.read(name) || 0;
    id++;
    this.write(name, id);
    return id;
  },
  async pull(name) {
    var remote = await loadFromAPI(name);
    if (remote && Array.isArray(remote)) {
      var map = {};
      for (var item of remote) map[item.id] = item;
      this.write(name, map);
      return map;
    }
    return this.read(name);
  },
};

export const Session = {
  _key: 'flair_session',
  _load() { try { return JSON.parse(sessionStorage.getItem(this._key)) || {}; } catch { return {}; } },
  _save(d) { sessionStorage.setItem(this._key, JSON.stringify(d)); },
  get(k) { return this._load()[k]; },
  set(k, v) { const d = this._load(); d[k] = v; this._save(d); },
  delete(k) { const d = this._load(); delete d[k]; this._save(d); },
  clear() { sessionStorage.removeItem(this._key); }
};
