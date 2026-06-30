# PlainPocket

PlainPocket is a full-stack personal finance web app that brings scattered banking transactions into one simple dashboard. It parses bank statements, categorizes transactions, sets monthly budgets, visualizes spending trends, and offers a natural language financial assistant chat.

## Current Status

- **Implemented**: Frontend + Backend scaffold, JWT-based Authentication, CSV Upload & Statement Parsing, Transaction Management, Budgeting (per-category limits and progress tracking), Dashboard, Trends/Reports, and an AI Financial Assistant Chat (SQL-generation via Groq/Gemini).
- **Database**: MySQL (containerized)
- **AI Integration**: Groq API (`llama-3.3-70b-versatile` via OpenAI compatibility layer) / Google Gemini API (`gemini-2.0-flash`)

## Tech Stack

- **Frontend**: React (Vite) + React Router (v7) + Axios + Recharts (for clean, responsive data visualizations) + Vanilla CSS (Custom Glassmorphism/Dark Theme)
- **Backend**: Flask + Flask-JWT-Extended + Flask-CORS + PyMySQL (MySQL driver) + scikit-learn/joblib (lightweight category classifier/ML predictions)
- **Database**: MySQL 8.0
- **Containerization & Admin Tools**: Docker + Docker Compose + phpMyAdmin

## Implemented Features

- **Authentication**: Sign up, Login with bcrypt password verification, JWT token authentication, and route guards.
- **Statement Upload & Parsers**: Drag-and-drop file upload with support for major Indian banks (HDFC, SBI, ICICI, AXIS). Custom CSV parsers normalize statements.
- **Dynamic Categorization**: Cleans merchant names and runs a rule-based + ML classifier to categorize transactions (Food & Dining, Transportation, Utilities, etc.). Relabeling triggers local retraining.
- **Dashboard**: High-level KPIs (Total Income, Total Expenses, Net Savings) with animated counters, Recharts category breakdown (donut), daily burn rate (line chart), top merchants, and subscription alerts.
- **Budgeting**: Set and edit monthly category-wise budgets with color-coded spending progress indicators.
- **Trends & Reports**: Month-on-month comparison of category spend, overall historical trajectory, and dynamic velocity insights.
- **AI Financial Chat**: Natural language query interface powered by Groq (Meta Llama) / Gemini, translating requests to secure MySQL queries and synthesizing descriptive financial reports.

## Project Structure

```text
PlainPocket/
├── backend/
│   ├── app/
│   │   ├── auth/           # Login, signup, JWT
│   │   ├── upload/         # File upload & CSV parsers (HDFC, SBI, ICICI, AXIS)
│   │   ├── transactions/   # Transaction list & dynamic category retraining
│   │   ├── budget/         # Budgeting logic
│   │   ├── chat/           # Groq/Gemini NL-to-SQL financial assistant
│   │   ├── statements/     # Statement list & management
│   │   ├── analysis/       # AI categorization engine
│   │   └── db.py           # Database connection & table setup (MySQL)
│   ├── config.py
│   ├── requirements.txt
│   ├── run.py
│   └── .env                # OpenAI/Gemini credentials
├── frontend/
│   ├── src/
│   │   ├── context/        # Auth context
│   │   ├── pages/          # Login, Signup, Dashboard, Upload, Budget, Chat, Trends, Statements
│   │   ├── services/       # Axios API services
│   │   ├── App.jsx
│   │   └── index.css       # Global styling & layout
│   └── package.json
├── data/                   # Dummy statement files for HDFC, SBI, ICICI, AXIS
├── docker-compose.yml
├── implementation_plan.md
└── README.md
```

## Local Development Setup

### 1) Database & phpMyAdmin (Docker Recommended)
Spin up the MySQL database and phpMyAdmin admin console:
```bash
docker compose up -d db phpmyadmin
```
- **MySQL Port**: `3307` (mapped to `3306` internally)
- **phpMyAdmin**: Available at `http://localhost:8080` (use user: `pp_user` and password: `pp_password`)

### 2) Backend Setup
Navigate to the `backend` folder, set up environment variables, and start the Flask server:
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

### 3) Frontend Setup
Navigate to the `frontend` folder, install dependencies, and start Vite dev server:
```bash
cd frontend
npm install
npm run dev
```
Frontend runs at `http://localhost:5173`.

## Environment Variables (`backend/.env`)

Configure AI providers and credentials in `backend/.env`. Groq is set as the primary provider:
```env
# Groq API Configuration (Primary LLM)
OPENAI_API_KEY=gsk_your_groq_api_key
OPENAI_BASE_URL=https://api.groq.com/openai/v1
OPENAI_MODEL=llama-3.3-70b-versatile

# Google Gemini API Configuration (Alternative/Fallback LLM)
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.0-flash
```

## Running the Entire Stack with Docker

If you prefer full containerization, run the following from the root directory:
```bash
docker compose up --build
```
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`
- phpMyAdmin: `http://localhost:8080`

## Available API Endpoints

- **Auth**: `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/me`
- **Upload**: `POST /api/upload/statement`
- **Transactions**: `GET /api/transactions/`, `GET /api/transactions/summary`, `PUT /api/transactions/<txn_id>/category`, `GET /api/transactions/months`, `GET /api/transactions/predictions`, `GET /api/transactions/trends`
- **Statements**: `GET /api/statements/`, `GET /api/statements/monthly-summary`, `DELETE /api/statements/<statement_id>`
- **Budget**: `GET /api/budget/`, `POST /api/budget/`, `GET /api/budget/monthly-overview`
- **Chat**: `POST /api/chat/`, `GET /api/chat/suggestions`
