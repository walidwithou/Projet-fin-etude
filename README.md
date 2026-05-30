# ⚡ my-fullstack-app

A production-ready fullstack starter: **React + Vite** on the frontend, **Express + Prisma** on the backend, connected to a **Neon PostgreSQL** database.

---

## 🗂️ Project Structure

```
my-fullstack-app/
├── client/                   # React Frontend (Vite)
│   ├── src/
│   │   ├── components/       # Reusable UI components (Navbar, etc.)
│   │   ├── hooks/            # Custom React hooks (useFetch)
│   │   ├── pages/            # Route-level page components
│   │   ├── services/         # Axios instance + resource helpers
│   │   └── App.jsx           # Root component with Router
│   ├── .env                  # VITE_API_URL=http://localhost:5000/api
│   ├── index.html
│   └── package.json
│
├── server/                   # Express Backend
│   ├── src/
│   │   ├── controllers/      # Business logic (userController, postController)
│   │   ├── routes/           # Express routers (userRoutes, postRoutes)
│   │   ├── middleware/       # errorHandler, auth stub
│   │   └── index.js          # App entry point
│   ├── prisma/
│   │   └── schema.prisma     # Prisma schema (User, Post models)
│   ├── .env                  # PORT + DATABASE_URL
│   └── package.json
│
└── .gitignore
```

---

## 🚀 Quick Start

### 1 — Backend

```bash
cd server
npm install

# Open .env and paste your Neon connection string:
# DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"

npx prisma migrate dev --name init   # push schema → Neon, generate client
npm run dev                          # starts on http://localhost:5000
```

### 2 — Frontend

```bash
cd client
npm install
npm run dev                          # starts on http://localhost:5173
```

---

## 🔑 Environment Variables

### `server/.env`
| Variable       | Description                         |
|----------------|-------------------------------------|
| `PORT`         | Port the Express server listens on  |
| `DATABASE_URL` | Neon PostgreSQL connection string   |

### `client/.env`
| Variable        | Description                  |
|-----------------|------------------------------|
| `VITE_API_URL`  | Base URL for Axios calls     |

---

## 📡 API Endpoints

| Method | Path              | Description        |
|--------|-------------------|--------------------|
| GET    | /api/health       | Health check       |
| GET    | /api/users        | List all users     |
| GET    | /api/users/:id    | Get user by ID     |
| POST   | /api/users        | Create user        |
| PATCH  | /api/users/:id    | Update user        |
| DELETE | /api/users/:id    | Delete user        |
| GET    | /api/posts        | List published posts |
| GET    | /api/posts/:id    | Get post by ID     |
| POST   | /api/posts        | Create post        |
| PATCH  | /api/posts/:id    | Update post        |
| DELETE | /api/posts/:id    | Delete post        |

---

## 🛠️ Useful Commands

```bash
# Prisma
npx prisma studio          # visual DB browser
npx prisma migrate dev     # apply schema changes
npx prisma generate        # regenerate Prisma Client

# Dev servers
npm run dev   # in /server → nodemon
npm run dev   # in /client → vite
```

---

## 📦 Tech Stack

| Layer      | Technology                    |
|------------|-------------------------------|
| Frontend   | React 18, Vite, React Router  |
| HTTP client| Axios                         |
| Backend    | Express 4, Node.js            |
| ORM        | Prisma 5                      |
| Database   | Neon (PostgreSQL)             |
| Dev tools  | nodemon, dotenv               |
