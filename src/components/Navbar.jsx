import { esc } from '../lib/utils';

export default function Navbar(props) {
  if (!props.user) return null;
  return (
    <nav class="navbar">
      <a href="?route=uploads" class="nav-brand">📌 Flair Board</a>
      <div class="nav-links">
        <span class="nav-user">{esc(props.user.username)}</span>
        <a href="?route=uploads">My Boards</a>
        <a href="?route=login" class="btn-logout">Logout</a>
      </div>
    </nav>
  );
}
