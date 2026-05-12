# PlainPocket

PlainPocket is a full-stack personal finance web app that brings scattered banking transactions into one simple dashboard.

This repository currently includes the project scaffold and **Module 1 (Customer Login)** with JWT authentication.

## Current Status

- Implemented: frontend + backend scaffold, auth APIs, auth UI flow, protected route handling
- In progress next: Module 2 (financial statement upload + parsing)
- Database: SQLite (local file-based)

## Tech Stack

- Frontend: React + Vite + React Router + Axios
- Backend: Flask + Flask-JWT-Extended + Flask-CORS
- Database: SQLite
- Containerization: Docker + Docker Compose

## Implemented Features

- Sign up with validation (name, mobile, email, password)
- Login with bcrypt password verification
- JWT token generation and protected `/api/auth/me` profile endpoint
- Frontend auth context with token persistence in localStorage
- Route guards:
  - Public routes: `/login`, `/signup`
  - Protected route: `/dashboard`

## Project Structure

```text
PlainPocket/
├── backend/
│   ├── app/
│   │   ├── auth/
│   │   │   └── routes.py
│   │   └── db.py
│   ├── config.py
│   ├── requirements.txt
│   └── run.py
├── frontend/
│   ├── src/
│   │   ├── context/AuthContext.jsx
│   │   ├── pages/
│   │   └── services/api.js
│   └── package.json
├── docker-compose.yml
├── implementation_plan.md
└── README.md
```

## Local Development Setup

### 1) Backend

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
python run.py
```

Backend runs at `http://localhost:5000`.

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

## Environment Variables (Optional)

Backend uses safe defaults if these are not set:

- `SECRET_KEY`
- `JWT_SECRET_KEY`

You can set them in your shell before running `python run.py`.

## Docker Setup

From repository root:

```bash
docker compose up --build
```

Services:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`

## Available API Endpoints (Auth)

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me` (JWT required)

## Notes

- SQLite database file is created at `backend/plainpocket.db`.
- Local cache artifacts and database files are ignored via `.gitignore`.
- Full implementation roadmap is documented in `implementation_plan.md`.
