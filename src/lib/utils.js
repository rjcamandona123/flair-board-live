export function pinColorFor(str) {
  var hash = 0;
  for (var i = 0; i < (str || '').length; i++) { hash = str.charCodeAt(i) + ((hash << 5) - hash); }
  var c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
  return '#' + '000000'.slice(c.length) + c;
}

function hexToRgb(h) { h = h.replace('#', ''); return [parseInt(h.slice(0,2), 16), parseInt(h.slice(2,4), 16), parseInt(h.slice(4,6), 16)]; }

function contrastColor(hex) { const [r, g, b] = hexToRgb(hex); return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? '#000' : '#fff'; }

export function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0; }
  const r = (hash & 0xFF) % 200, g = ((hash >> 8) & 0xFF) % 200, b = ((hash >> 16) & 0xFF) % 200;
  return '#' + r.toString(16).padStart(2,'0') + g.toString(16).padStart(2,'0') + b.toString(16).padStart(2,'0');
}

export function esc(s) { var d = document.createElement('div'); d.appendChild(document.createTextNode(s)); return d.innerHTML; }

export function escAttr(s) { return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

export function generateOTP() { return Array.from({length:6}, () => Math.floor(Math.random()*10)).join(''); }

export function generateUUID() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random()*16|0; return (c==='x'?r:(r&0x3|0x8)).toString(16); }); }

export async function sha256Hex(str) { const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)); return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join(''); }

export async function hashSalt(salt, password) { return sha256Hex(salt + ':' + password); }

export function currentRoute() { return location.hash.replace(/^#\//, '').replace(/^#/, ''); }

export { contrastColor, hexToRgb };
