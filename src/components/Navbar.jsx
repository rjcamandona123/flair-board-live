import { esc } from '../lib/utils';

export default function Navbar(props) {
  if (!props.user) return null;
  return (
    <nav class="navbar">
      <a href="#/uploads" class="nav-brand">📌 Flair Board</a>
      <div class="nav-links">
        <span class="nav-user">{esc(props.user.username)}</span>
        <a href="#/uploads">My Boards</a>
        <a href="#/logout" class="btn-logout">Logout</a>
      </div>
    </nav>
  );
}
