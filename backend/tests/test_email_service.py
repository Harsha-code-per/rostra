from unittest.mock import MagicMock, patch

from app.services.email_service import EmailService

CFG = dict(host="smtp.test", port=587, user="login", password="s3cret-key", sender="hello@rostra.test")


def _invite(service, **kw):
    return service.send_invitation_email(
        to_email=kw.get("to", "sarah@example.com"),
        recipient_name=kw.get("name", "Sarah"),
        company_name=kw.get("company", "Acme Corp"),
        role="HR",
        activation_link="https://app.test/force-password-reset",
    )


def test_simulated_when_smtp_not_configured():
    res = _invite(EmailService(host="smtp.test", port=587, user="", password="", sender=""))
    assert res["status"] == "simulated"
    assert "Acme Corp" in res["subject"]


@patch("app.services.email_service.smtplib.SMTP")
def test_sends_html_over_starttls(smtp_cls):
    smtp = smtp_cls.return_value.__enter__.return_value
    res = _invite(EmailService(**CFG))
    assert res["status"] == "sent"
    smtp.starttls.assert_called_once()
    smtp.login.assert_called_once_with("login", "s3cret-key")
    msg = smtp.send_message.call_args[0][0]
    assert msg["To"] == "sarah@example.com"
    assert "hello@rostra.test" in msg["From"]
    assert "Acme Corp" in msg["Subject"]
    assert "https://app.test/force-password-reset" in msg.get_body(("html",)).get_content()


@patch("app.services.email_service.smtplib.SMTP")
def test_html_escapes_user_supplied_text(smtp_cls):
    smtp = smtp_cls.return_value.__enter__.return_value
    _invite(EmailService(**CFG), name="<script>x</script>", company="A&B")
    html = smtp.send_message.call_args[0][0].get_body(("html",)).get_content()
    assert "<script>" not in html and "A&amp;B" in html


@patch("app.services.email_service.smtplib.SMTP")
def test_failure_is_reported_and_password_redacted(smtp_cls):
    smtp_cls.return_value.__enter__.return_value.login.side_effect = Exception("535 bad login s3cret-key")
    res = _invite(EmailService(**CFG))
    assert res["status"] == "failed"
    assert "s3cret-key" not in res["error"] and "***REDACTED***" in res["error"]


@patch("app.services.email_service.smtplib.SMTP")
def test_inquiry_notification_replies_to_the_requester_and_ignores_header_injection(smtp_cls):
    smtp = smtp_cls.return_value.__enter__.return_value
    res = EmailService(**CFG).send_inquiry_notification(
        "owner@rostra.test", "Evil\r\nBcc: x@y.z", "Jo", "jo@acme.test", None, "25-50", "Growth", "hello <b>there</b>"
    )
    assert res["status"] == "sent"
    msg = smtp.send_message.call_args[0][0]
    assert msg["Reply-To"] == "jo@acme.test"
    assert msg["Bcc"] is None
    assert "<b>there</b>" not in msg.get_body(("html",)).get_content()


def test_send_in_background_runs_inline_without_smtp():
    done = MagicMock()
    EmailService(host="h", port=1, user="", password="", sender="").send_in_background(done, a=1)
    done.assert_called_once_with(a=1)
