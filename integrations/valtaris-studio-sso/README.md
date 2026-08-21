# Valtaris Studio SSO (drop-in for the Valtaris-Studio fork)

Lets annotators use their **single Valtaris Portal login** to enter Valtaris
Studio (the Label Studio fork) — no separate password. The Portal is the
identity provider; Studio trusts a short-lived signed token the Portal mints
**only** for annotators who passed the eligibility gate (approved + passed the
qualification exam + agreements + tax + KYC + not suspended). A failed-exam user
never receives a token, so they can't enter Studio.

Label Studio Community Edition has no native SSO, so this is the intended small,
contained custom commit in the fork (keep the diff small for painless upstream
merges — see the repo-assessment doc).

## Files

| File | Role |
|---|---|
| `sso_jwt.py` | Dependency-free HS256 verify — matches the Portal's `lib/portal/jwt.ts`. |
| `sso_views.py` | `GET /sso/login` (consume token → log in) and `POST /api/valtaris/set-active` (Portal-driven revocation). |
| `sso_urls.py` | URL patterns to include. |

## Install into the fork

1. Copy this folder into the Django project as an app, e.g.
   `label_studio/valtaris_sso/` (add an empty `__init__.py`).
2. In the root `urls.py`, include it:
   ```python
   urlpatterns += [path("", include("valtaris_sso.sso_urls"))]
   ```
3. Set env on the Studio instance (the secret MUST equal the Portal's
   `STUDIO_SSO_SECRET`):
   ```
   STUDIO_SSO_SECRET=<same value as the Portal>
   VALTARIS_REVOKE_SECRET=<a second shared secret for /api/valtaris/set-active>
   LABEL_STUDIO_DISABLE_SIGNUP_WITHOUT_LINK=true
   ```
4. **Organization wiring (LS-specific):** CE users belong to an `Organization`.
   Uncomment the org-attach block in `sso_views._get_or_create_user` and adapt
   it to your instance (single-org CE: attach to `Organization.objects.first()`).
5. Optionally add a `valtaris_portal_id` field (or a small profile model) to
   store the Portal user id; the view sets it if present.

## Flow

```
Annotator → Portal /api/studio/sso
  Portal checks studioEligible(user)         ← the exam gate lives here
  eligible → mint HS256 JWT {sub,email,exp≈2min,jti}
           → 302 to  STUDIO/sso/login?token=…
  Studio /sso/login verifies token → get_or_create user (unusable password)
           → is_active=True → login() → /projects/
  ineligible → Portal 302 back to /dashboard?studio=blocked&reason=…
```

## Revocation

The Portal calls `POST /api/valtaris/set-active` (header `X-Valtaris-Secret`,
body `{email, active:false}`) when an annotator is suspended / fails recert /
is confirmed fraudulent / has a tax-KYC lapse. Combined with the 2-minute token
TTL (a fresh token can't be minted for an ineligible user), access dies fast.

## Security notes

- Tokens are short-lived (2 min) and carry a `jti`; add a replay cache if you
  want strict single-use.
- Rotate `STUDIO_SSO_SECRET` periodically (update both sides together).
- Serve everything over HTTPS in production.
- `set_unusable_password()` means Studio has no independent credential — the
  Portal is the only place a password exists.
