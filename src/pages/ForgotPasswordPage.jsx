import { Show } from 'solid-js';
import { esc } from '../lib/utils';
import { pagePropsSig } from '../App';

export default function ForgotPasswordPage() {
  var p = pagePropsSig;
  return (
    <div class="login-container">
      <div class="login-logo">
        <div class="login-flair-icon">📌</div>
        <h1>Flair Board</h1>
        <p class="login-subtitle">Reset your password</p>
      </div>
      <form class="login-form" onSubmit={function(e) { e.preventDefault(); window.actionForgotPassword(e.target); }}>
        <Show when={p().err}>
          <div class="login-error">{esc(p().err)}</div>
        </Show>
        <h2>Forgot Password</h2>
        <div class="form-group">
          <label for="email">Email</label>
          <input type="email" name="email" id="email" required placeholder="you@example.com" autocomplete="email" />
        </div>
        <button type="submit" class="btn-primary">Send Reset Code</button>
      </form>
      <p class="login-toggle"><a href="?route=login">Back to login</a></p>
    </div>
  );
}
