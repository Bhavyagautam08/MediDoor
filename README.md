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
  development. Configure production payment secrets with Firebase Secret
  Manager rather than committing them.

Firebase client configuration is included in web/mobile bundles at build time;
restrict Firebase and Google Maps API keys to the required apps and APIs.

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
