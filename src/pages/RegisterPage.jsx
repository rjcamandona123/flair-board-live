import { Show } from 'solid-js';
import { esc } from '../lib/utils';

export default function RegisterPage(props) {
  return (
    <div class="login-container">
      <div class="login-logo">
        <div class="login-flair-icon">📌</div>
        <h1>Flair Board</h1>
        <p class="login-subtitle">Pin your favorite things</p>
      </div>
      <form class="login-form" onSubmit={function(e) { e.preventDefault(); window.actionRegisterEmail(e.target); }}>
        <Show when={props.err}>
          <div class="login-error">{esc(props.err)}</div>
        </Show>
        <h2>Register</h2>
        <div class="form-group">
          <label>Email</label>
          <input type="email" name="email" required placeholder="you@example.com" />
        </div>
        <button type="submit" class="btn-primary">Send Verification Code</button>
      </form>
      <p class="login-toggle">Already have an account? <a href="?route=login">Sign In</a></p>
    </div>
  );
}
