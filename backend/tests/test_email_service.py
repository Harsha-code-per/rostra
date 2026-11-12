from unittest.mock import patch
from app.services.email_service import EmailService


def test_email_service_simulated_mode_when_no_api_key():
    service = EmailService(api_key="", sender_email="test@resend.dev")
    res = service.send_invitation_email(
        to_email="newuser@example.com",
        recipient_name="John Doe",
        company_name="Acme Corp",
        role="HR",
        activation_link="http://localhost:3000/force-password-reset",
    )
    assert res["status"] == "simulated"
    assert res["to"] == "newuser@example.com"
    assert "Acme Corp" in res["subject"]


@patch("resend.Emails.send")
def test_send_invitation_email_with_resend_mock(mock_send):
    mock_send.return_value = {"id": "msg_123456"}

    service = EmailService(api_key="re_mock_api_key_123", sender_email="onboarding@demo.example.com")
    res = service.send_invitation_email(
        to_email="sarah.hr@demo.example.com",
        recipient_name="Sarah Jenkins",
        company_name="Rostra Demo Co.",
        role="HR",
        activation_link="https://app.rostra.io/force-password-reset",
    )

    assert res == {"id": "msg_123456"}
    mock_send.assert_called_once()
    call_args = mock_send.call_args[0][0]
    assert call_args["to"] == ["sarah.hr@demo.example.com"]
    assert call_args["from"] == "onboarding@demo.example.com"
    assert "Rostra Demo Co." in call_args["subject"]
    assert "Sarah Jenkins" in call_args["html"]
    assert "https://app.rostra.io/force-password-reset" in call_args["html"]


@patch("resend.Emails.send")
def test_send_password_reset_email_with_resend_mock(mock_send):
    mock_send.return_value = {"id": "msg_reset_999"}

    service = EmailService(api_key="re_mock_api_key_123", sender_email="security@demo.example.com")
    res = service.send_password_reset_email(
        to_email="alex.rivera@demo.example.com",
        recipient_name="Alex Rivera",
        reset_link="https://app.rostra.io/reset-password?token=secret123",
    )

    assert res == {"id": "msg_reset_999"}
    mock_send.assert_called_once()
    call_args = mock_send.call_args[0][0]
    assert call_args["to"] == ["alex.rivera@demo.example.com"]
    assert "Reset Your Password" in call_args["subject"]
    assert "https://app.rostra.io/reset-password?token=secret123" in call_args["html"]


@patch("resend.Emails.send")
def test_email_service_handles_resend_failure_gracefully(mock_send):
    mock_send.side_effect = Exception("Resend API rate limit exceeded")

    service = EmailService(api_key="re_mock_api_key_123", sender_email="onboarding@demo.example.com")
    res = service.send_invitation_email(
        to_email="fail@example.com",
        recipient_name="Fail User",
        company_name="Acme Corp",
        role="EMPLOYEE",
        activation_link="https://app.rostra.io/force-password-reset",
    )

    assert res["status"] == "failed"
    assert "rate limit exceeded" in res["error"]


@patch("resend.Emails.send")
def test_email_service_masks_secret_in_error(mock_send):
    mock_send.side_effect = Exception("Authorization error: Bearer re_fake_secret_key_12345 invalid")

    service = EmailService(api_key="re_mock_api_key_123", sender_email="onboarding@demo.example.com")
    res = service.send_invitation_email(
        to_email="secret_test@example.com",
        recipient_name="Secret Test",
        company_name="Acme Corp",
        role="EMPLOYEE",
        activation_link="https://app.rostra.io/force-password-reset",
    )

    assert res["status"] == "failed"
    assert "re_fake_secret_key_12345" not in res["error"]
    assert "***REDACTED***" in res["error"]
