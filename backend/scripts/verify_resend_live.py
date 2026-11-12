"""
Controlled verification script for live Resend delivery.
Usage:
    uv run python scripts/verify_resend_live.py [recipient_email] [optional_api_key]
"""
import sys
import os

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.config import settings
from app.services.email_service import EmailService


def main():
    recipient = sys.argv[1] if len(sys.argv) > 1 else "delivered@resend.dev"
    api_key = sys.argv[2] if len(sys.argv) > 2 else (os.getenv("RESEND_API_KEY") or settings.RESEND_API_KEY)
    sender = os.getenv("EMAIL_FROM") or settings.EMAIL_FROM or "onboarding@resend.dev"

    if not api_key:
        print("⚠️ No RESEND_API_KEY provided in environment or .env. Running in simulated fallback mode.")
    else:
        masked = f"re_***{api_key[-4:]}" if len(api_key) > 6 else "***"
        print(f"🔑 Using RESEND_API_KEY: {masked}")

    service = EmailService(api_key=api_key, sender_email=sender)

    print(f"📧 Sending test onboarding invitation email to: {recipient}")
    res_invitation = service.send_invitation_email(
        to_email=recipient,
        recipient_name="Test Verification User",
        company_name="Rostra Demo Co.",
        role="HR",
        activation_link="http://localhost:3000/force-password-reset",
    )
    print(f"Invitation Email Result: {res_invitation}")

    print(f"📧 Sending test password reset email to: {recipient}")
    res_reset = service.send_password_reset_email(
        to_email=recipient,
        recipient_name="Test Verification User",
        reset_link="http://localhost:3000/force-password-reset",
    )
    print(f"Password Reset Result: {res_reset}")


if __name__ == "__main__":
    main()
