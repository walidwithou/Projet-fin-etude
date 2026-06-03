# Role-Based Route / View Access Control

This document describes how the Tassarut application controls access
to its main views (`Panel.jsx`, `Therapist.jsx`, `Patient.jsx`) based
on the user's role and (for therapists) verification status.

The implementation spans both the **backend** (Express) and the
**frontend** (React + a custom in-memory router in `App.jsx`).
The two layers share the same access rules so the UI can never show a
view the API would reject.

---

## 1. Access rules

| Role          | View          | Required `role` | Required `verificationStatus` |
|---------------|---------------|-----------------|-------------------------------|
| `ADMIN`       | `Panel.jsx`   | `ADMIN`         | n/a                           |
| `THERAPIST`   | `Therapist.jsx` | `THERAPIST`   | **`verified`**                |
| `PATIENT`     | `Patient.jsx` | `PATIENT`       | n/a                           |

Any other combination is denied. The user is redirected to their
correct page, the login page, or the `ACCESS_DENIED` view depending
on the situation.

---

## 2. Backend (Express + Prisma)

### 2.1 `requireVerifiedTherapist` middleware

File: `server/src/middleware/auth.middleware.js`

A new middleware was added on top of the existing `authenticate` /
`authorize` chain:

```js
router.get('/profile',
  authorize(['therapist']),
  requireVerifiedTherapist,
  therapistController.getProfile,
);
```

`requireVerifiedTherapist`:
- 401 if there is no authenticated user.
- 403 if the user is not a therapist.
- 403 with a `verificationStatus` field if the therapist's
  `verificationStatus !== 'verified'`. The error message mirrors
  the wording used by `/auth/login` so the client can show a
  consistent message ("Votre compte est en cours de vérification…",
  "Votre compte a été rejeté…").
- Otherwise attaches `req.user.verificationStatus = 'verified'`
  and calls `next()`.

### 2.2 Therapist self-service routes

File: `server/src/routes/therapist.routes.js`

All therapist self-service routes (`/profile`, `/availability`,
`/patients`, `/appointments`, `/reviews`, `/stats`, document
upload) are now protected by the `therapistOnly` chain:

```js
const therapistOnly = [authorize(['therapist']), requireVerifiedTherapist];
```

Admin-only routes (`GET /`, `GET /:id`, `PUT /:id/verify`) keep
their original `authorize(['admin'])` middleware and are not
affected.

### 2.3 `getCurrentUser` returns `verificationStatus`

File: `server/src/controllers/auth.controller.js`

`GET /auth/me` now also returns `verificationStatus` for therapists.
This is what the frontend uses to decide whether to show the
therapist dashboard after a hard refresh.

Similarly, the `/auth/login` response now includes
`verificationStatus` for therapists so the client can route the
user to the right page without an extra request.

### 2.4 Login-time enforcement (unchanged, still in place)

`POST /auth/login` already refuses to issue a JWT to a therapist
whose status is `pending` or `rejected`. This means an unverified
therapist cannot even log in. The frontend protection is therefore
defense in depth.

---

## 3. Frontend (React)

### 3.1 `AuthContext`

File: `client/src/auth/AuthContext.jsx`

A React context that wraps the whole app (see `main.jsx`) and
exposes:

- `user` — the user object returned by `/auth/me` (or `null`)
- `role` — the normalized uppercase role (`'ADMIN'`, `'THERAPIST'`,
  `'PATIENT'`, or `null`)
- `token` — the JWT, or `null`
- `loading` — `true` while the session is being restored
- `isAuthenticated`
- `login(email, password)` — calls `/auth/login`, stores the
  token + user (including `verificationStatus`) in `localStorage`
- `logout()` — clears the local session
- `refresh()` — re-fetches `/auth/me` and updates the user

It also listens for a custom `tassarut:unauthorized` window event
emitted by `services/api.js` whenever an API call returns 401,
and clears the local session automatically. The next render then
redirects to the login page.

### 3.2 `canAccess.js` — the access rules

File: `client/src/auth/canAccess.js`

A tiny, pure module that centralizes the access predicates:

```js
canAccessAdmin(user)    // role === 'ADMIN'
canAccessPatient(user)  // role === 'PATIENT'
canAccessTherapist(user)// role === 'THERAPIST' AND verificationStatus === 'verified'
canAccess(page, user)   // generic dispatcher over ACCESS_RULES
defaultPageForUser(user)// where to send this user on login / refresh
```

`canAccess` is what the `ProtectedRoute` guard calls.

### 3.3 `ProtectedRoute` guard

File: `client/src/auth/ProtectedRoute.jsx`

A reusable guard that wraps any restricted view. It:

1. Shows a small loading state while `loading === true`.
2. If the user is not authenticated, it calls
   `onNavigate('LOGIN')` to bounce to the login page.
3. If the user is authenticated but `canAccess(page, user)`
   returns `false`, it renders an inline **Access Denied** card
   with a "Retour à mon espace" button that sends the user to
   the page that *is* allowed for their role.
4. Otherwise it renders the protected view unchanged.

### 3.4 Wiring in `App.jsx`

File: `client/src/App.jsx`

The custom router in `App.jsx` was updated to:

- Wrap `Panel.jsx` in `<ProtectedRoute page="ADMIN">`.
- Wrap `Therapist.jsx` in `<ProtectedRoute page="THERAPIST">`.
- Wrap `Patient.jsx` in `<ProtectedRoute page="PATIENT">`.
- Wrap `Settings.jsx` in `<ProtectedRoute page="SETTINGS">` so
  that an unauthenticated user can't reach it either.
- Render the new `<AccessDenied />` page when `currentPage ===
  'ACCESS_DENIED'`.
- When a session is hydrated (user logs in, then refreshes the
  page), automatically navigate them from `REGISTRATION` to
  their default page.

### 3.5 `Login.jsx` uses `useAuth().login()`

File: `client/src/pages/Login.jsx`

The login form now uses `useAuth().login()`, which stores both
the token and the user object. After login it picks the right
destination using `defaultPageForUser(user)`:

- Admin → `ADMIN`
- Verified therapist → `THERAPIST`
- Unverified therapist → `ACCESS_DENIED` (with a clear message
  explaining that the account is pending or rejected)
- Patient → `PATIENT`

### 3.6 `AccessDenied.jsx` — full-page error view

File: `client/src/pages/AccessDenied.jsx`

A complete page (with header/footer matching the rest of the
app) shown when a user lands on `ACCESS_DENIED`. It explains the
reason in French (pending / rejected / wrong role) and offers:

- A "Aller à mon espace" button (when the user has another
  page they can access).
- A "Se connecter" button (when the user is not authenticated).
- A "Se déconnecter" button (so the user can switch accounts).

### 3.7 `services/api.js` 401 handling

File: `client/src/services/api.js`

Whenever any API call returns **401 Unauthorized**, the helper:

1. Removes the token from `localStorage`.
2. Dispatches a `tassarut:unauthorized` window event.

`AuthContext` listens for this event and clears the local
session, which causes the next render to redirect the user to
the login page. This guarantees the user can't keep navigating
with a stale token.

---

## 4. How role & verification checks work end-to-end

1. **Login** — `Login.jsx` calls `useAuth().login()`, which hits
   `POST /auth/login`. The server returns a JWT plus a user
   object (`role`, `verificationStatus` for therapists). The
   context stores both.
2. **Routing** — `Login.jsx` calls
   `onNavigateToPage(defaultPageForUser(user))`. For verified
   therapists this is `THERAPIST`, for unverified therapists it
   is `ACCESS_DENIED`, for patients it is `PATIENT`, for admins
   it is `ADMIN`.
3. **Guarding** — `App.jsx` wraps each restricted view in a
   `<ProtectedRoute page="...">`. The guard consults
   `canAccess(page, user)` (which checks role + verification
   status) and either renders the view or shows the access
   denied card.
4. **Backend enforcement** — Every API call to a protected
   route goes through `authenticate` + `authorize`. Therapist
   self-service routes additionally go through
   `requireVerifiedTherapist`, so even a forged frontend can't
   bypass the rule.
5. **Hard refresh / new tab** — `AuthContext` reads the JWT
   from `localStorage` and calls `GET /auth/me` to repopulate
   the user object (including `verificationStatus`). The
   effect in `App.jsx` then re-routes the user to their
   default page, where the same guard logic kicks in.
6. **Stale token** — Any 401 from the API clears the local
   session and forces a re-login.

---

## 5. Notes on integration

- The `auth/` folder is the only new frontend module. It does
  not depend on any third-party library and can be moved or
  renamed freely.
- `AuthProvider` is mounted in `main.jsx` (above `<App />`),
  so any component in the tree can call `useAuth()`.
- `ProtectedRoute` is generic — pass any `page` string. To add
  a new restricted page, add it to `ACCESS_RULES` in
  `canAccess.js` and wrap the view in `<ProtectedRoute>`.
- The `verificationStatus` field is read directly from the
  `Therapist` record in the database. Admins can change it
  through the existing admin routes
  (`PUT /api/admin/therapists/:id/verify` /
  `PUT /api/admin/therapists/:id/reject`). When that happens
  the affected therapist's access is automatically revoked the
  next time their session is checked (login or `/auth/me`).
- The frontend protects against URL/state manipulation, the
  backend protects against direct API access, and the
  `defaultPageForUser` helper prevents users from being sent
  to a page they don't have access to. Combined, these three
  layers give us defense in depth.
