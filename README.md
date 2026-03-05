# InsureIntel - Insurance Intelligence Platform

A web-based competitive intelligence platform for P&C insurance carriers, reinsurers, and niche market players.

## Tech Stack

- **Next.js 16** with App Router
- **React 19** + TypeScript
- **Tailwind CSS 4** + shadcn/ui
- **Prisma 6** with SQLite (dev) / PostgreSQL (production)
- **Recharts** for data visualization (Phase 3)

## Quick Start

```bash
# Install dependencies
npm install

# Generate Prisma client & push schema
npx prisma generate
npx prisma db push

# Seed the database with 41 carriers
npx tsx prisma/seed.ts

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Dashboard with carrier table
│   ├── carriers/[id]/page.tsx      # Carrier detail view
│   └── api/
│       ├── carriers/               # GET carriers (with filters)
│       ├── carriers/[id]/          # GET single carrier
│       └── seed/                   # POST to seed database
├── components/
│   ├── ui/                         # shadcn/ui components
│   ├── layout/sidebar.tsx          # App navigation
│   ├── carriers/                   # Carrier table & filters
│   └── dashboard/                  # Stats overview cards
└── lib/
    ├── prisma.ts                   # Database client
    ├── utils.ts                    # Utility functions
    └── seed-data.ts                # Carrier seed data (41 records)
```

## Carrier Universe (41 Companies)

| Category | Count | Examples |
|----------|-------|---------|
| US P&C Carriers | 15 | Chubb, AIG, Travelers, Markel, State Farm |
| Global Carriers | 9 | Zurich, Allianz, AXA, Lloyd's, Tokio Marine |
| Reinsurers | 10 | Swiss Re, Munich Re, Gen Re, RenRe, Arch |
| Auto Dealer Niche | 7 | Ally, Zurich NA, Sentry, Federated |

## Phase Roadmap

- **Phase 1** (Current): Carrier universe, filterable dashboard, detail pages
- **Phase 2**: SEC EDGAR integration (10-K, 10-Q, 8-K filings, financial metrics)
- **Phase 3**: Market cycle dashboard (combined ratios, rate commentary, cat losses)
- **Phase 4**: Auto dealership vertical drill-down
- **Phase 5**: AI-powered search, competitor reports, sentiment analysis

## Database

SQLite for local development. Switch to PostgreSQL by changing the datasource in `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```
