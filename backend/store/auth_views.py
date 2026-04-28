from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .auth_serializers import (
    AuthResponseSerializer,
    LoginSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    SignupSerializer,
    UserSerializer,
)


User = get_user_model()


def build_password_reset_html(reset_url: str) -> str:
        return f"""
<!doctype html>
<html>
    <body style=\"margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;color:#18181b;\">
        <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"padding:24px 0;\">
            <tr>
                <td align=\"center\">
                    <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width:560px;background:#ffffff;border-radius:16px;border:1px solid #e4e4e7;overflow:hidden;\">
                        <tr>
                            <td style=\"padding:24px 28px;background:#18181b;color:#ffffff;\">
                                <h1 style=\"margin:0;font-size:22px;line-height:1.3;\">Reset Your Password</h1>
                            </td>
                        </tr>
                        <tr>
                            <td style=\"padding:28px;\">
                                <p style=\"margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#3f3f46;\">
                                    We received a request to reset your password. Click the button below to set a new one.
                                </p>
                                <p style=\"margin:24px 0;\">
                                    <a href=\"{reset_url}\" style=\"display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:999px;font-size:14px;font-weight:600;\">Reset Password</a>
                                </p>
                                <p style=\"margin:0 0 8px 0;font-size:13px;color:#52525b;\">If the button does not work, copy this link:</p>
                                <p style=\"margin:0 0 20px 0;font-size:13px;word-break:break-all;color:#18181b;\">{reset_url}</p>
                                <p style=\"margin:0;font-size:13px;line-height:1.6;color:#71717a;\">
                                    If you did not request this, you can safely ignore this email.
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
</html>
"""


class HealthCheckView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({'status': 'ok'})


class SignupView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(AuthResponseSerializer.for_user(user), status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data)


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email'].strip().lower()

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            reset_url = f"{settings.PASSWORD_RESET_FRONTEND_URL}?uid={uid}&token={token}"

            send_mail(
                subject='Reset your password',
                message=(
                    'We received a password reset request for your account.\n\n'
                    f'Use this link to reset your password:\n{reset_url}\n\n'
                    'If you did not request this, you can ignore this email.'
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                html_message=build_password_reset_html(reset_url),
                fail_silently=True,
            )

        response_data = {
            'detail': 'If an account exists for this email, a password reset link has been sent.'
        }
        if settings.DEBUG and settings.PASSWORD_RESET_EXPOSE_TOKEN and user:
            response_data['debug'] = {
                'uid': uid,
                'token': token,
                'reset_url': reset_url,
            }

        return Response(response_data, status=status.HTTP_200_OK)


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        uid = serializer.validated_data['uid']
        token = serializer.validated_data['token']
        new_password = serializer.validated_data['new_password']

        try:
            user_id = urlsafe_base64_decode(uid).decode()
            user = User.objects.get(pk=user_id, is_active=True)
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            return Response({'detail': 'Invalid or expired reset link.'}, status=status.HTTP_400_BAD_REQUEST)

        if not default_token_generator.check_token(user, token):
            return Response({'detail': 'Invalid or expired reset link.'}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save(update_fields=['password'])
        return Response({'detail': 'Password reset successful.'}, status=status.HTTP_200_OK)
