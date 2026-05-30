import { Show } from 'solid-js';
import { esc } from '../lib/utils';
import { pagePropsSig } from '../App';

export default function VerifyPage() {
  var p = pagePropsSig;
  return (
    <div class="login-container">
      <div class="login-logo">
        <div class="login-flair-icon">📌</div>
        <h1>Flair Board</h1>
        <p class="login-subtitle">Check your email</p>
      </div>
      <form class="login-form" onSubmit={function(e) { e.preventDefault(); var fd = new FormData(e.target); if (fd.get('action_btn') === 'send_otp') window.actionSendOTP(e.target); else window.actionVerifyOTP(e.target); }}>
        <input type="hidden" name="action" value="verify_otp" />
        <input type="hidden" name="email" value={p().email || ''} />
        <Show when={p().err}>
          <div class="login-error">{esc(p().err)}</div>
        </Show>
        <Show when={p().success}>
          <div class="login-success">
            {esc(p().success)}
          </div>
        </Show>
        <Show when={p().otp}>
          <div style="background:#1a1a1a;color:#0f0;padding:8px 12px;border-radius:6px;font-family:monospace;font-size:18px;text-align:center;letter-spacing:4px;margin-bottom:10px">
            DEV: {esc(p().otp)}
          </div>
        </Show>
        <h2>Verify Email</h2>
        <p style="color:#666;font-size:14px;margin-bottom:12px">Code sent to {esc(p().email || '')}</p>
        <div class="form-group">
          <label>Verification Code</label>
          <div class="otp-wrap">
            <input type="number" name="otp" class="otp-input" placeholder="000000" autocomplete="one-time-code" maxlength="6" />
            <div class="otp-slots"><span></span><span></span><span></span><span></span><span></span><span></span></div>
          </div>
        </div>
        <div style="display:flex;gap:8px">
          <button type="submit" name="action_btn" value="send_otp" class="btn-secondary">Resend Code</button>
          <button type="submit" class="btn-primary">Verify</button>
        </div>
      </form>
      <p class="login-toggle"><a href="?route=login">Back to login</a></p>
    </div>
  );
}
