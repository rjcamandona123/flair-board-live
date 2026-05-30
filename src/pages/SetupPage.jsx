import { Show } from 'solid-js';
import { esc } from '../lib/utils';

export default function SetupPage(props) {
  return (
    <div class="login-container">
      <div class="login-logo">
        <div class="login-flair-icon">📌</div>
        <h1>Flair Board</h1>
        <p class="login-subtitle">Set up your account</p>
      </div>
      <form class="login-form" onSubmit={function(e) { e.preventDefault(); window.actionCompleteRegistration(e.target); }}>
        <Show when={props.err}>
          <div class="login-error">{esc(props.err)}</div>
        </Show>
        <h2>Create Account</h2>
        <div class="form-group">
          <label>Username</label>
          <input type="text" name="username" required minlength="2" placeholder="Choose a username" />
        </div>
        <div class="form-group">
          <label>Password</label>
          <input type="password" name="password" required minlength="4" placeholder="Choose a password" />
        </div>
        <button type="submit" class="btn-primary">Create Account</button>
      </form>
    </div>
  );
}
