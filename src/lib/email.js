export function sendOTPEmail(email, otp, subject) {
  fetch('/api/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Flair Board <onboarding@resend.dev>',
      to: email,
      subject: subject || 'Flair Board Verification',
      html: 'Your Code #: ' + otp,
    }),
  }).catch(function(e) { console.error('Email send failed', e); });
}
