# 🛠️ Khedma App (خدمة)

A full-stack mobile application and backend system built with **React Native (Expo)**, **Node.js (Express)**, and **MongoDB**. Designed to handle service management, user authentication, automated backups, and multi-channel notifications (Telegram).

---

## 📁 Repository Structure

```text
khedma_app/
├── mobile/                  # React Native / Expo Mobile Application
│   ├── src/                 # Screen components, navigation, services, & utilities
│   ├── assets/              # App branding assets & images
│   ├── app.json             # Expo application configuration
│   ├── package.json         # Mobile dependencies
│   └── .env.example         # Mobile environment variable template
├── server/                  # Node.js Express Backend & API Server
│   ├── config/              # Server configuration (Cloud service keys, etc.)
│   ├── jobs/                # Scheduled background jobs (e.g. Automated Backups)
│   ├── routes/              # Express API Route handlers
│   ├── utils/               # Backup engines, encryption, & helper utilities
│   ├── server.js            # Express server entry point
│   ├── package.json         # Server dependencies
│   └── .env.example         # Server environment variable template
├── start-all.sh             # Script to launch server and Expo mobile app concurrently
├── start-production.sh      # Script to launch backend server in production mode
├── stop-all.sh              # Script to stop running background services
└── restart-all.sh           # Script to restart background services
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: v18.x or later
- **npm** or **yarn**
- **MongoDB**: A running MongoDB instance (Local or MongoDB Atlas)
- **Expo Go App** (Optional: for testing on mobile device) or Android/iOS Emulator

---

### 1️⃣ Server Setup

1. Navigate to the server directory:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy environment template and configure environment variables:
   ```bash
   cp .env.example .env
   ```
4. Fill in your environment variables in `.env` (MongoDB connection URI, JWT secrets, Telegram tokens, etc.).

5. Start backend development server:
   ```bash
   npm run dev
   ```
   The backend API server will start at `http://localhost:5000` (or your configured `PORT`).

---

### 2️⃣ Mobile App Setup

1. Navigate to the mobile directory:
   ```bash
   cd mobile
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy environment template and set your API base URL:
   ```bash
   cp .env.example .env
   ```
   Update `EXPO_PUBLIC_API_URL` with your server's IP address (e.g., `http://192.168.1.X:5000/api`).

4. Start Expo development server:
   ```bash
   npx expo start
   ```

---

## 📜 Helper Scripts

From the repository root directory:
- **Start Development Services**: `./start-all.sh`
- **Start Production Server**: `./start-production.sh`
- **Stop Running Services**: `./stop-all.sh`
- **Restart All Services**: `./restart-all.sh`

---

## 🔐 Security & Secrets Notice

- **Never commit `.env` files** or Cloud credentials (`*.json` keys) to GitHub.
- Keep `.gitignore` updated to prevent accidental leakage of database backups (`server/backups/`) and log files.

---

## 📄 License
This repository is private and proprietary unless otherwise licensed.
