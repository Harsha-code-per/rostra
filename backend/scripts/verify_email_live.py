"""Send one real password-reset email with the configured SMTP settings.

Usage: uv run python scripts/verify_email_live.py you@example.com
Reads SMTP_USER, SMTP_PASSWORD, EMAIL_FROM (and optionally SMTP_HOST/SMTP_PORT) from the environment or .env.
"""
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.email_service import email_service  # noqa: E402

if not email_service.configured:
    sys.exit("Set BREVO_API_KEY (or SMTP_USER and SMTP_PASSWORD) and EMAIL_FROM first.")
to = sys.argv[1] if len(sys.argv) > 1 else sys.exit("Usage: verify_email_live.py <recipient>")
result = email_service.send_password_reset_email(to, "Test", "https://example.com/reset-password?token=test")
print(result)
sys.exit(0 if result["status"] == "sent" else 1)
