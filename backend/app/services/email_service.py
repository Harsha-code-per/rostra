"""Transactional email over SMTP (Brevo's relay by default; any SMTP server works)."""
import logging
import re
import smtplib
import ssl
from concurrent.futures import ThreadPoolExecutor
from email.message import EmailMessage
from html import escape
from typing import Any, Callable, Dict, Optional

from app.config import settings

logger = logging.getLogger("rostra.email")

_pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="mail")


def _one_line(value: Any) -> str:
    """Header-safe text: no line breaks, so user input cannot add headers."""
    return re.sub(r"\s+", " ", str(value)).strip()


def _layout(title: str, body: str, button: Optional[tuple] = None) -> str:
    cta = (
        f'<p style="text-align:center;margin:28px 0"><a href="{escape(button[1], quote=True)}" '
        'style="display:inline-block;background:#10113a;color:#ffffff;text-decoration:none;'
        f'padding:13px 26px;border-radius:999px;font-weight:600;font-size:14px">{escape(button[0])}</a></p>'
        if button
        else ""
    )
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f4f5ff;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#10113a">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dfe1fb;border-radius:20px;overflow:hidden">
    <div style="background:#3b3bf2;padding:26px 28px;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.4px">Rostra</div>
    <div style="padding:28px;font-size:15px;line-height:1.6">
      <h1 style="margin:0 0 14px;font-size:20px;letter-spacing:-0.3px">{escape(title)}</h1>
      {body}{cta}
    </div>
    <div style="padding:16px 28px;background:#f4f5ff;color:#5b5c8a;font-size:12px">Rostra. Attendance, leave and payroll in one workspace.</div>
  </div>
</body></html>"""


class EmailService:
    def __init__(
        self,
        host: Optional[str] = None,
        port: Optional[int] = None,
        user: Optional[str] = None,
        password: Optional[str] = None,
        sender: Optional[str] = None,
        sender_name: Optional[str] = None,
    ):
        self.host = settings.SMTP_HOST if host is None else host
        self.port = settings.SMTP_PORT if port is None else port
        self.user = settings.SMTP_USER if user is None else user
        self.password = settings.SMTP_PASSWORD if password is None else password
        self.sender = settings.EMAIL_FROM if sender is None else sender
        self.sender_name = settings.EMAIL_FROM_NAME if sender_name is None else sender_name

    @property
    def configured(self) -> bool:
        return bool(self.user and self.password and self.sender)

    def _redact(self, msg: Any) -> str:
        s = str(msg)
        return s.replace(self.password, "***REDACTED***") if self.password else s

    def _send(self, to: str, subject: str, html: str, reply_to: Optional[str] = None) -> Dict[str, Any]:
        subject = _one_line(subject)
        if not self.configured:
            logger.info("SMTP not configured; simulated email to %s (%s)", to, subject)
            return {"status": "simulated", "to": to, "subject": subject}
        try:
            msg = EmailMessage()
            msg["From"] = f"{_one_line(self.sender_name)} <{self.sender}>"
            msg["To"] = to
            msg["Subject"] = subject
            if reply_to:
                msg["Reply-To"] = reply_to
            msg.set_content("Open this email in an HTML-capable mail app.")
            msg.add_alternative(html, subtype="html")
            with smtplib.SMTP(self.host, self.port, timeout=15) as smtp:
                smtp.starttls(context=ssl.create_default_context())
                smtp.login(self.user, self.password)
                smtp.send_message(msg)
            logger.info("Email sent to %s (%s)", to, subject)
            return {"status": "sent", "to": to, "subject": subject}
        except Exception as exc:
            err = self._redact(exc)
            logger.error("Failed to send email to %s: %s", to, err)
            return {"status": "failed", "error": err}

    def send_in_background(self, fn: Callable[..., Any], **kwargs: Any) -> None:
        """Run one of the send_* methods without making the request wait for the mail server.

        With no SMTP configured there is nothing slow to wait for, so it runs inline (also keeps tests deterministic).
        """
        if self.configured:
            _pool.submit(fn, **kwargs)
        else:
            fn(**kwargs)

    def send_invitation_email(self, to_email: str, recipient_name: str, company_name: str, role: str, activation_link: str) -> Dict[str, Any]:
        body = (
            f"<p>Hello {escape(recipient_name)},</p>"
            f"<p>You have been added to <strong>{escape(company_name)}</strong> on Rostra as <strong>{escape(role)}</strong>. "
            "Sign in with the temporary password your administrator gave you, then choose your own.</p>"
            '<p style="font-size:12px;color:#5b5c8a">If you did not expect this, contact your organization administrator.</p>'
        )
        return self._send(
            to_email,
            f"Welcome to {company_name} on Rostra",
            _layout("You are in", body, ("Sign in to Rostra", activation_link)),
        )

    def send_password_reset_email(self, to_email: str, recipient_name: str, reset_link: str) -> Dict[str, Any]:
        body = (
            f"<p>Hello {escape(recipient_name)},</p>"
            f"<p>We received a request to reset your Rostra password. The link works once and expires in {settings.RESET_TOKEN_EXPIRE_MINUTES} minutes.</p>"
            '<p style="font-size:12px;color:#5b5c8a">If you did not ask for this, ignore this email. Your password stays the same.</p>'
        )
        return self._send(to_email, "Reset your Rostra password", _layout("Reset your password", body, ("Choose a new password", reset_link)))

    def send_inquiry_notification(
        self, to_email: str, company: str, contact: str, email: str, phone: Optional[str], team_size: str, plan: str, message: Optional[str]
    ) -> Dict[str, Any]:
        rows = [("Company", company), ("Contact", contact), ("Email", email), ("Phone", phone or "-"), ("Team size", team_size), ("Plan", plan)]
        table = "".join(
            f'<tr><td style="padding:6px 16px 6px 0;color:#5b5c8a">{escape(k)}</td><td style="padding:6px 0"><strong>{escape(_one_line(v))}</strong></td></tr>'
            for k, v in rows
        )
        note = f'<p style="white-space:pre-wrap;background:#f4f5ff;border-radius:12px;padding:14px">{escape(message)}</p>' if message else ""
        html = _layout("New workspace request", f'<table style="border-collapse:collapse;font-size:14px">{table}</table>{note}'
                       '<p style="font-size:12px;color:#5b5c8a">Reply to this email to answer them directly.</p>')
        return self._send(to_email, f"New workspace request: {company}", html, reply_to=email)


email_service = EmailService()
