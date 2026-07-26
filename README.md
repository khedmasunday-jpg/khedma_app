# Application Management Platform

A web application for institutional record management, activity scheduling, and administrative reporting.

## Overview

This software provides a centralized interface for tracking records, managing user access roles, and monitoring automated activity logs.

- **Web Console**: Multi-tier user dashboard.
- **Data Engine**: Structured data storage and automated background jobs.
- **Reporting & Notifications**: Integration options for activity alerts and data export.

## Deployment & Setup

### Prerequisites
- Node.js (v18+)
- MongoDB Database Instance

### Environment Setup
Create a `.env` file in the server directory based on `.env.example`:

```bash
PORT=5000
NODE_ENV=production
MONGO_URI=mongodb://localhost:27017/app_db
JWT_SECRET=your_secure_jwt_secret_key
```

### Build & Run

#### Server Application
```bash
cd server
npm install
npm start
```

#### Client Bundle (Production Web)
```bash
cd mobile
npm install
npx expo export --platform web
```

## Security Note

All production deployments must use HTTPS, secure environment secrets, and strict CORS configuration.
