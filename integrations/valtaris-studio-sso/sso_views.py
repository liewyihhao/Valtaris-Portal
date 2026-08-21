"""Valtaris Studio SSO — trust login tokens minted by the Valtaris Portal.

The Portal is the single identity provider. It only mints a token for an
annotator who passed the eligibility gate (approved + passed exam + agreements
+ tax + KYC + not suspended), so a failed-exam user never reaches Studio.

Drop this into the Valtaris-Studio fork as a small app (see README.md). It adds:
  GET  /sso/login          — consume a Portal token, log the user in
  POST /api/valtaris/set-active — Portal-driven revocation (secret-gated)
"""

import os
import time

from django.contrib.auth import get_user_model, login
from django.http import HttpResponseForbidden, JsonResponse
from django.shortcuts import redirect
from django.views.decorators.csrf import csrf_exempt

from .sso_jwt import verify_jwt

User = get_user_model()

SSO_SECRET = os.environ.get("STUDIO_SSO_SECRET", "")
REVOKE_SECRET = os.environ.get("VALTARIS_REVOKE_SECRET", SSO_SECRET)


def _get_or_create_user(email: str, portal_user_id: str):
    """Create an SSO-only user (no usable password). LS-specific wiring —
    attaching to an organization — is flagged in the README."""
    user, created = User.objects.get_or_create(
        email=email, defaults={"username": email} if _has_field("username") else {}
    )
    if created:
        user.set_unusable_password()  # SSO-only; there is no Studio password
    # Store the Portal id if the user model / a profile has a place for it.
    if _has_field("valtaris_portal_id"):
        setattr(user, "valtaris_portal_id", portal_user_id)
    user.is_active = True
    user.save()
    # NOTE (LS-specific): Community Edition users belong to an Organization.
    # On first login attach the user to the single CE org, e.g.:
    #   from organizations.models import Organization
    #   org = Organization.objects.first()
    #   if org and user.active_organization_id is None:
    #       org.add_user(user); user.active_organization = org; user.save()
    return user


def _has_field(name: str) -> bool:
    try:
        User._meta.get_field(name)
        return True
    except Exception:
        return False


def sso_login(request):
    token = request.GET.get("token", "")
    if not SSO_SECRET:
        return HttpResponseForbidden("SSO not configured")
    claims = verify_jwt(token, SSO_SECRET)
    if not claims or not claims.get("email"):
        return HttpResponseForbidden("Invalid or expired SSO token")

    user = _get_or_create_user(claims["email"], claims.get("sub", ""))
    if not user.is_active:
        return HttpResponseForbidden("Access revoked")
    # Label Studio configures multiple auth backends — name the one to use.
    login(request, user, backend="django.contrib.auth.backends.ModelBackend")
    # LS's InactivitySessionTimeoutMiddleWare logs out any session missing
    # 'last_login' (treats it as expired) — set it as LS's own login does.
    request.session["last_login"] = time.time()
    return redirect(request.GET.get("next") or "/projects/")


@csrf_exempt
def set_active(request):
    """Portal-driven revocation/restore. Secret-gated; body {email, active}."""
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)
    if request.headers.get("X-Valtaris-Secret") != REVOKE_SECRET:
        return JsonResponse({"error": "unauthorized"}, status=401)
    import json

    try:
        body = json.loads(request.body or "{}")
    except Exception:
        return JsonResponse({"error": "bad json"}, status=400)
    email = body.get("email")
    active = bool(body.get("active", False))
    updated = User.objects.filter(email=email).update(is_active=active)
    return JsonResponse({"ok": True, "updated": updated})
