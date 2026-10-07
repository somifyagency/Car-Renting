# Fleet Books: car rental accounting (MERN) version 2

Only journal entries are stored. The ledger, trial balances and financial statements are computed from them,
and every report can be downloaded as a PDF.

## Run it
1. Start MongoDB (local, or an Atlas connection string).
2. Backend:
   ```
   cd backend
   cp .env.example .env      # set MONGO_URI and JWT_SECRET
   npm install
   npm run seed              # loads the car rental chart of accounts
   npm run dev               # http://localhost:5000
   ```
3. Frontend:
   ```
   cd frontend
   npm install
   npm run dev               # http://localhost:5173
   ```
4. Open the app and choose "First time here? Create the admin account".
   Add accountants and front-desk agents with `POST /api/auth/users` (admin token required).

## Workflow
- Quick transactions: pick an event (rental invoiced, payment, deposit...) and the journal entry is posted for you.
- General journal / Adjusting entries: "New entry" dialog with a live debit = credit check.
- Ledger, Trial balance, Adjusted trial balance, Income statement, Owner's equity, Balance sheet, Cash flow: each has a Download PDF button.
- Equation worksheet: an automatic table like the textbook accounting-equation worksheet (Assets = Liabilities + Owner's Equity), one row per transaction with running balances. Landscape PDF.
- Fleet: add vehicles, then "Run monthly depreciation" posts one adjusting entry.

## Rules enforced
- Money is stored as integer cents.
- Entries must balance, and each line is a debit or a credit, not both.
- Journal entries can be edited or deleted (the balance check still applies). Reversed entries, their reversals and depreciation entries are locked. Reverse posts an offsetting entry and keeps a clean audit trail.
- Accounts with journal entries can't be deleted (mark them inactive). Vehicles with depreciation can't be deleted (mark them sold).
- Roles: admin and accountant see everything; agents only record quick transactions.

## Notes
- Statement grouping depends on each account's `subType` and `cashFlow` tags (set in seed.js and the Chart of accounts dialog).
  Each statement shows a check line (balanced / reconciled) so a bad tag is easy to spot.
- Not included yet: period locking and closing entries, bookings and customers, audit log.
