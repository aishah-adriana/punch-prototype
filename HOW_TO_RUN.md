# How to Run Punch Tracker

## First Time Setup

```bash
cd /Users/admin/Desktop/Punch_Prototype

# Install all dependencies
npm install --prefix server --cache /tmp/npm-cache
npm install --prefix client --cache /tmp/npm-cache
```

## Running the App

Open two terminal windows:

**Terminal 1 — Backend:**
```bash
cd /Users/admin/Desktop/Punch_Prototype/server
node index.js
```

**Terminal 2 — Frontend:**
```bash
cd /Users/admin/Desktop/Punch_Prototype/client
npm run dev
```

Then open your browser at: **http://localhost:3000**

## Usage Guide

1. **Add Teachers** — Go to Teachers, click + Add Teacher
2. **Create Groups** (for group classes) — Go to Group Classes, create groups with teacher + syllabus
3. **Add Students** — Go to Students, add each student with their age, syllabus, class type, and teacher
4. **Log Attendance** — Go to Log Attendance, click + Log Session to record each class
5. **Calculate Fees** — Go to Student Fees or Teacher Wages, click "Calculate Fees/Wages" for the month
6. **Mark Payments** — Click "Mark Paid" when a student pays or a teacher is paid
