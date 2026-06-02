# JWT Authentication Implementation

## Overview
This project has been migrated from Session-based authentication to JWT (JSON Web Token) authentication. The JWT tokens are valid for **7 days** and are stored on the client side.

## Changes Made

### Backend (Server)

#### 1. Dependencies
- **Added**: `jsonwebtoken` package to `package.json`

#### 2. Environment Variables
- **JWT_SECRET**: Required in `.env` file. Used to sign and verify JWT tokens.
  - Example: `JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"`
  - ⚠️ Change this in production to a secure random string

#### 3. Authentication Controller (`src/controllers/auth.controller.js`)
- **Removed**: `generateToken()` function (crypto-based session tokens)
- **Added**: `generateJWT(userId, email)` function using `jsonwebtoken`
  - Expires in: 7 days
  - Payload: `{ id: userId, email }`
- **Modified endpoints**:
  - `/register`: Returns JWT token instead of session token
  - `/login`: Returns JWT token instead of session token
  - `/logout`: Stateless (no DB action needed)
  - `/getCurrentUser`: Changed to verify JWT from auth middleware, doesn't query sessions anymore
  - **Removed**: `/refresh` endpoint (no refresh token pattern)

#### 4. Authentication Middleware (`src/middleware/auth.middleware.js`)
- **jwt.verify()**: Verifies JWT token signature and expiration
- **User lookup**: Fetches full user data from DB using decoded JWT payload
- **Role determination**: Determines user role from patient/therapist records
- **req.user**: Contains user data with id, email, role, patientId, therapistId

#### 5. Auth Routes (`src/routes/auth.routes.js`)
- **Removed**: POST `/refresh` endpoint
- **Updated**: GET `/me` now uses `authenticate` middleware

### Frontend (Client)

#### 1. API Service (`src/services/api.js`)
- **getToken()**: Retrieves JWT from localStorage
- **setToken(token)**: Stores JWT in localStorage
- **removeToken()**: Clears JWT from localStorage
- **getAuthHeaders()**: Automatically adds `Authorization: Bearer <token>` to all requests
- **apiCall()**: Fetch wrapper that handles auth headers
- **auth module**: Contains all auth endpoints

#### 2. Login Page (`src/pages/Login.jsx`)
- Calls `auth.login(email, password)` API
- Stores returned JWT via `setToken()`
- Navigates based on user role (patient/therapist/admin)
- Displays error messages if login fails

#### 3. Registration Page (`src/pages/Registration.jsx`)
- Added `handleRegistration()` function
- Calls `auth.register()` with user data
- Stores returned JWT via `setToken()`
- Handles registration errors gracefully

#### 4. Questionnaire Component (`src/components/Questionnaire.jsx`)
- Added `isLoading` and `error` props for registration feedback
- Shows loading state while registering
- Displays error messages if registration fails

## How It Works

### Login Flow
```
User inputs email/password
        ↓
POST /api/auth/login
        ↓
Server verifies credentials
        ↓
Server generates JWT (expires in 7 days)
        ↓
Returns JWT to client
        ↓
Client stores JWT in localStorage
        ↓
Client adds JWT to all future requests: Authorization: Bearer <token>
```

### Protected Routes Flow
```
Client sends request with: Authorization: Bearer <token>
        ↓
Middleware extracts & verifies JWT
        ↓
Middleware fetches user from DB
        ↓
Middleware attaches user to req.user
        ↓
Route handler processes request
```

### Token Expiration
- JWT expires after **7 days** of issuance
- When expired, middleware returns `401 Unauthorized`
- Client receives error and should redirect to login
- No automatic refresh mechanism (user must login again)

## Usage

### Server Setup
```bash
# 1. Install dependencies
cd server
npm install

# 2. Set JWT_SECRET in .env
JWT_SECRET="your-secure-random-string-here"

# 3. Start server
npm run dev
```

### Client Setup
```bash
# 1. Set API URL in vite config or .env
VITE_API_URL=http://localhost:5000/api

# 2. Start client
npm run dev
```

### Making Authenticated Requests
```javascript
import { auth, getToken, setToken } from '@/services/api';

// Login
const response = await auth.login('user@example.com', 'password');
setToken(response.data.token);  // Stored automatically

// Authenticated requests (header added automatically)
const user = await auth.getCurrentUser();

// Access token in code
const token = getToken();
```

## Security Considerations

### ✅ Current Implementation
- JWT is signed with JWT_SECRET
- JWT expires after 7 days
- Token stored in localStorage (persistent across sessions)
- Token sent in Authorization header (standard REST practice)
- No sensitive data in JWT payload (only id and email)

### ⚠️ Recommendations for Production
1. **Use HTTPS only** - Never send JWT over plain HTTP
2. **Rotate JWT_SECRET** - Change in production regularly
3. **Short expiration** - Consider reducing from 7 days (e.g., 1 hour)
4. **Add refresh tokens** - For better security with short-lived tokens
5. **Use HttpOnly cookies** - Instead of localStorage for XSS protection
6. **Add token blacklist** - For immediate logout capability
7. **Rate limit login** - Prevent brute force attacks
8. **Use bcrypt** - For password hashing (currently using SHA-256)

## Testing Authentication

### Test with cURL
```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User",
    "role": "patient"
  }'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'

# Protected route (replace TOKEN with actual JWT)
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer TOKEN"
```

### Test in Frontend
1. Open DevTools → Application → LocalStorage
2. Login and verify `token` is stored
3. Try to access protected route with token
4. Clear token and try again (should fail)

## Environment Variables

### Server (.env)
```
DATABASE_URL="your-database-url"
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
JWT_SECRET="your-secret-key-here"
```

### Client (.env or vite.config.ts)
```
VITE_API_URL=http://localhost:5000/api
```

## Troubleshooting

### Issue: "No token provided"
- **Cause**: User not logged in or token not sent in header
- **Fix**: Ensure client sends `Authorization: Bearer <token>` header

### Issue: "Invalid or expired token"
- **Cause**: JWT signature invalid or token expired
- **Fix**: User needs to login again to get new token

### Issue: CORS errors on login
- **Cause**: Client and server on different origins
- **Fix**: Ensure CORS is properly configured in server/index.js

### Issue: Token not persisting across page refresh
- **Cause**: localStorage not working
- **Fix**: Check browser storage settings and console for errors

## Migration Notes

- Old Session table in DB is no longer used for authentication
- You can safely delete the `session` table from database if no longer needed
- All existing sessions are invalidated (users must login again)
- No backward compatibility with old session tokens
