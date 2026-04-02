# URL Shortener

Simple full-stack URL shortener with authentication, custom aliases, QR codes, and a per-user dashboard.

## Project Structure

- `frontend/`: React client
- `backend/`: Express and MongoDB API

## Environment Setup

Local `.env` files are already ignored by git. Example files are included if you want to reset them:

1. `backend/.env.example`
2. `frontend/.env.example`

## Run Locally

Backend:

```bash
cd backend
npm install
npm start
```

Make sure MongoDB is running locally on `mongodb://localhost:27017`.

Frontend:

```bash
cd frontend
npm install
npm start
```

Optional backend health check:

```bash
curl http://localhost:5000/api/health
```

## GitHub Safety

The root `.gitignore` excludes:

- `node_modules`
- build output
- local `.env` files

Only commit the example env files, never the real ones.
