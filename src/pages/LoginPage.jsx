import { Show } from 'solid-js';
import { esc } from '../lib/utils';

export default function LoginPage(props) {
  return (
    <div class="login-container">
      <div class="login-logo">
        <div class="login-flair-icon">📌</div>
        <h1>Flair Board</h1>
        <p class="login-subtitle">Pin your favorite things</p>
      </div>
      <form class="login-form" onSubmit={function(e) { e.preventDefault(); window.actionLogin(e.target); }}>
        <Show when={props.err}>
          <div class="login-error">{esc(props.err)}</div>
        </Show>
        <h2>Sign In</h2>
        <div class="form-group">
          <label>Email or Username</label>
          <input type="text" name="login" required placeholder="you@example.com or username" />
        </div>
        <div class="form-group">
          <label>Password</label>
          <input type="password" name="password" required minlength="4" placeholder="Enter password" />
        </div>
        <button type="submit" class="btn-primary">Sign In</button>
      </form>
      <p class="login-toggle">Don't have an account? <a href="#/signup">Register</a></p>
      <p class="login-toggle" style="margin-top:4px"><a href="#/forgot-password">Forgot password?</a></p>
    </div>
  );
}
