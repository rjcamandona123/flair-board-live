import { Show } from 'solid-js';
import { esc } from '../lib/utils';

export default function ResetPasswordPage(props) {
  return (
    <div class="login-container">
      <div class="login-logo">
        <div class="login-flair-icon">📌</div>
        <h1>Flair Board</h1>
        <p class="login-subtitle">Enter the reset code</p>
      </div>
      <form class="login-form" onSubmit={function(e) { e.preventDefault(); var fd = new FormData(e.target); if (fd.get('action_btn') === 'send_otp') window.actionSendOTP(e.target); else window.actionResetPassword(e.target); }}>
        <input type="hidden" name="email" value={props.email || ''} />
        <Show when={props.err}>
          <div class="login-error">{esc(props.err)}</div>
        </Show>
        <Show when={props.success}>
          <div class="login-success">
            {esc(props.success)}
          </div>
        </Show>
        <h2>Reset Password</h2>
        <p style="color:#666;font-size:14px;margin-bottom:12px">Code sent to {esc(props.email || '')}</p>
        <div class="form-group">
          <label>Verification Code</label>
          <div class="otp-wrap">
            <input type="number" name="otp" class="otp-input" placeholder="000000" autocomplete="one-time-code" maxlength="6" />
            <div class="otp-slots"><span></span><span></span><span></span><span></span><span></span><span></span></div>
          </div>
        </div>
        <div class="form-group">
          <label>New Password</label>
          <input type="password" name="password" required minlength="4" placeholder="New password" />
        </div>
        <div style="display:flex;gap:8px">
          <button type="submit" name="action_btn" value="send_otp" class="btn-secondary">Resend Code</button>
          <button type="submit" name="action_btn" value="reset_password" class="btn-primary">Reset</button>
        </div>
      </form>
      <p class="login-toggle"><a href="?route=login">Back to login</a></p>
    </div>
  );
}
