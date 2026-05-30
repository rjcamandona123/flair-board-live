import { createSignal, createEffect, createRoot, Switch, Match } from 'solid-js';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import VerifyPage from './pages/VerifyPage';
import SetupPage from './pages/SetupPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

import { Store, Session } from './lib/store';
import { esc, escAttr, generateOTP, generateUUID, sha256Hex, hashSalt, currentRoute, stringToColor, pinColorFor, contrastColor, hexToRgb } from './lib/utils';
import { sendOTPEmail } from './lib/email';

// ============================================================
// Data helpers
// ============================================================
function getUser() { var uid = Session.get('user_id'); if (!uid) return null; var users = Store.read('users'); return users && users[uid] ? users[uid] : null; }
function getBoards(uid) { var boards = Store.read('boards') || {}; return Object.values(boards).filter(function(b) { return b.user_id === uid; }); }
function getPins(boardId) { var pins = Store.read('pins') || {}; return Object.values(pins).filter(function(p) { return String(p.board_id) === String(boardId); }); }
function uid() { return Session.get('user_id'); }

var cursorMode = 'drag';

// ============================================================
// Actions
// ============================================================
async function actionLogin(form) {
  var data = Object.fromEntries(new FormData(form));
  var login = (data.login || '').trim();
  var password = data.password || '';
  if (!login || !password) return setCurrentPage('login');
  var users = Store.read('users') || {};
  var found = null, foundId = null;
  for (var key in users) {
    var u = users[key];
    if (u.username === login || u.email === login) { found = u; foundId = key; break; }
  }
  if (!found) { setCurrentPage('login'); return; }
  var stored = found.password || '';
  if (stored.includes(':')) {
    var parts = stored.split(':');
    var salt = parts[0], expected = parts[1];
    var actual = await hashSalt(salt, password);
    if (expected !== actual) { setCurrentPage('login'); return; }
  } else if (stored !== password) { setCurrentPage('login'); return; }
  Session.set('user_id', foundId);
  navigate('?route=uploads');
}

async function actionRegisterEmail(form) {
  var data = Object.fromEntries(new FormData(form));
  var email = (data.email || '').trim().toLowerCase();
  if (!email) return;
  var otp = generateOTP();
  Session.set('reg_email', email);
  Session.set('reg_otp', await sha256Hex(otp));
  Session.set('reg_otp_expires', Date.now() + 600000);
  var result = await sendOTPEmail(email, otp);
  if (!result.ok) return renderPage('signup', { err: result.error });
  renderPage('verify', { email: email, success: 'Verification code sent to ' + email });
}

async function actionSendOTP(form) {
  var data = Object.fromEntries(new FormData(form));
  var email = (data.email || '').trim().toLowerCase() || Session.get('reg_email') || Session.get('reset_email') || '';
  if (!email) return;
  var otp = generateOTP();
  var hash = await sha256Hex(otp);
  Session.set('reg_otp', hash);
  Session.set('reg_otp_expires', Date.now() + 600000);
  Session.set('reg_email', email);
  Session.set('reset_otp', hash);
  Session.set('reset_otp_expires', Date.now() + 600000);
  var result = await sendOTPEmail(email, otp);
  if (!result.ok) return renderPage('verify', { email: email, error: result.error });
  var route = currentRoute();
  if (route.includes('reset')) renderPage('reset_password_setup', { email: email, otp: otp, success: 'Code resent to ' + email });
  else renderPage('verify', { email: email, otp: otp, success: 'Code resent to ' + email });
}

async function actionVerifyOTP(form) {
  var data = Object.fromEntries(new FormData(form));
  var code = (data.otp || '').trim();
  var email = (data.email || '').trim().toLowerCase() || Session.get('reg_email') || '';
  var storedHash = Session.get('reg_otp');
  var expires = Session.get('reg_otp_expires');
  if (!storedHash) return renderPage('verify', { email: email, error: 'No code sent. Please request a new one.' });
  if (expires && Date.now() > expires) return renderPage('verify', { email: email, error: 'Code expired. Please request a new one.' });
  if ((await sha256Hex(code)) !== storedHash) return renderPage('verify', { email: email, error: 'Invalid code' });
  Session.set('reg_verified', true);
  Session.delete('reg_otp');
  navigate('?route=setup');
}

async function actionCompleteRegistration(form) {
  var data = Object.fromEntries(new FormData(form));
  var username = (data.username || '').trim();
  var password = data.password || '';
  if (!username || !password) return renderPage('setup', { err: 'Username and password required' });
  if (username.length < 2) return renderPage('setup', { err: 'Username must be at least 2 characters' });
  if (password.length < 4) return renderPage('setup', { err: 'Password must be at least 4 characters' });
  var email = Session.get('reg_email');
  var verified = Session.get('reg_verified');
  if (!email || !verified) return navigate('?route=login');
  var users = Store.read('users') || {};
  for (var key in users) {
    var u = users[key];
    if (u.username === username) return renderPage('setup', { err: 'Username already taken' });
    if (u.email === email) return renderPage('setup', { err: 'Email already registered' });
  }
  var id = String(Store.nextId('next_user_id'));
  var salt = generateUUID();
  users[id] = { id: id, email: email, username: username, password: salt + ':' + await hashSalt(salt, password), email_verified: true };
  Store.write('users', users);
  Session.delete('reg_email'); Session.delete('reg_otp'); Session.delete('reg_verified');
  Session.set('user_id', id);
  navigate('?route=uploads');
}

async function actionForgotPassword(form) {
  var data = Object.fromEntries(new FormData(form));
  var email = (data.email || '').trim().toLowerCase();
  if (!email) return;
  var users = Store.read('users') || {};
  var found = false;
  for (var key in users) { if (users[key].email === email) { found = true; break; } }
  var otp = generateOTP();
  Session.set('reset_email', email);
  Session.set('reset_otp', await sha256Hex(otp));
  Session.set('reset_otp_expires', Date.now() + 600000);
  var result = await sendOTPEmail(email, otp, 'Your password reset code');
  if (!result.ok) return renderPage('forgot_password', { err: result.error });
  if (found) renderPage('reset_password_setup', { email: email, success: 'Reset code sent to ' + email });
  else renderPage('forgot_password', { err: 'If that email exists, a reset code has been sent' });
}

async function actionResetPassword(form) {
  var data = Object.fromEntries(new FormData(form));
  var email = (data.email || '').trim().toLowerCase() || Session.get('reset_email') || '';
  var code = (data.otp || '').trim();
  var password = data.password || '';
  var storedHash = Session.get('reset_otp');
  var expires = Session.get('reset_otp_expires');
  if (!storedHash) return renderPage('reset_password_setup', { email: email, error: 'No code sent' });
  if (expires && Date.now() > expires) return renderPage('reset_password_setup', { email: email, error: 'Code expired' });
  if ((await sha256Hex(code)) !== storedHash) return renderPage('reset_password_setup', { email: email, error: 'Invalid code' });
  if (password.length < 4) return renderPage('reset_password_setup', { email: email, error: 'Password too short' });
  var users = Store.read('users') || {};
  for (var key in users) {
    if (users[key].email === email) {
      var salt = generateUUID();
      users[key].password = salt + ':' + await hashSalt(salt, password);
      Store.write('users', users);
      break;
    }
  }
  Session.delete('reset_otp'); Session.delete('reset_otp_expires');
  navigate('?route=login');
}

async function actionCreateBoard(form) {
  var data = Object.fromEntries(new FormData(form));
  var name = (data.name || '').trim() || 'Untitled';
  var u = uid();
  if (!u) return navigate('?route=login');
  var id = String(Store.nextId('next_board_id'));
  var boards = Store.read('boards') || {};
  boards[id] = { id: id, user_id: u, name: name, is_public: 0, pin_count: 0 };
  Store.write('boards', boards);
  navigate('?route=board/' + id);
}

async function actionDeleteBoard(el) {
  var bid = el && el.dataset ? el.dataset.boardId : null;
  if (!bid) return;
  var boards = Store.read('boards') || {};
  delete boards[bid];
  Store.write('boards', boards);
  var pins = Store.read('pins') || {};
  for (var key in pins) { if (String(pins[key].board_id) === String(bid)) delete pins[key]; }
  try { Store.write('pins', pins); } catch(e) { /* quota exceeded on delete - can safely ignore */ }
  navigate('?route=uploads');
}

async function actionTogglePublic(el) {
  var bid = el && el.dataset ? el.dataset.boardId : null;
  if (!bid) return;
  var boards = Store.read('boards') || {};
  if (!boards[bid]) return;
  boards[bid].is_public = boards[bid].is_public ? 0 : 1;
  Store.write('boards', boards);
  var pageEl = document.querySelector('.board-page') || document.querySelector('.uploads-page');
  if (pageEl) {
    var container = pageEl.parentElement;
    if (currentRoute() === 'uploads') renderUploadsPage(container);
    else renderBoardPage(container);
  }
}

async function actionAddPin(form) {
  var data = Object.fromEntries(new FormData(form));
  var bid = data.board_id;
  var x = parseInt(data.x) || 400;
  var y = parseInt(data.y) || 250;
  var url = (data.url || '').trim();
  var label = (data.label || '').trim();
  var image = data.image;
  var imageUpload = '';
  var imageFile = image instanceof File ? image : null;
  if (imageFile) {
    image = await new Promise(function(resolve) {
      var r = new FileReader();
      r.onload = function(e) {
        var img = new Image();
        img.onload = function() {
          var maxDim = 200;
          var w = img.width, h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) { h = h * maxDim / w; w = maxDim; } else { w = w * maxDim / h; h = maxDim; }
          }
          var canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = e.target.result;
      };
      r.readAsDataURL(imageFile);
    });
    imageUpload = image;
  }
  if (!bid || (!url && !label && !image)) return;
  var id = String(Store.nextId('next_pin_id'));
  var domain, icon, color, tColor;
  var urlTitle = '';
  if (url) {
    try { domain = new URL(url).hostname; } catch(e) { domain = url; }
    try { var fr = await fetch('/favicon-resolver?url=' + encodeURIComponent(url)); var fj = await fr.json(); icon = fj.favicon || ('https://icons.duckduckgo.com/ip3/' + domain + '.ico'); urlTitle = fj.title || ''; if (!label) label = urlTitle || domain.replace(/^www\./, ''); } catch(e) { icon = 'https://icons.duckduckgo.com/ip3/' + domain + '.ico'; if (!label) label = domain.replace(/^www\./, ''); }
    color = pinColorFor(domain);
  } else if (image) {
    icon = image;
    color = pinColorFor(label || image);
  }
  else { icon = label[0] || '?'; color = pinColorFor(label); imageUpload = ''; }
  tColor = contrastColor(color);
  if (data.color && /^#[0-9a-f]{6}$/i.test(data.color)) { color = data.color; tColor = data.text_color && /^#[0-9a-f]{6}$/i.test(data.text_color) ? data.text_color : contrastColor(data.color); }
  var visitorId = Session.get('visitor_id');
  var route = currentRoute();
  var isPublicPage = route.indexOf('public') === 0;
  var pins = Store.read('pins') || {};
  pins[id] = { id: id, board_id: bid, x: x, y: y, label: label, url: url, url_title: urlTitle, color: color, text_color: tColor, icon: icon, image_upload: imageUpload };
  if (isPublicPage && visitorId) pins[id].visitor_id = visitorId;
  Store.write('pins', pins);
  var boards = Store.read('boards') || {};
  if (boards[bid]) { boards[bid].pin_count = Object.values(pins).filter(function(p) { return String(p.board_id) === String(bid); }).length; Store.write('boards', boards); }
  addPinToDOM(bid, id, x, y, url, label, label, color, tColor, icon, isPublicPage, visitorId, imageUpload, urlTitle);
  form.reset();
  if (!isPublicPage) { var fp = document.getElementById('flair-picker'); if (fp) fp.classList.add('hidden'); }
}

function addPinToDOM(bid, pid, x, y, url, text, label, color, tColor, icon, isPublic, visitorId, imageUpload, urlTitle) {
  var svg = document.getElementById(isPublic ? 'public-flair-board' : 'flair-board');
  if (!svg) return;
  var defs = svg.querySelector('defs');
  if (!defs) return;
  var gid = 'pg-' + pid;
  var r = parseInt(color.slice(1,3),16), g = parseInt(color.slice(3,5),16), b = parseInt(color.slice(5,7),16);
  var ns = 'http://www.w3.org/2000/svg';
  var grad = document.createElementNS(ns, 'radialGradient');
  grad.setAttribute('id', gid); grad.setAttribute('cx','35%'); grad.setAttribute('cy','35%'); grad.setAttribute('r','60%');
  var s1 = document.createElementNS(ns, 'stop'); s1.setAttribute('offset','0%'); s1.setAttribute('stop-color','#fff'); s1.setAttribute('stop-opacity','0.6');
  var s2 = document.createElementNS(ns, 'stop'); s2.setAttribute('offset','25%'); s2.setAttribute('stop-color','rgb('+r+','+g+','+b+')');
  var s3 = document.createElementNS(ns, 'stop'); s3.setAttribute('offset','80%'); s3.setAttribute('stop-color','rgb('+(r*0.6|0)+','+(g*0.6|0)+','+(b*0.6|0)+')');
  var s4 = document.createElementNS(ns, 'stop'); s4.setAttribute('offset','100%'); s4.setAttribute('stop-color','rgb('+(r*0.4|0)+','+(g*0.4|0)+','+(b*0.4|0)+')');
  grad.appendChild(s1); grad.appendChild(s2); grad.appendChild(s3); grad.appendChild(s4); defs.appendChild(grad);
  var isFavicon = (icon || '').indexOf('http') === 0 || (icon || '').indexOf('data:') === 0;
  var pinUrl = url || '';
  var g = document.createElementNS(ns, 'g');
  var isOwner = !isPublic || (visitorId && visitorId === (visitorId));
  g.setAttribute('class', 'draggable-pin');
  if (isPublic) g.setAttribute('data-visitor-id', visitorId || '');
  g.setAttribute('filter', 'url(#cork-shadow)'); g.setAttribute('cursor', 'pointer');
  g.setAttribute('data-pin-id', pid); g.setAttribute('data-board-id', bid);
  g.setAttribute('data-color', color); g.setAttribute('data-text-color', tColor);
  g.setAttribute('data-url', pinUrl); g.setAttribute('data-label', label || '');
  g.setAttribute('data-text', text || ''); g.setAttribute('data-icon', icon || ''); g.setAttribute('data-image-upload', imageUpload || ''); g.setAttribute('data-url-title', urlTitle || '');
  var c = document.createElementNS(ns, 'circle');
  c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', '24'); c.setAttribute('fill', 'url(#'+gid+')');
  var e = document.createElementNS(ns, 'ellipse');
  e.setAttribute('cx', x-6); e.setAttribute('cy', y-8); e.setAttribute('rx', '8'); e.setAttribute('ry', '6');
  e.setAttribute('fill', '#fff'); e.setAttribute('opacity', '0.4');
  g.appendChild(c); g.appendChild(e);
  if (isFavicon) {
    var im = document.createElementNS(ns, 'image');
    im.setAttribute('href', icon); im.setAttribute('x', x-12); im.setAttribute('y', y-12);
    im.setAttribute('width', '24'); im.setAttribute('height', '24');
    im.setAttribute('style', 'image-rendering:auto'); im.setAttribute('pointer-events', 'none');
    g.appendChild(im);
  } else {
    var t = document.createElementNS(ns, 'text');
    t.setAttribute('x', x); t.setAttribute('y', y+4);
    t.setAttribute('text-anchor', 'middle'); t.setAttribute('dominant-baseline', 'central');
    t.setAttribute('font-size', '18'); t.setAttribute('fill', tColor);
    t.setAttribute('pointer-events', 'none');
    t.textContent = icon || (label || '?')[0];
    g.appendChild(t);
  }
  svg.appendChild(g);
  var tbody = document.querySelector('.pin-list table tbody');
  if (tbody) {
    var tr = document.createElement('tr');
    tr.setAttribute('data-pin-id', pid);
    tr.innerHTML = '<td>' + (isFavicon ? '<img src="' + escAttr(icon) + '" style="width:24px;height:24px;vertical-align:middle" alt="">' : '<span class="pin-icon">' + esc(icon || '📍') + '</span>') + '</td><td>' + esc(label || text || '(no text)') + '</td><td class="pos-display">X: ' + x + ' Y: ' + y + '</td><td><input type="color" class="table-color-picker" value="' + color + '" data-pin-id="' + pid + '" data-board-id="' + bid + '" title="Pin color"></td><td><input type="color" class="table-text-color-picker" value="' + tColor + '" data-pin-id="' + pid + '" data-board-id="' + bid + '" title="Text color"></td><td><button class="btn-delete" data-action="delete_pin" data-pin-id="' + pid + '" data-board-id="' + bid + '">🗑️</button></td>';
    tbody.appendChild(tr);
    var details = tbody.closest('details');
    if (details) details.open = true;
    var summary = tbody.closest('.pin-list').querySelector('.embed-summary');
    if (summary) summary.textContent = '📋 Pin List (' + document.querySelectorAll('.pin-list table tbody tr').length + ')';
  }
}

async function actionDeletePin(target) {
  var pid = target && target.dataset ? target.dataset.pinId : null;
  var bid = target && target.dataset ? target.dataset.boardId : null;
  if (!pid) return;
  var pins = Store.read('pins') || {};
  delete pins[pid];
  try { Store.write('pins', pins); } catch(e) { /* quota exceeded on delete - can safely ignore */ }
  if (bid) {
    var boards = Store.read('boards') || {};
    if (boards[bid]) { boards[bid].pin_count = Object.values(pins).filter(function(p) { return String(p.board_id) === String(bid); }).length; Store.write('boards', boards); }
  }
  var pinEl = document.querySelector('.draggable-pin[data-pin-id="' + pid + '"]');
  if (pinEl) pinEl.remove();
  var tr = document.querySelector('.pin-list tr[data-pin-id="' + pid + '"]');
  if (tr) tr.remove();
  var countEl = document.querySelector('.pin-list .embed-summary');
  if (countEl) { var rows = document.querySelectorAll('.pin-list table tbody tr').length; countEl.textContent = rows > 0 ? '📋 Pin List (' + rows + ')' : '📋 Pin List (0)'; }
  if (!document.querySelectorAll('.pin-list table tbody tr').length) { var details = document.querySelector('.pin-list details'); if (details) details.open = false; }
}

function actionMovePin(data) {
  var pid = data.id, bid = data.board_id, x = data.x, y = data.y, color = data.color, text_color = data.text_color;
  if (!pid) return;
  var pins = Store.read('pins') || {};
  if (pins[pid]) {
    if (x) pins[pid].x = parseInt(x);
    if (y) pins[pid].y = parseInt(y);
    if (color) pins[pid].color = color;
    if (text_color) pins[pid].text_color = text_color;
  try { Store.write('pins', pins); } catch(e) { alert('Storage full: ' + e.message); return; }
  }
}

function actionLogout() { Session.clear(); setPageProps({}); setCurrentPage('login'); navigate('?route=login'); }

// ============================================================
// Routing
// ============================================================
var ROUTES = {
  '': 'uploads', 'login': 'login', 'signup': 'signup', 'verify': 'verify',
  'setup': 'setup', 'forgot-password': 'forgot_password', 'reset-password-setup': 'reset_password_setup',
  'uploads': 'uploads'
};

function navigate(href) { history.pushState(null, '', href); handleRoute(); }

// ============================================================
// Signals
// ============================================================
var [currentPageSig, setCurrentPage] = createRoot(function() { return createSignal(null); });
var [pagePropsSig, setPageProps] = createRoot(function() { return createSignal({}); });

function renderPage(page, props) {
  setPageProps(props || {});
  setCurrentPage(page);
}

function handleRoute() {
  setPageProps({});
  var route = currentRoute();
  var parts = route.split('/');
  var base = parts[0];
  if (base === 'logout') { Session.clear(); setPageProps({}); setCurrentPage('login'); navigate('?route=login'); return; }
  var u = uid();
  var guarded = ['', 'uploads', 'board', 'public'];
  var pub = ['login', 'signup', 'verify', 'setup', 'forgot-password', 'reset-password-setup'];
  if (guarded.includes(base) && !u && !pub.includes(base)) { navigate('?route=login'); return; }
  if (ROUTES[route] !== undefined) {
    var page = ROUTES[route];
    if (page === 'login' && u) { navigate('?route=uploads'); return; }
    setCurrentPage(page);
  } else {
    setCurrentPage(route);
  }
}

window.addEventListener('popstate', function() { handleRoute(); });

handleRoute();

// ============================================================
// SVG Board interaction
// ============================================================
function bindBoardSVGs() {
  var svg = document.getElementById('flair-board');
  if (svg) { initBoardSVG(svg, false); }
  svg = document.getElementById('public-flair-board');
  if (svg) { initBoardSVG(svg, true); }
  var pins = document.querySelectorAll('.draggable-pin');
  for (var pi = 0; pi < pins.length; pi++) {
    pins[pi].style.cursor = cursorMode === 'click' ? 'pointer' : '';
  }
  var svgEl = document.getElementById('flair-board') || document.getElementById('public-flair-board');
  if (svgEl) svgEl.style.cursor = cursorMode === 'click' ? 'default' : '';
  var toggle = document.getElementById('cursor-mode-toggle');
  if (toggle) {
    toggle.addEventListener('click', function() {
      cursorMode = cursorMode === 'click' ? 'drag' : 'click';
      toggle.textContent = cursorMode === 'click' ? 'Click' : 'Drag';
      var boards = document.querySelectorAll('.draggable-pin');
      for (var i = 0; i < boards.length; i++) {
        boards[i].style.cursor = cursorMode === 'click' ? 'pointer' : '';
      }
      var svgEl = document.getElementById('flair-board') || document.getElementById('public-flair-board');
      if (svgEl) svgEl.style.cursor = cursorMode === 'click' ? 'default' : '';
    });
  }
}

function initBoardSVG(svg, isPublic) {
  var dragging = null, offsetX = 0, offsetY = 0, wasDragged = false;
  var tooltipUrl = document.getElementById('pin-tooltip-url');
  var tooltipText = document.getElementById('pin-tooltip-text');
  var colorInput = document.getElementById('pin-color-picker');
  var longPressTimer = null;

  function scale(e) {
    var r = svg.getBoundingClientRect();
    var t = e.touches ? e.touches[0] : e;
    return { x: (t.clientX - r.left) * 800 / r.width, y: (t.clientY - r.top) * 500 / r.height };
  }
  function clamp(v) { return Math.max(24, Math.min(776, v)); }
  function clampY(v) { return Math.max(24, Math.min(476, v)); }

  function updatePinPos(pin, x, y) {
    var c = pin.querySelector('circle'), e = pin.querySelector('ellipse');
    var im = pin.querySelector('image'), t = pin.querySelector('text');
    if (c) { c.setAttribute('cx', x); c.setAttribute('cy', y); }
    if (e) { e.setAttribute('cx', x - 6); e.setAttribute('cy', y - 8); }
    if (im) { im.setAttribute('x', x - 12); im.setAttribute('y', y - 12); }
    if (t) { t.setAttribute('x', x); t.setAttribute('y', y + 4); }
    var pid = pin.getAttribute('data-pin-id');
    if (pid) {
      var tr = document.querySelector('.pin-list tr[data-pin-id="' + pid + '"]');
      if (tr) {
        var posTd = tr.querySelector('.pos-display');
        if (posTd) posTd.textContent = 'X: ' + Math.round(x) + ' Y: ' + Math.round(y);
      }
    }
  }

  var dragPosEl = document.createElement('div');
  dragPosEl.style.cssText = 'position:absolute;background:rgba(0,0,0,0.75);color:#fff;padding:4px 8px;border-radius:4px;font-size:12px;font-family:sans-serif;pointer-events:none;z-index:999;display:none';
  svg.parentElement.appendChild(dragPosEl);

  function startDrag(el, cx, cy) {
    var circle = el.querySelector('circle');
    if (!circle) return false;
    dragging = { el: el, cx: parseFloat(circle.getAttribute('cx')), cy: parseFloat(circle.getAttribute('cy')) };
    wasDragged = false;
    offsetX = cx - dragging.cx;
    offsetY = cy - dragging.cy;
    svg.style.cursor = 'grabbing';
    dragPosEl.style.display = '';
    dragPosEl.textContent = 'X: ' + Math.round(dragging.cx) + ' Y: ' + Math.round(dragging.cy);
    return true;
  }

  function moveDrag(cx, cy) {
    if (!dragging) return;
    wasDragged = true;
    var nx = clamp(cx - offsetX), ny = clampY(cy - offsetY);
    updatePinPos(dragging.el, nx, ny);
    var cont = svg.parentElement, cr = cont.getBoundingClientRect();
    dragPosEl.style.left = (nx * cr.width / 800 + cr.left - cont.getBoundingClientRect().left + 16) + 'px';
    dragPosEl.style.top = (ny * cr.height / 500 + cr.top - cont.getBoundingClientRect().top - 30) + 'px';
    dragPosEl.textContent = 'X: ' + Math.round(nx) + ' Y: ' + Math.round(ny);
  }

  function endDrag() {
    if (!dragging) return;
    svg.style.cursor = '';
    var c = dragging.el.querySelector('circle');
    if (c) {
      var nx = parseFloat(c.getAttribute('cx')), ny = parseFloat(c.getAttribute('cy'));
      var pinId = dragging.el.getAttribute('data-pin-id'), boardId = dragging.el.getAttribute('data-board-id');
      var textColor = dragging.el.getAttribute('data-text-color') || '#ffffff';
      actionMovePin({ id: pinId, board_id: boardId, x: String(nx), y: String(ny), text_color: textColor });
      var iframes = document.querySelectorAll('iframe[src*="/public/"]');
      for (var i = 0; i < iframes.length; i++) { try { iframes[i].contentWindow.postMessage({ type: 'pin-update', pinId: pinId, x: nx, y: ny, textColor: textColor }, '*'); } catch(_) {} }
    }
    if (dragPosEl) dragPosEl.style.display = 'none';
    dragging = null;
  }

  function canModify(el) { return !el.classList.contains('read-only-pin'); }

  svg.addEventListener('mousedown', function(e) {
    var target = e.target.closest('.draggable-pin');
    if (!target || !canModify(target)) return;
    if (cursorMode === 'click') return;
    e.preventDefault();
    var s = scale(e);
    startDrag(target, s.x, s.y);
  });
  svg.addEventListener('mousemove', function(e) {
    if (!dragging) return;
    var s = scale(e);
    moveDrag(s.x, s.y);
  });
  svg.addEventListener('mouseup', endDrag);
  svg.addEventListener('mouseleave', function() { if (dragging) { svg.style.cursor = ''; dragging = null; } });

  function showTooltipUrl(iconUrl, bg, tc, cx, cy, imageUpload) {
    if (!tooltipUrl) return;
    var img = tooltipUrl.querySelector('.tooltip-img');
    if (img) {
      if (iconUrl && (iconUrl.indexOf('http') === 0 || iconUrl.indexOf('data:') === 0)) {
        img.src = iconUrl; img.style.display = '';
      } else { img.style.display = 'none'; }
    }
    var imgUp = tooltipUrl.querySelector('.tooltip-img-upload');
    if (imgUp) {
      if (imageUpload && imageUpload.indexOf('data:') === 0 && imageUpload !== iconUrl) {
        imgUp.src = imageUpload; imgUp.style.display = '';
      } else { imgUp.style.display = 'none'; }
    }
    tooltipUrl.style.background = bg; tooltipUrl.style.color = tc; tooltipUrl.style.border = '1px solid ' + tc;
    tooltipUrl.classList.remove('hidden');
    var cont = svg.parentElement, cr = cont.getBoundingClientRect();
    tooltipUrl.style.left = (cx + 16) + 'px'; tooltipUrl.style.top = (cy - 60) + 'px';
  }
  function showTooltipText(text, bg, tc, cx, cy) {
    if (!tooltipText) return;
    tooltipText.textContent = text;
    tooltipText.style.background = bg; tooltipText.style.color = tc; tooltipText.style.border = '1px solid ' + tc;
    tooltipText.classList.remove('hidden');
    tooltipText.style.left = (cx + 16) + 'px'; tooltipText.style.top = (cy - 10) + 'px';
  }
  function hideTooltips() {
    if (tooltipUrl) tooltipUrl.classList.add('hidden');
    if (tooltipText) tooltipText.classList.add('hidden');
  }
  function updateTooltipPos(cx, cy) {
    if (tooltipUrl && !tooltipUrl.classList.contains('hidden')) {
      tooltipUrl.style.left = (cx + 16) + 'px'; tooltipUrl.style.top = (cy - 60) + 'px';
    }
    if (tooltipText && !tooltipText.classList.contains('hidden')) {
      tooltipText.style.left = (cx + 16) + 'px'; tooltipText.style.top = (cy - 10) + 'px';
    }
  }

  svg.addEventListener('mouseover', function(e) {
    var target = e.target.closest('.draggable-pin');
    if (!target) { hideTooltips(); return; }
    var url = target.getAttribute('data-url'), label = target.getAttribute('data-label');
    var text = target.getAttribute('data-text'), icon = target.getAttribute('data-icon');
    var urlTitle = target.getAttribute('data-url-title');
    var imageUpload = target.getAttribute('data-image-upload');
    var bg = target.getAttribute('data-color') || '#cc3333', tc = target.getAttribute('data-text-color') || '#ffffff';
    var cx = e.clientX, cy = e.clientY;
    var cont = svg.parentElement, cr = cont.getBoundingClientRect();
    var rx = e.clientX - cr.left, ry = e.clientY - cr.top;
    var hasUrl = url && url !== '';
    var displayText = label || text;
    if (!hasUrl && !displayText) { hideTooltips(); return; }
    if (hasUrl) {
      showTooltipUrl(icon, bg, tc, rx, ry, imageUpload);
      var tooltipParts = [];
      if (displayText) tooltipParts.push(displayText);
      if (urlTitle) tooltipParts.push(urlTitle);
      tooltipParts.push(url);
      showTooltipText(tooltipParts.join(' - '), bg, tc, rx, ry);
    } else {
      if (displayText) showTooltipText(displayText, bg, tc, rx, ry);
    }
  });
  svg.addEventListener('mousemove', function(e) {
    var cont = svg.parentElement, cr = cont.getBoundingClientRect();
    var rx = e.clientX - cr.left, ry = e.clientY - cr.top;
    updateTooltipPos(rx, ry);
  });
  svg.addEventListener('mouseout', function(e) {
    var target = e.target.closest('.draggable-pin');
    if (!target) { hideTooltips(); return; }
    if (e.relatedTarget && target.contains(e.relatedTarget)) return;
    hideTooltips();
  });

  var touchStartX = 0, touchStartY = 0, touchTarget = null;
  svg.addEventListener('touchstart', function(e) {
    var target = e.target.closest('.draggable-pin');
    if (!target || !canModify(target)) return;
    if (cursorMode === 'click') return;
    e.preventDefault();
    var touch = e.changedTouches[0];
    var rect = svg.getBoundingClientRect();
    touchStartX = (touch.clientX - rect.left) * 800 / rect.width;
    touchStartY = (touch.clientY - rect.top) * 500 / rect.height;
    touchTarget = target;
    hideTooltips();
    longPressTimer = setTimeout(function() {
      if (!touchTarget) return;
      startDrag(touchTarget, touchStartX, touchStartY);
      if (navigator.vibrate) navigator.vibrate(10);
      var url = touchTarget.getAttribute('data-url'), label = touchTarget.getAttribute('data-label');
      var text = touchTarget.getAttribute('data-text'), icon = touchTarget.getAttribute('data-icon');
      var urlTitle = touchTarget.getAttribute('data-url-title');
      var imageUpload = touchTarget.getAttribute('data-image-upload');
      var bg = touchTarget.getAttribute('data-color') || '#cc3333', tc = touchTarget.getAttribute('data-text-color') || '#ffffff';
      var hasUrl = url && url !== '';
      var displayText = label || text;
      if (hasUrl) {
        showTooltipUrl(icon, bg, tc, touchStartX, touchStartY, imageUpload);
        var tooltipParts = [];
        if (displayText) tooltipParts.push(displayText);
        if (urlTitle) tooltipParts.push(urlTitle);
        tooltipParts.push(url);
        showTooltipText(tooltipParts.join(' - '), bg, tc, touchStartX, touchStartY);
      } else if (displayText) {
        showTooltipText(displayText, bg, tc, touchStartX, touchStartY);
      }
    }, 300);
  }, { passive: false });
  svg.addEventListener('touchmove', function(e) {
    var touch = e.changedTouches[0];
    var rect = svg.getBoundingClientRect();
    var cx = (touch.clientX - rect.left) * 800 / rect.width;
    var cy = (touch.clientY - rect.top) * 500 / rect.height;
    if (dragging) {
      moveDrag(cx, cy); e.preventDefault();
    } else if (longPressTimer && touchTarget && (Math.abs(cx - touchStartX) > 8 || Math.abs(cy - touchStartY) > 8)) {
      clearTimeout(longPressTimer); longPressTimer = null;
      startDrag(touchTarget, touchStartX, touchStartY);
      moveDrag(cx, cy); e.preventDefault();
    }
  }, { passive: false });
  svg.addEventListener('touchend', function(e) {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    if (!wasDragged) {
      var target = e.target.closest('.draggable-pin');
      if (target) { var u = target.getAttribute('data-url'); if (u) window.open(u, '_blank'); }
    }
    hideTooltips();
    endDrag();
    touchTarget = null;
  });
  svg.addEventListener('touchcancel', function() {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    hideTooltips(); endDrag();
    touchTarget = null;
  });

  svg.addEventListener('click', function(e) {
    if (wasDragged) return;
    var target = e.target.closest('.draggable-pin');
    if (!target) return;
    var url = target.getAttribute('data-url');
    if (!url) return;
    e.preventDefault(); window.open(url, '_blank');
  });

  svg.addEventListener('dblclick', function(e) {
    var target = e.target.closest('.draggable-pin');
    if (!target) return;
    e.preventDefault();
    if (!colorInput) return;
    colorInput.value = target.getAttribute('data-color') || '#cc3333';
    colorInput.setAttribute('data-pin-id', target.getAttribute('data-pin-id'));
    colorInput.setAttribute('data-board-id', target.getAttribute('data-board-id'));
    colorInput.click();
  });

  if (colorInput) {
    colorInput.addEventListener('input', function() {
      var pinId = this.getAttribute('data-pin-id');
      var pin = document.querySelector('.draggable-pin[data-pin-id="' + pinId + '"]');
      if (!pin) return;
      var color = this.value;
      pin.setAttribute('data-color', color);
      var defs = svg.querySelector('defs'); if (!defs) return;
      var gid = 'cv-grad-' + pinId; var old = document.getElementById(gid); if (old) old.remove();
      var r = parseInt(color.slice(1,3),16), g = parseInt(color.slice(3,5),16), b = parseInt(color.slice(5,7),16);
      var ns = 'http://www.w3.org/2000/svg';
      var grad = document.createElementNS(ns, 'radialGradient');
      grad.setAttribute('id', gid); grad.setAttribute('cx','35%'); grad.setAttribute('cy','35%'); grad.setAttribute('r','60%');
      var s1 = document.createElementNS(ns, 'stop'); s1.setAttribute('offset','0%'); s1.setAttribute('stop-color','#fff'); s1.setAttribute('stop-opacity','0.6');
      var s2 = document.createElementNS(ns, 'stop'); s2.setAttribute('offset','25%'); s2.setAttribute('stop-color','rgb('+r+','+g+','+b+')');
      var s3 = document.createElementNS(ns, 'stop'); s3.setAttribute('offset','80%'); s3.setAttribute('stop-color','rgb('+(r*0.6|0)+','+(g*0.6|0)+','+(b*0.6|0)+')');
      var s4 = document.createElementNS(ns, 'stop'); s4.setAttribute('offset','100%'); s4.setAttribute('stop-color','rgb('+(r*0.4|0)+','+(g*0.4|0)+','+(b*0.4|0)+')');
      grad.appendChild(s1); grad.appendChild(s2); grad.appendChild(s3); grad.appendChild(s4); defs.appendChild(grad);
      var circle = pin.querySelector('circle'); if (circle) circle.setAttribute('fill','url(#'+gid+')');
      var lum = (0.299*r+0.587*g+0.114*b)/255; var tc = lum > 0.5 ? '#000000' : '#ffffff';
      var textEl = pin.querySelector('text'); if (textEl) textEl.setAttribute('fill', tc);
      pin.setAttribute('data-text-color', tc);
    });
    colorInput.addEventListener('change', function() {
      var pinId = this.getAttribute('data-pin-id'), boardId = this.getAttribute('data-board-id');
      var color = this.value;
      var pin = document.querySelector('.draggable-pin[data-pin-id="' + pinId + '"]');
      var textColor = pin ? pin.getAttribute('data-text-color') || '#ffffff' : '#ffffff';
      actionMovePin({ id: pinId, board_id: boardId, color: color, text_color: textColor });
    });
  }

  window.addEventListener('message', function(e) { if (e.data && e.data.type === 'pin-update') { applyPinUpdate(e.data); } });
  document.addEventListener('change', function(e) { if (e.target.classList.contains('table-color-picker') || e.target.classList.contains('table-text-color-picker')) { tableColorChange(e.target); } });
  document.addEventListener('input', function(e) { if (e.target.classList.contains('table-color-picker') || e.target.classList.contains('table-text-color-picker')) { tableColorVisual(e.target); } });
  var imgs = svg.querySelectorAll('image');
  for (var i = 0; i < imgs.length; i++) { (function(img) {
    var hasError = false;
    var pid = img.parentElement.getAttribute('data-pin-id');
    img.addEventListener('error', function() {
      if (hasError) return; hasError = true;
      var g = img.parentElement;
      var label = g.getAttribute('data-label') || '';
      var color = g.getAttribute('data-text-color') || '#fff';
      var cx = parseFloat(g.querySelector('circle').getAttribute('cx'));
      var cy = parseFloat(g.querySelector('circle').getAttribute('cy'));
      var ns = 'http://www.w3.org/2000/svg';
      var t = document.createElementNS(ns, 'text');
      t.setAttribute('x', cx); t.setAttribute('y', cy + 4);
      t.setAttribute('text-anchor', 'middle'); t.setAttribute('dominant-baseline', 'central');
      t.setAttribute('font-size', '18'); t.setAttribute('fill', color);
      t.setAttribute('pointer-events', 'none');
      t.textContent = (label || '?')[0].toUpperCase();
      g.replaceChild(t, img);
    });
  })(imgs[i]); }
}

function applyPinUpdate(msg) {
  var el = document.querySelector('.draggable-pin[data-pin-id="' + msg.pinId + '"]');
  if (!el) return;
  if (msg.x !== undefined && msg.y !== undefined) {
    var c = el.querySelector('circle'), e = el.querySelector('ellipse'), im = el.querySelector('image'), t = el.querySelector('text');
    if (c) { c.setAttribute('cx', msg.x); c.setAttribute('cy', msg.y); }
    if (e) { e.setAttribute('cx', msg.x - 6); e.setAttribute('cy', msg.y - 8); }
    if (im) { im.setAttribute('x', msg.x - 12); im.setAttribute('y', msg.y - 12); }
    if (t) { t.setAttribute('x', msg.x); t.setAttribute('y', msg.y + 4); }
  }
  if (msg.color) {
    el.setAttribute('data-color', msg.color);
    var defs = document.querySelector('defs'); if (!defs) return;
    var gid = 'cv-grad-' + msg.pinId; var old = document.getElementById(gid); if (old) old.remove();
    var r = parseInt(msg.color.slice(1,3),16), g = parseInt(msg.color.slice(3,5),16), b = parseInt(msg.color.slice(5,7),16);
    var ns = 'http://www.w3.org/2000/svg';
    var grad = document.createElementNS(ns, 'radialGradient');
    grad.setAttribute('id', gid); grad.setAttribute('cx','35%'); grad.setAttribute('cy','35%'); grad.setAttribute('r','60%');
    grad.appendChild(document.createElementNS(ns, 'stop')).setAttribute('offset','0%'); grad.lastChild.setAttribute('stop-color','#fff'); grad.lastChild.setAttribute('stop-opacity','0.6');
    grad.appendChild(document.createElementNS(ns, 'stop')).setAttribute('offset','25%'); grad.lastChild.setAttribute('stop-color','rgb('+r+','+g+','+b+')');
    grad.appendChild(document.createElementNS(ns, 'stop')).setAttribute('offset','80%'); grad.lastChild.setAttribute('stop-color','rgb('+(r*0.6|0)+','+(g*0.6|0)+','+(b*0.6|0)+')');
    grad.appendChild(document.createElementNS(ns, 'stop')).setAttribute('offset','100%'); grad.lastChild.setAttribute('stop-color','rgb('+(r*0.4|0)+','+(g*0.4|0)+','+(b*0.4|0)+')');
    defs.appendChild(grad);
    var circle = el.querySelector('circle'); if (circle) circle.setAttribute('fill','url(#'+gid+')');
  }
  if (msg.textColor) { el.setAttribute('data-text-color', msg.textColor); var textEl = el.querySelector('text'); if (textEl) textEl.setAttribute('fill', msg.textColor); }
}

function tableColorChange(el) {
  var pinId = el.getAttribute('data-pin-id'), boardId = el.getAttribute('data-board-id');
  var bg = document.querySelector('.table-color-picker[data-pin-id="' + pinId + '"]');
  var tx = document.querySelector('.table-text-color-picker[data-pin-id="' + pinId + '"]');
  actionMovePin({ id: pinId, board_id: boardId, color: bg ? bg.value : '#cc3333', text_color: tx ? tx.value : '#ffffff' });
  refreshEmbedPreview();
}
function refreshEmbedPreview() {
  var iframe = document.querySelector('.embed-preview-frame iframe');
  if (iframe) iframe.src = iframe.src.replace(/\?.*/, '') + '?_t=' + Date.now();
}

function tableColorVisual(el) {
  var pinId = el.getAttribute('data-pin-id');
  var pin = document.querySelector('.draggable-pin[data-pin-id="' + pinId + '"]');
  if (!pin) return;
  if (el.classList.contains('table-text-color-picker')) {
    pin.setAttribute('data-text-color', el.value); var textEl = pin.querySelector('text'); if (textEl) textEl.setAttribute('fill', el.value); return;
  }
  var color = el.value; pin.setAttribute('data-color', color);
  var defs = document.querySelector('defs'); if (!defs) return;
  var gid = 'cv-grad-' + pinId; var old = document.getElementById(gid); if (old) old.remove();
  var r = parseInt(color.slice(1,3),16), g = parseInt(color.slice(3,5),16), b = parseInt(color.slice(5,7),16);
  var ns = 'http://www.w3.org/2000/svg';
  var grad = document.createElementNS(ns, 'radialGradient');
  grad.setAttribute('id', gid); grad.setAttribute('cx','35%'); grad.setAttribute('cy','35%'); grad.setAttribute('r','60%');
  grad.appendChild(document.createElementNS(ns, 'stop')).setAttribute('offset','0%'); grad.lastChild.setAttribute('stop-color','#fff'); grad.lastChild.setAttribute('stop-opacity','0.6');
  grad.appendChild(document.createElementNS(ns, 'stop')).setAttribute('offset','25%'); grad.lastChild.setAttribute('stop-color','rgb('+r+','+g+','+b+')');
  grad.appendChild(document.createElementNS(ns, 'stop')).setAttribute('offset','80%'); grad.lastChild.setAttribute('stop-color','rgb('+(r*0.6|0)+','+(g*0.6|0)+','+(b*0.6|0)+')');
  grad.appendChild(document.createElementNS(ns, 'stop')).setAttribute('offset','100%'); grad.lastChild.setAttribute('stop-color','rgb('+(r*0.4|0)+','+(g*0.4|0)+','+(b*0.4|0)+')');
  defs.appendChild(grad);
  var circle = pin.querySelector('circle'); if (circle) circle.setAttribute('fill','url(#'+gid+')');
}

// ============================================================
// HTML string renderers
// ============================================================
function renderNavbarHTML() {
  var u = getUser();
  if (!u) return '';
  return '<nav class="navbar"><a href="?route=uploads" class="nav-brand">📌 Flair Board</a><div class="nav-links"><span class="nav-user">' + esc(u.username) + '</span><a href="?route=uploads">My Boards</a><a href="?route=login" class="btn-logout" data-action="logout">Logout</a></div></nav>';
}

function htmlCard(b) {
  var color = stringToColor(b.name);
  return '<div class="board-card" data-board-id="' + escAttr(b.id) + '"><a href="?route=board/' + escAttr(b.id) + '" class="board-card-link"><div class="board-card-preview"><div class="board-card-cork"><div class="board-card-flairs"><span class="mini-count">' + (b.pin_count || '') + '</span></div></div></div><div class="board-card-info"><span class="board-card-name">' + esc(b.name) + '</span></div></a><div class="board-card-actions"><button class="btn-toggle ' + (b.is_public ? 'public' : 'private') + '" data-action="toggle_public" data-board-id="' + b.id + '">' + (b.is_public ? 'Public' : 'Private') + '</button><button class="btn-delete" data-action="delete_board" data-board-id="' + b.id + '">🗑️</button></div></div>';
}

function renderUploadsPage(el) {
  var u = uid();
  if (!u) { navigate('?route=login'); return; }
  var boards = getBoards(u);
  var cards = boards.map(htmlCard).join('');
  if (!cards) cards = '<p class="empty-msg">No boards yet. Create your first one!</p>';
  el.innerHTML = renderNavbarHTML() + '<div class="page-content uploads-page">'
    + '<div class="uploads-header"><h2>My Boards</h2><button class="btn-primary" id="show-create-form">+ New Board</button></div>'
    + '<form class="create-board-form hidden" id="create-form"><input type="text" name="name" placeholder="Board name..." maxlength="50" required><button type="submit" class="btn-primary">Create</button><a href="#" class="btn-secondary" id="cancel-create">Cancel</a></form>'
    + '<div class="boards-grid">' + cards + '</div></div>';
}

function renderBoardPage(el) {
  var route = currentRoute();
  var parts = route.split('/');
  var bid = parts[1];
  var boards = Store.read('boards') || {};
  var board = boards[bid];
  if (!board) { el.innerHTML = renderNavbarHTML() + '<div class="page-content"><h2>Board Not Found</h2><a href="?route=uploads">Back</a></div>'; return; }
  var u = uid();
  var isOwner = board.user_id === u;
  var pins = getPins(bid);
  var gradDefs = '', gi = 0;
  var pinSvgs = pins.map(function(p) {
    gi++; var gid = 'pg-' + gi;
    var color = p.color || '#cc3333', tColor = p.text_color || '#fff';
    var r = parseInt(color.slice(1,3),16), g = parseInt(color.slice(3,5),16), b = parseInt(color.slice(5,7),16);
    gradDefs += '<radialGradient id="' + gid + '" cx="35%" cy="35%" r="60%"><stop offset="0%" stop-color="#fff" stop-opacity="0.6"/><stop offset="25%" stop-color="rgb(' + r + ',' + g + ',' + b + ')"/><stop offset="80%" stop-color="rgb(' + (r*0.6|0) + ',' + (g*0.6|0) + ',' + (b*0.6|0) + ')"/><stop offset="100%" stop-color="rgb(' + (r*0.4|0) + ',' + (g*0.4|0) + ',' + (b*0.4|0) + ')"/></radialGradient>';
    var isFavicon = (p.icon || '').indexOf('http') === 0 || (p.icon || '').indexOf('data:') === 0;
    var pinUrl = p.url || '';
    return '<g class="draggable-pin" filter="url(#cork-shadow)" cursor="pointer" data-pin-id="' + p.id + '" data-board-id="' + bid + '" data-color="' + color + '" data-text-color="' + tColor + '" data-url="' + escAttr(pinUrl) + '" data-label="' + escAttr(p.label || '') + '" data-text="' + escAttr(p.label || p.text || '') + '" data-url-title="' + escAttr(p.url_title || '') + '" data-icon="' + escAttr(p.icon || '') + '" data-image-upload="' + escAttr(p.image_upload || '') + '"><circle cx="' + p.x + '" cy="' + p.y + '" r="24" fill="url(#' + gid + ')"/><ellipse cx="' + (p.x - 6) + '" cy="' + (p.y - 8) + '" rx="8" ry="6" fill="#fff" opacity="0.4"/>' + (isFavicon ? '<image href="' + escAttr(p.icon) + '" x="' + (p.x - 12) + '" y="' + (p.y - 12) + '" width="24" height="24" preserveAspectRatio="xMidYMid meet" style="image-rendering:auto;border-radius:50%" pointer-events="none"/>' : '<text x="' + p.x + '" y="' + (p.y + 4) + '" text-anchor="middle" dominant-baseline="central" font-size="18" fill="' + tColor + '" pointer-events="none">' + esc((p.icon || (p.label || '?')[0])) + '</text>') + '</g>';
  }).join('');
  var pinRows = pins.map(function(p) {
    return '<tr data-pin-id="' + p.id + '"><td>' + ((p.icon || '').indexOf('http') === 0 || (p.icon || '').indexOf('data:') === 0 ? '<img src="' + escAttr(p.icon) + '" style="width:24px;height:24px;vertical-align:middle" alt="">' : '<span class="pin-icon">' + esc(p.icon || '📍') + '</span>') + '</td><td>' + esc(p.label || p.text || '(no text)') + '</td><td class="pos-display">X: ' + p.x + ' Y: ' + p.y + '</td><td><input type="color" class="table-color-picker" value="' + p.color + '" data-pin-id="' + p.id + '" data-board-id="' + bid + '" title="Pin color"></td><td><input type="color" class="table-text-color-picker" value="' + (p.text_color || '#ffffff') + '" data-pin-id="' + p.id + '" data-board-id="' + bid + '" title="Text color"></td><td><button class="btn-delete" data-action="delete_pin" data-pin-id="' + p.id + '" data-board-id="' + bid + '">🗑️</button></td></tr>';
  }).join('');
  var gridLines = '';
  for (var gx = 40; gx < 800; gx += 40) gridLines += '<line x1="' + gx + '" y1="12" x2="' + gx + '" y2="488"/>';
  for (var gy = 40; gy < 500; gy += 40) gridLines += '<line x1="12" y1="' + gy + '" x2="788" y2="' + gy + '"/>';
  var embedSection = board.is_public ? '<div class="embed-section"><h3 class="embed-heading">📋 Share / Embed this Board</h3><div class="embed-body"><label class="embed-label">Public URL:</label><div class="embed-copy-row"><input type="text" class="embed-copy-input" readonly value="' + escAttr(location.origin + location.pathname + '?route=public/' + bid) + '" spellcheck="false"><button class="embed-copy-btn" onclick="var i=this.previousElementSibling;i.select();navigator.clipboard.writeText(i.value);this.textContent=\'Copied!\';setTimeout(function(){this.textContent=\'Copy\'}.bind(this),2000)">Copy</button></div><label class="embed-label">Embed iframe code:</label><div class="embed-copy-row"><input type="text" class="embed-copy-input" readonly value=\'<iframe src="' + escAttr(location.origin + location.pathname + '?route=public/' + bid) + '" width="100%" height="600" frameborder="0"></iframe>\' spellcheck="false"><button class="embed-copy-btn" onclick="var i=this.previousElementSibling;i.select();navigator.clipboard.writeText(i.value);this.textContent=\'Copied!\';setTimeout(function(){this.textContent=\'Copy\'}.bind(this),2000)">Copy</button></div><p class="embed-note">Visitors can add their own pins and delete only the ones they added.</p></div><div class="embed-preview"><div class="embed-preview-frame"><iframe src="' + escAttr(location.origin + location.pathname + '?route=public/' + bid) + '" width="100%" height="450" frameborder="0"></iframe></div></div></div>' : '';
  el.innerHTML = renderNavbarHTML() + '<div class="page-content board-page" id="board-page">'
    + '<div class="board-header"><a href="?route=uploads" class="btn-back">← Back</a><h2>' + esc(board.name) + '</h2><div class="board-header-actions">'
    + (isOwner ? '<button class="btn-toggle ' + (board.is_public ? 'public' : 'private') + '" data-action="toggle_public" data-board-id="' + bid + '">' + (board.is_public ? 'Public' : 'Private') + '</button>' : '')
    + '<button class="btn-mode" id="cursor-mode-toggle">' + (cursorMode === 'click' ? 'Click' : 'Drag') + '</button>'
    + '<button class="btn-primary" id="show-flair-picker" style="display:inline-block;width:auto">+ Add Flair</button>'
    + '</div></div>' + embedSection
    + '<div class="flair-board-container" id="flair-board-container">'
    + '<svg class="flair-board" id="flair-board" viewBox="0 0 800 500" xmlns="http://www.w3.org/2000/svg">'
    + '<defs><filter id="cork-shadow"><feDropShadow dx="2" dy="2" stdDeviation="4" flood-opacity="0.4"/></filter>'
    + '<pattern id="cork-texture" width="8" height="8" patternUnits="userSpaceOnUse">'
    + '<rect width="8" height="8" fill="#8B5E3C"/><circle cx="1" cy="1" r="0.6" fill="#7a5030" opacity="0.4"/><circle cx="5" cy="4" r="0.5" fill="#9a6e4a" opacity="0.3"/><circle cx="3" cy="6" r="0.4" fill="#7a5030" opacity="0.5"/><circle cx="7" cy="2" r="0.5" fill="#6a4020" opacity="0.3"/>'
    + '</pattern><linearGradient id="frame-grad" x1="0%" y1="0%" x2="0%" y2="100%">'
    + '<stop offset="0%" stop-color="#3e2a1a"/><stop offset="50%" stop-color="#5a3d26"/><stop offset="100%" stop-color="#2a1a0e"/>'
    + '</linearGradient>' + gradDefs + '</defs>'
    + '<rect x="0" y="0" width="800" height="500" fill="url(#frame-grad)" rx="6"/>'
    + '<rect x="12" y="12" width="776" height="476" fill="url(#cork-texture)" rx="2"/>'
    + '<rect x="12" y="12" width="776" height="476" fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="3" rx="2"/>'
    + '<g stroke="rgba(0,0,0,0.05)" stroke-width="0.5">' + gridLines + '</g>'
    + pinSvgs + '</svg>'
    + '<div id="pin-tooltip-url" class="pin-tooltip pin-tooltip-url hidden"><img class="tooltip-img" src="" alt=""><img class="tooltip-img-upload" src="" alt="" style="display:none;margin-left:4px"></div><div id="pin-tooltip-text" class="pin-tooltip pin-tooltip-text hidden"></div></div>'
    + (pins.length ? '<div class="pin-list"><details><summary class="embed-summary">📋 Pin List (' + pins.length + ')</summary><table><thead><tr><th>Icon</th><th>Label</th><th>Position</th><th>Color</th><th>Text</th><th></th></tr></thead><tbody>' + pinRows + '</tbody></table></details></div>' : '')
    + '<input type="color" id="pin-color-picker" style="position:fixed;top:-100px;left:-100px;width:0;height:0;opacity:0;pointer-events:none">'
      + '<div id="flair-picker" class="flair-picker hidden"><h3>Add a Pin</h3><form id="add-pin-form" style="display:flex;flex-wrap:wrap;gap:6px"><input type="hidden" name="board_id" value="' + bid + '"><input type="hidden" name="x" value="400"><input type="hidden" name="y" value="250"><input type="url" name="url" placeholder="Title" style="flex:2;min-width:140px"><input type="text" name="label" placeholder="Text (optional)" style="flex:1;min-width:140px"><input type="file" name="image" accept="image/*" style="flex:1;min-width:100px"><input type="color" name="color" value="#cc3333" style="width:40px;height:36px;padding:2px"><input type="color" name="text_color" value="#ffffff" style="width:40px;height:36px;padding:2px"><button type="submit" class="btn-primary" style="padding:6px 14px;font-size:13px">Add Pin</button></form><button class="btn-secondary" style="display:block;width:100%;margin-top:8px;cursor:pointer" id="cancel-picker">Cancel</button></div>'
    + '</div>';
  bindBoardSVGs();
}

function renderPublicBoardPage(el) {
  var route = currentRoute();
  var parts = route.split('/');
  var bid = parts[1];
  var boards = Store.read('boards') || {};
  var board = Object.values(boards).find(function(b) { return String(b.id) === bid && b.is_public; });
  if (!board) { el.innerHTML = '<h2>Board Not Found or Not Public</h2>'; return; }
  var pins = getPins(bid);
  var visitorId = Session.get('visitor_id');
  if (!visitorId) { visitorId = generateUUID(); Session.set('visitor_id', visitorId); }
  var gradDefs = '', gi = 0;
  var pinSvgs = pins.map(function(p) {
    gi++; var gid = 'ppg-' + gi;
    var color = p.color || '#cc3333', tColor = p.text_color || '#fff';
    var r = parseInt(color.slice(1,3),16), g = parseInt(color.slice(3,5),16), b = parseInt(color.slice(5,7),16);
    gradDefs += '<radialGradient id="' + gid + '" cx="35%" cy="35%" r="60%"><stop offset="0%" stop-color="#fff" stop-opacity="0.6"/><stop offset="25%" stop-color="rgb(' + r + ',' + g + ',' + b + ')"/><stop offset="80%" stop-color="rgb(' + (r*0.6|0) + ',' + (g*0.6|0) + ',' + (b*0.6|0) + ')"/><stop offset="100%" stop-color="rgb(' + (r*0.4|0) + ',' + (g*0.4|0) + ',' + (b*0.4|0) + ')"/></radialGradient>';
    var isFavicon = (p.icon || '').indexOf('http') === 0 || (p.icon || '').indexOf('data:') === 0;
    var pinUrl = p.url || '';
    var isOwner = p.visitor_id === visitorId;
    return '<g class="draggable-pin" filter="url(#cork-shadow)" cursor="pointer" data-pin-id="' + p.id + '" data-board-id="' + board.id + '" data-color="' + color + '" data-text-color="' + tColor + '" data-url="' + escAttr(pinUrl) + '" data-label="' + escAttr(p.label || '') + '" data-text="' + escAttr(p.label || p.text || '') + '" data-url-title="' + escAttr(p.url_title || '') + '" data-icon="' + escAttr(p.icon || '') + '" data-image-upload="' + escAttr(p.image_upload || '') + '" data-visitor-id="' + (p.visitor_id || '') + '"><circle cx="' + p.x + '" cy="' + p.y + '" r="24" fill="url(#' + gid + ')"/><ellipse cx="' + (p.x - 6) + '" cy="' + (p.y - 8) + '" rx="8" ry="6" fill="#fff" opacity="0.4"/>' + (isFavicon ? '<image href="' + escAttr(p.icon) + '" x="' + (p.x - 12) + '" y="' + (p.y - 12) + '" width="24" height="24" style="image-rendering:auto" pointer-events="none"/>' : '<text x="' + p.x + '" y="' + (p.y + 4) + '" text-anchor="middle" dominant-baseline="central" font-size="18" fill="' + tColor + '" pointer-events="none">' + esc((p.icon || (p.label || '?')[0])) + '</text>') + '</g>';
  }).join('');
  var gridLines = '';
  for (var gx = 40; gx < 800; gx += 40) gridLines += '<line x1="' + gx + '" y1="12" x2="' + gx + '" y2="488"/>';
  for (var gy = 40; gy < 500; gy += 40) gridLines += '<line x1="12" y1="' + gy + '" x2="788" y2="' + gy + '"/>';
  el.innerHTML = '<div style="font-family:sans-serif;background:#e8e0d5;min-height:100vh;padding:10px">'
    + '<div style="display:flex;align-items:center;gap:8px;margin:8px 0"><h2 style="color:#3b5998;font-size:18px;margin:0">📌 ' + esc(board.name) + '</h2><button class="btn-mode" id="cursor-mode-toggle">' + (cursorMode === 'click' ? 'Click' : 'Drag') + '</button></div>'
    + '<div class="flair-board-container" id="public-board-container">'
    + '<svg class="flair-board" id="public-flair-board" viewBox="0 0 800 500" xmlns="http://www.w3.org/2000/svg">'
    + '<defs><filter id="cork-shadow"><feDropShadow dx="2" dy="2" stdDeviation="4" flood-opacity="0.4"/></filter>'
    + '<pattern id="cork-texture" width="8" height="8" patternUnits="userSpaceOnUse">'
    + '<rect width="8" height="8" fill="#8B5E3C"/><circle cx="1" cy="1" r="0.6" fill="#7a5030" opacity="0.4"/><circle cx="5" cy="4" r="0.5" fill="#9a6e4a" opacity="0.3"/><circle cx="3" cy="6" r="0.4" fill="#7a5030" opacity="0.5"/><circle cx="7" cy="2" r="0.5" fill="#6a4020" opacity="0.3"/>'
    + '</pattern><linearGradient id="frame-grad" x1="0%" y1="0%" x2="0%" y2="100%">'
    + '<stop offset="0%" stop-color="#3e2a1a"/><stop offset="50%" stop-color="#5a3d26"/><stop offset="100%" stop-color="#2a1a0e"/>'
    + '</linearGradient>' + gradDefs + '</defs>'
    + '<rect x="0" y="0" width="800" height="500" fill="url(#frame-grad)" rx="6"/>'
    + '<rect x="12" y="12" width="776" height="476" fill="url(#cork-texture)" rx="2"/>'
    + '<rect x="12" y="12" width="776" height="476" fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="3" rx="2"/>'
    + '<g stroke="rgba(0,0,0,0.05)" stroke-width="0.5">' + gridLines + '</g>'
    + pinSvgs + '</svg>'
     + '<div id="pin-tooltip-url" class="pin-tooltip pin-tooltip-url hidden"><img class="tooltip-img" src="" alt=""><img class="tooltip-img-upload" src="" alt="" style="display:none;margin-left:4px"></div><div id="pin-tooltip-text" class="pin-tooltip pin-tooltip-text hidden"></div></div>'
     + '<details class="public-add-details" style="margin-top:8px"><summary style="cursor:pointer;font-weight:600;color:#3b5998">+ Add your own flair</summary>'
    + '<div class="public-add-bar" style="margin:8px 0">'
    + '<form id="public-add-pin-form" style="display:flex;flex-wrap:wrap;gap:6px;width:100%">'
    + '<input type="hidden" name="board_id" value="' + bid + '">'
    + '<input type="hidden" name="x" value="400"><input type="hidden" name="y" value="250">'
     + '<input type="url" name="url" placeholder="Title" style="flex:2;min-width:140px">'
     + '<input type="text" name="label" placeholder="Text (optional)" style="flex:1;min-width:140px">'
     + '<input type="file" name="image" accept="image/*" style="flex:1;min-width:100px">'
     + '<input type="color" name="color" value="#cc3333" style="width:40px;height:36px;padding:2px">'
     + '<input type="color" name="text_color" value="#ffffff" style="width:40px;height:36px;padding:2px">'
     + '<button type="submit" class="btn-primary" style="padding:6px 14px;font-size:13px">Add</button>'
    + '</form></div></details></div>';
  bindBoardSVGs();
}

// ============================================================
// App component
// ============================================================
function App() {
  var el;

  createEffect(function() {
    var page = currentPageSig();
    if (page === 'uploads' || (typeof page === 'string' && (page.startsWith('board/') || page.startsWith('public/')))) {
      var node = el;
      if (!node) return;
      if (page === 'uploads') renderUploadsPage(node);
      else if (page.startsWith('board/')) renderBoardPage(node);
      else if (page.startsWith('public/')) renderPublicBoardPage(node);
    }
  });

  return (
    <div ref={el}>
      <Switch>
        <Match when={currentPageSig() === 'login'}><LoginPage {...(pagePropsSig())} /></Match>
        <Match when={currentPageSig() === 'signup'}><RegisterPage {...(pagePropsSig())} /></Match>
        <Match when={currentPageSig() === 'verify'}><VerifyPage {...(pagePropsSig())} /></Match>
        <Match when={currentPageSig() === 'setup'}><SetupPage {...(pagePropsSig())} /></Match>
        <Match when={currentPageSig() === 'forgot_password'}><ForgotPasswordPage {...(pagePropsSig())} /></Match>
        <Match when={currentPageSig() === 'reset_password_setup'}><ResetPasswordPage {...(pagePropsSig())} /></Match>
      </Switch>
    </div>
  );
}

// ============================================================
// Expose actions globally for event delegation
// ============================================================
window.actionLogin = actionLogin;
window.actionRegisterEmail = actionRegisterEmail;
window.actionSendOTP = actionSendOTP;
window.actionVerifyOTP = actionVerifyOTP;
window.actionCompleteRegistration = actionCompleteRegistration;
window.actionForgotPassword = actionForgotPassword;
window.actionResetPassword = actionResetPassword;
window.actionCreateBoard = actionCreateBoard;
window.actionDeleteBoard = actionDeleteBoard;
window.actionTogglePublic = actionTogglePublic;
window.actionAddPin = actionAddPin;
window.actionDeletePin = actionDeletePin;

// ============================================================
// Event delegation for innerHTML-rendered pages
// ============================================================
var FORM_ACTIONS = {
  'login-form': actionLogin,
  'register-form': actionRegisterEmail,
  'setup-form': actionCompleteRegistration,
  'forgot-password-form': actionForgotPassword,
  'create-form': actionCreateBoard,
  'add-pin-form': actionAddPin,
  'public-add-pin-form': actionAddPin,
};

var GLOBAL_ACTIONS = {
  logout: actionLogout,
  create_board: actionCreateBoard,
  delete_board: actionDeleteBoard,
  toggle_public: actionTogglePublic,
  add_pin: actionAddPin,
  delete_pin: actionDeletePin,
};

document.addEventListener('submit', async function(e) {
  var form = e.target;
  if (!form || form.tagName !== 'FORM') return;
  e.preventDefault();
  var id = form.id;
  if (FORM_ACTIONS[id]) { await FORM_ACTIONS[id](form); return; }
});

document.addEventListener('click', function(e) {
  var link = e.target.closest('a[href^="?route="]:not([data-action])');
  if (link) { e.preventDefault(); navigate(link.getAttribute('href')); return; }
});

document.addEventListener('click', async function(e) {
  var target = e.target.closest('[data-action]');
  if (!target) return;
  e.preventDefault();
  var action = target.dataset.action;
  if (action === 'logout') { actionLogout(); return; }
  if (GLOBAL_ACTIONS[action]) {
    var form = target.closest('form');
    if (form) { await GLOBAL_ACTIONS[action](form); return; }
    await GLOBAL_ACTIONS[action](target);
  }
});

document.addEventListener('click', function(e) {
  var el = e.target.closest('#show-create-form');
  if (el) { document.getElementById('create-form').classList.remove('hidden'); }
});
document.addEventListener('click', function(e) {
  var el = e.target.closest('#cancel-create');
  if (el) { e.preventDefault(); document.getElementById('create-form').classList.add('hidden'); }
});
document.addEventListener('click', function(e) {
  var el = e.target.closest('#show-flair-picker');
  if (el) { document.getElementById('flair-picker').classList.toggle('hidden'); }
});
document.addEventListener('click', function(e) {
  var el = e.target.closest('#cancel-picker');
  if (el) { document.getElementById('flair-picker').classList.add('hidden'); }
});

export default App;
