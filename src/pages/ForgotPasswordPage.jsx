import { Show } from 'solid-js';
import { esc } from '../lib/utils';

export default function ForgotPasswordPage(props) {
  return (
    <div class="login-container">
      <div class="login-logo">
        <div class="login-flair-icon">📌</div>
        <h1>Flair Board</h1>
        <p class="login-subtitle">Reset your password</p>
      </div>
      <form class="login-form" onSubmit={function(e) { e.preventDefault(); window.actionForgotPassword(e.target); }}>
        <Show when={props.err}>
          <div class="login-error">{esc(props.err)}</div>
        </Show>
        <h2>Forgot Password</h2>
        <div class="form-group">
          <label>Email</label>
          <input type="email" name="email" required placeholder="you@example.com" />
        </div>
        <button type="submit" class="btn-primary">Send Reset Code</button>
      </form>
      <p class="login-toggle"><a href="#/login">Back to login</a></p>
    </div>
  );
}
