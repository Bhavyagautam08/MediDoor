# MediDoor

MediDoor contains a React/Vite web admin, two Expo apps, Firebase Cloud
Functions, and a static marketing site.

## Local configuration

Copy each `.env.example` to `.env` (or `.env.local` where appropriate) and
fill in values from the Firebase project and service providers. Do not commit
environment files, `google-services.json`, or built APKs.

- Root web admin: copy `.env.example` to `.env.local`.
- Customer/pharmacy/delivery app: copy `medidoor_users_app/.env.example` to
  `medidoor_users_app/.env`.
- Mobile admin app: copy `medidoor_admin_app/.env.example` to
  `medidoor_admin_app/.env`.
- Cloud Functions: copy `functions/.env.example` to `functions/.env` for local
  development. Run the payment test with `node --env-file=.env test.cjs` from
  the `functions` directory. Configure production payment secrets with
  Firebase Secret Manager rather than committing them.

All values in the example files are intentionally fake placeholders and will
not authenticate to any service. Replace them only in ignored local
environment files or deployment secret settings. Firebase client configuration
and `EXPO_PUBLIC_*` values are embedded in app builds; they are identifiers,
not secret storage. Restrict client API keys and enforce access with Firebase
Security Rules.

The mobile admin currently creates an Auth account after a failed sign-in and
then writes a `platformAdmins` profile. The Firestore rules also permit
authenticated users to write their own `platformAdmins` document. Replace this
development/demo provisioning flow with trusted admin provisioning and
restrict the corresponding rules before production use.

The OTP Cloud Functions currently read their provider settings from Firestore
document `settings/otp_config`, not from environment variables. The expected
fields are shown as a commented example in `functions/.env.example`; configure
real values securely and restrict who can read or update that document.

The browser admin's mock login uses the `VITE_DEMO_ADMIN_*` values only during
Vite development; it is not an authentication mechanism and must not be used
as production access control. The mobile admin login does not prefill a
username or password.

## Development commands

- Root web admin: `npm run dev`, `npm run build`, `npm run lint`
- Customer app: from `medidoor_users_app`, run `npm start`
- Mobile admin: from `medidoor_admin_app`, run `npm start`
- Functions emulator: from `functions`, run `npm run serve`
- Marketing site: from `medidoor-website`, run `npm run dev`

## Deployment

Firebase deployment configuration is in `firebase.json`. Hosting currently
serves `medidoor_admin_app/dist`; Firestore rules and indexes, Storage rules,
and Functions are also configured there.
