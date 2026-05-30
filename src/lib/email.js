export async function sendOTPEmail(email, otp, subject) {
  try {
    var res = await fetch('/.netlify/functions/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Flair Board <onboarding@resend.dev>',
        to: email,
        subject: subject || 'Flair Board Verification',
        html: 'Your Code #: ' + otp,
      }),
    });
    var data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || 'Email send failed (HTTP ' + res.status + ')' };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'Network error sending email' };
  }
}
