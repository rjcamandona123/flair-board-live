export const Store = {
  read(name) { try { return JSON.parse(localStorage.getItem(name)); } catch { return null; } },
  write(name, data) { localStorage.setItem(name, JSON.stringify(data)); },
  delete(name) { localStorage.removeItem(name); },
  nextId(name) { let id = this.read(name) || 0; id++; this.write(name, id); return id; }
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
