# Stats Maker R24 P2 — Supabase Auth Setup

> **R24 P3 status:** Deferred for the formal anonymous-first release. Google / Apple OAuth is optional future functionality for account recovery / multi-device sync and is not required to publish or participate in Community.


## Production URLs

Stats Maker:
`https://izu48625.github.io/goblin-prototype/`

My Page OAuth return:
`https://izu48625.github.io/goblin-prototype/my.html`

Supabase project:
`https://ibpdxbeltdwkquowjeay.supabase.co`

OAuth provider callback:
`https://ibpdxbeltdwkquowjeay.supabase.co/auth/v1/callback`

## Supabase Auth

Authentication > URL Configuration:

- Site URL:
  `https://izu48625.github.io/goblin-prototype/`
- Redirect URL:
  `https://izu48625.github.io/goblin-prototype/my.html`

Authentication configuration:

- Anonymous Sign-Ins: enabled
- Manual Linking: enabled
- Google provider: enable after Client ID / Client Secret are entered
- Apple provider: enable after Services ID / secret are entered

Do not add any provider secret to GitHub or browser JavaScript.

## Google

Create a Web OAuth client in Google Auth Platform.

Authorized JavaScript origin:

`https://izu48625.github.io`

Authorized redirect URI:

`https://ibpdxbeltdwkquowjeay.supabase.co/auth/v1/callback`

Copy the resulting Client ID and Client Secret into the Supabase Google provider configuration.

## Apple

For the Supabase web OAuth flow:

1. Create / configure an App ID with Sign in with Apple.
2. Create a Services ID attached to that App ID.
3. Configure the Services ID website domain as:
   `ibpdxbeltdwkquowjeay.supabase.co`
4. Configure its return URL as:
   `https://ibpdxbeltdwkquowjeay.supabase.co/auth/v1/callback`
5. Create an Apple signing key and generate the Apple client secret.
6. Enter the Services ID and generated secret in the Supabase Apple provider configuration.

Never commit the Apple .p8 key or generated provider secret.

## Runtime QA

My Page R24 P2 checks the public Auth settings endpoint and reports whether Google and Apple are enabled.

Guest account QA:

1. Publish one test work as a guest.
2. Open My Page and confirm the guest work is visible.
3. Link Google or Apple.
4. Return to My Page.
5. R24 P2 verifies that the Supabase user ID is unchanged.
6. Confirm the same owned work is still visible.
7. Confirm the account is no longer anonymous.

If the ID changes, My Page raises an ownership-continuity warning and does not treat the guest work as transferred.

## Safety

Anonymous users must not sign out before linking a permanent identity. R24 P2 hides Sign Out for anonymous users because a signed-out anonymous account cannot be recovered as the same user.

The app remains Local-first. Creating and editing local sheets never requires an account.
