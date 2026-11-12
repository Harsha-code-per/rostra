import logging
from typing import Dict, Any, Optional
import resend

from app.config import settings

import re

logger = logging.getLogger("rostra.email")


def _sanitize_msg(msg: Any) -> str:
    s = str(msg)
    s = re.sub(r"Bearer\s+[^\s]+", "Bearer ***REDACTED***", s, flags=re.IGNORECASE)
    s = re.sub(r"re_[a-zA-Z0-9_]+", "re_***REDACTED***", s)
    return s


class EmailService:
    def __init__(self, api_key: Optional[str] = None, sender_email: Optional[str] = None):
        self.api_key = settings.RESEND_API_KEY if api_key is None else api_key
        self.sender = settings.EMAIL_FROM if sender_email is None else sender_email
        if self.api_key:
            resend.api_key = self.api_key

    def send_invitation_email(
        self,
        to_email: str,
        recipient_name: str,
        company_name: str,
        role: str,
        activation_link: str,
    ) -> Dict[str, Any]:
        """
        Sends a secure onboarding invitation email via Resend with a secure one-time activation link.
        """
        subject = f"Welcome to {company_name} on Rostra — Activate Your Account"
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 20px; }}
            .container {{ max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }}
            .header {{ background: #0891b2; padding: 32px 24px; text-align: center; color: #ffffff; }}
            .header h1 {{ margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }}
            .content {{ padding: 32px 24px; }}
            .greeting {{ font-size: 16px; font-weight: 600; margin-bottom: 12px; }}
            .message {{ font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px; }}
            .badge {{ display: inline-block; padding: 4px 12px; background: #ecfeff; border: 1px solid #cffafe; border-radius: 9999px; color: #0891b2; font-weight: 600; font-size: 12px; margin-bottom: 16px; }}
            .cta-container {{ text-align: center; margin: 32px 0; }}
            .cta-button {{ display: inline-block; background: #0891b2; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 600; font-size: 14px; box-shadow: 0 2px 4px rgba(8,145,178,0.2); }}
            .notice {{ font-size: 12px; color: #94a3b8; line-height: 1.5; border-top: 1px solid #f1f5f9; padding-top: 16px; }}
            .footer {{ background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }}
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Rostra</h1>
            </div>
            <div class="content">
              <div class="badge">Role: {role}</div>
              <div class="greeting">Hello {recipient_name},</div>
              <p class="message">
                You have been invited to join <strong>{company_name}</strong> on Rostra.
                Your account is ready for activation. Please click the button below to set your permanent password and access your workspace.
              </p>
              <div class="cta-container">
                <a href="{activation_link}" class="cta-button" target="_blank">Activate Account & Set Password</a>
              </div>
              <div class="notice">
                <strong>Security Notice:</strong> This invitation link is personalized for your account. If you did not expect this invitation, please contact your organization administrator.
              </div>
            </div>
            <div class="footer">
              &copy; 2026 Rostra Demo Co. &bull; Enterprise HRMS Platform
            </div>
          </div>
        </body>
        </html>
        """

        if not self.api_key:
            logger.info("Resend API key not configured; simulated invitation email sent to %s", to_email)
            return {"status": "simulated", "to": to_email, "subject": subject}

        try:
            params: resend.Emails.SendParams = {
                "from": self.sender,
                "to": [to_email],
                "subject": subject,
                "html": html_content,
            }
            res = resend.Emails.send(params)
            logger.info("Invitation email dispatched via Resend to %s (id: %s)", to_email, res.get("id"))
            return res
        except Exception as exc:
            sanitized_err = _sanitize_msg(exc)
            logger.error("Failed to send invitation email via Resend to %s: %s", to_email, sanitized_err)
            return {"status": "failed", "error": sanitized_err}

    def send_password_reset_email(
        self,
        to_email: str,
        recipient_name: str,
        reset_link: str,
    ) -> Dict[str, Any]:
        """
        Sends a secure password reset email via Resend.
        """
        subject = "Reset Your Password — Rostra"
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 20px; }}
            .container {{ max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; }}
            .header {{ background: #0891b2; padding: 28px 24px; text-align: center; color: #ffffff; }}
            .header h1 {{ margin: 0; font-size: 22px; font-weight: 700; }}
            .content {{ padding: 32px 24px; }}
            .cta-container {{ text-align: center; margin: 28px 0; }}
            .cta-button {{ display: inline-block; background: #0891b2; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 600; font-size: 14px; }}
            .footer {{ background: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }}
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Rostra</h1>
            </div>
            <div class="content">
              <p>Hello {recipient_name},</p>
              <p>We received a request to reset your password for Rostra. Click the button below to choose a new password:</p>
              <div class="cta-container">
                <a href="{reset_link}" class="cta-button" target="_blank">Reset Password</a>
              </div>
              <p style="font-size: 12px; color: #94a3b8;">If you did not request a password reset, you can safely ignore this email.</p>
            </div>
            <div class="footer">
              &copy; 2026 Rostra Demo Co.
            </div>
          </div>
        </body>
        </html>
        """

        if not self.api_key:
            logger.info("Resend API key not configured; simulated password reset email sent to %s", to_email)
            return {"status": "simulated", "to": to_email, "subject": subject}

        try:
            params: resend.Emails.SendParams = {
                "from": self.sender,
                "to": [to_email],
                "subject": subject,
                "html": html_content,
            }
            res = resend.Emails.send(params)
            return res
        except Exception as exc:
            sanitized_err = _sanitize_msg(exc)
            logger.error("Failed to send password reset email via Resend to %s: %s", to_email, sanitized_err)
            return {"status": "failed", "error": sanitized_err}


email_service = EmailService()
