# Smart Waste - Web app (React + Vite)

One web app with three role-specific portals backed by the Django/DRF API and PostgreSQL:

- **Household portal** - `/household`
- **Authority dashboard** - `/authority`
- **Hub operator portal** - `/hub`

Accounts sign in with email/password or Google, and households/authorities can register
from their portal. The server routes each account to the correct dashboard.

## Run it

PostgreSQL is a portable install at `%USERPROFILE%\waste-pg`; start it once per login.

Backend (terminal 1):
```bash
cd waste-backend/backend
scripts\start-postgres.cmd
.venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Web app (terminal 2):
```bash
cd waste-dashboard/waste-dashboard
npm install
npm run dev
```

Open **http://localhost:5173** and choose a portal. Django must be running and
`backend/.env` must list the dashboard under `CORS_ALLOWED_ORIGINS`.

## Sign-in and registration

- **Email + password** - use the form on any portal. The same form also accepts a phone
  number for legacy accounts.
- **Google** - click "Continue with Google". A first-time Google sign-in creates a
  household or authority account depending on which portal was used. Later sign-ins
  match the Google account to the existing user.
- **Registration** - switch to "Register" in the household or authority portal. An
  authority account needs an official email address; a household account needs a home
  address.
- **Role routing** - the household portal only accepts household accounts, the authority
  portal accepts authority/admin accounts, and the hub portal accepts hub operators. A
  mismatched account is signed out with a link to the right portal.

Hub operator accounts are created by an admin in Django `/admin/`; they cannot
self-register. Google sign-in needs a client id (see below).

### Enable Google sign-in

1. In Google Cloud Console create an OAuth client of type **Web application**.
2. Add `http://localhost:5173` and `http://127.0.0.1:5173` as authorized JavaScript
   origins.
3. Set `GOOGLE_CLIENT_ID=...` in `waste-backend/backend/.env` and restart Django.

The frontend reads the client id from `/api/auth/config/`. Until it is set, the Google
button explains that Google login is not configured; email/password still works.

## Existing data

The former SQLite contents were migrated to PostgreSQL (`waste_db`): users, pickups,
collections, hubs, intakes, reports, rewards, bins and readings. Uploaded report photos
remain in `waste-backend/backend/media/`. The old `db.sqlite3` is retained as a backup.

The migrated development accounts still exist and sign in with their phone number
(password `demo1234`):

| Phone | Role | Portal |
|---|---|---|
| `0700000002` | Authority | `/authority` |
| `0700000001` | Hub operator | `/hub` |
| `0700000200` | Household ("Household 1") | `/household` |

These are optional legacy accounts; new accounts register through the portals. Running
`python manage.py seed_demo` again is not required.

## What each role can do

- **Household** - request and cancel pickups, watch the smart bin fill level, see reward
  points, report illegal dumping with a photo and GPS location, edit profile and set a
  password (Google/USSD accounts can set one here).
- **Authority** - KPIs, charts, live pickup map, filter pickups, triage illegal-dumping
  reports (open / in progress / resolved), and review hub activity.
- **Hub operator** - see collected pickups, log each waste type delivered to the hub,
  review what was received. Operators only see their own hub.

## Deploy (GitHub Pages + Render)

The Pages workflow builds the app for the repository subpath
`https://giturodaniel001-bolt.github.io/smart-waste-web/`. It sets `VITE_BASE`,
copies `index.html` to `404.html` for deep links, and uses the repository variable
`VITE_API_URL` as the backend origin.

1. Deploy the backend from the `smart-waste-api` repository first (see its
   `README.md` and `render.yaml`).
2. In this repository go to **Settings → Secrets and variables → Actions →
   Variables** and add `VITE_API_URL` with the Render URL, for example
   `https://smart-waste-api-giturodaniel001.onrender.com`.
3. Go to **Settings → Pages → Build and deployment** and set the source to
   **GitHub Actions**.
4. Push to `main` (or run the workflow manually). The first deploy publishes at
   the project URL above.
5. Add `https://giturodaniel001-bolt.github.io` to the OAuth client's
   **Authorized JavaScript origins**.

A custom domain needs `VITE_BASE=/` in the workflow, a `public/CNAME` file, and
the custom origin added to Google and to the backend's CORS settings.

## Production notes

This is a working prototype, not a hardened deployment. Before going live, add email
verification and password reset, restrict authority self-registration (invite code or
approval), use a managed PostgreSQL instance and serve the SPA/API over HTTPS. Set a
strong `SECRET_KEY` and real database credentials, and keep `DJANGO_DEBUG=0`. The
Pages 404 fallback handles portal URLs on refresh; Render terminates HTTPS for the API.
