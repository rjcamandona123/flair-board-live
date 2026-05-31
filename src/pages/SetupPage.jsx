import { Show } from 'solid-js';
import { esc } from '../lib/utils';
import { pagePropsSig } from '../App';

export default function SetupPage() {
  var p = pagePropsSig;
  return (
    <div class="login-container">
      <div class="login-logo">
        <div class="login-flair-icon">📌</div>
        <h1>Flair Board</h1>
        <p class="login-subtitle">Set up your account</p>
      </div>
      <form class="login-form" onSubmit={function(e) { e.preventDefault(); window.actionCompleteRegistration(e.target); }}>
        <Show when={p().err}>
          <div class="login-error">{esc(p().err)}</div>
        </Show>
        <h2>Create Account</h2>
        <div class="form-group">
          <label for="username">Username</label>
          <input type="text" name="username" id="username" required minlength="2" placeholder="Choose a username" autocomplete="username" />
        </div>
        <div class="form-group">
          <label for="password">Password</label>
          <input type="password" name="password" id="password" required minlength="4" placeholder="Choose a password" autocomplete="new-password" />
        </div>
        <button type="submit" class="btn-primary">Create Account</button>
      </form>
    </div>
  );
}
