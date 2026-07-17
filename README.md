# AI Business Co-Pilot

> Upload your business data. Get a dashboard, forecasts, and AI recommendations in seconds.

## Quick Start

### Backend
```bash
cd backend
cp .env.example .env          # Add your ANTHROPIC_API_KEY and MONGODB_URI
npm install
npm run dev                   # Starts on http://localhost:5000
```

### Frontend
```bash
cd frontend
npm install
npm run dev                   # Starts on http://localhost:3000
```

## Features
- **Auto-schema detection** — classifies date, numeric, categorical, identifier, text columns
- **Interactive dashboard** — trend charts, category breakdowns, scatter plots, distribution histograms
- **AI insights** — Claude-powered executive insights and recommendations (falls back to rule-based)
- **30-day forecasting** — linear regression with confidence intervals
- **Anomaly detection** — statistical outlier alerts (±2σ)
- **PDF export** — downloadable report
- **Sample datasets** — retail, healthcare, marketing — built in, no file needed

## Environment Variables

| Variable           | Description                       |
|--------------------|-----------------------------------|
| `ANTHROPIC_API_KEY`| Your Claude API key               |
| `MONGODB_URI`      | MongoDB Atlas connection string   |
| `JWT_SECRET`       | Secret for JWT signing            |
| `CLIENT_URL`       | Frontend URL (for CORS)           |

## Tech Stack
- **Frontend:** React 18 + Vite + Tailwind CSS + Recharts
- **Backend:** Node.js + Express
- **DB:** MongoDB (optional — works without it using in-memory cache)
- **AI:** Claude 3.5 Sonnet (Anthropic)
- **File Parsing:** PapaParse + xlsx
