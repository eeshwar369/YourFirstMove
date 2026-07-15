# YourFirstMove - Productivity Application

A full-stack productivity platform for managing daily and monthly tasks. Features include an interactive visual roadmap, automated SMS notifications, real-time progress tracking, and gamified productivity features.

## Features

- **Social OAuth Login**: Sign in with Google, LinkedIn, or GitHub (Google tested & working)
- **Visual Timeline Roadmap**: 24-hour schedule view with tasks mapped to specific times and current time indicator
- **Task Duration Blocks**: Tasks display as time blocks spanning from start to end time
- **Task Completion Tracking**: Mark tasks as complete/incomplete directly in timeline view
- **Schedule Duplication**: Copy entire day's schedule to other dates
- **List View**: Drag-and-drop task reordering 
- **Monthly Calendar View**: Overview with task counts and completion rates
- **Automated SMS Notifications**: Critical task reminders via Twilio (optional)
- **Real-Time Progress Tracking**: Live completion percentages and analytics
- **Productivity Streaks**: Gamified daily completion tracking
- **Progressive Web App**: Offline functionality with background sync
- **Analytics Dashboard**: Productivity trends and statistics
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile

## Technology Stack

### Frontend
- Angular 17+
- TypeScript 5+
- Tailwind CSS
- Angular Material
- Chart.js
- RxJS
- Angular Service Worker (PWA)

### Backend
- Node.js 20+ LTS
- Express.js 4.x
- TypeScript
- MySQL 8.0+
- Knex.js (database migrations)
- Objection.js (ORM)
- JWT authentication
- Passport.js (OAuth strategies)
- node-cron (scheduled jobs)
- Twilio API (SMS - optional)

## Prerequisites

- Node.js 20+ LTS
- MySQL 8.0+
- npm or yarn
- Twilio account (optional - for SMS notifications)
- OAuth credentials (optional - for social login with Google/LinkedIn/GitHub)

## Installation

### 1. Clone the repository
```bash
git clone <repository-url>
cd yourfirstmove
```

### 2. Install dependencies
```bash
npm run install:all
```

### 3. Configure environment variables

**Backend (.env in backend/ directory):**
```env
# Server
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=yourfirstmove
DB_USER=root
DB_PASSWORD=your_password

# JWT (REQUIRED: Must be 32+ characters, secure, non-default example key)
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRES_IN=7d

# Twilio
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Notification
NOTIFICATION_WINDOW_MINUTES=30

# CORS
CORS_ORIGIN=http://localhost:4200

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# OAuth (Optional - for social login)
FRONTEND_URL=http://localhost:4200
BACKEND_URL=http://localhost:3000
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

**To get OAuth credentials:**
- **Google**: https://console.cloud.google.com/apis/credentials
- **LinkedIn**: https://www.linkedin.com/developers/apps
- **GitHub**: https://github.com/settings/developers

**OAuth Callback URLs (configure in provider console):**
- Google: `http://localhost:3000/api/auth/google/callback`
- LinkedIn: `http://localhost:3000/api/auth/linkedin/callback`
- GitHub: `http://localhost:3000/api/auth/github/callback`

**Frontend (environment.ts in frontend/src/environments/):**
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api'
};
```

### 4. Set up the database

Create MySQL database:
```sql
CREATE DATABASE yourfirstmove CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Run migrations:
```bash
npm run migrate:latest
```

## Running the Application

### Development Mode

**Start backend server:**
```bash
npm run dev:backend
```
Backend will run on http://localhost:3000

**Start frontend development server:**
```bash
npm run dev:frontend
```
Frontend will run on http://localhost:4200

### Production Mode

**Build backend:**
```bash
npm run build:backend
```

**Build frontend:**
```bash
npm run build:frontend
```

**Start production server:**
```bash
cd backend && npm start
```

## Testing

**Run backend tests:**
```bash
npm run test:backend
```

Backend test files are located in `backend/src/__tests__/`. They cover:
- Health check endpoint
- Auth route input validation (register, login)
- Auth middleware (token presence, format, validity)
- Protected route access without a token

Frontend tests are not yet implemented. Contributions welcome!

**Run frontend tests (not yet implemented):**
```bash
npm run test:frontend
```

## Database Migrations

**Run pending migrations:**
```bash
npm run migrate:latest
```

**Rollback last migration:**
```bash
npm run migrate:rollback
```

**Create new migration:**
```bash
cd backend
npx knex migrate:make migration_name
```

## API Documentation

### Authentication Endpoints

- `POST /api/auth/register` - Create new user account
- `POST /api/auth/login` - Authenticate user
- `POST /api/auth/logout` - Invalidate session
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Complete password reset
- `GET /api/auth/me` - Get current user profile

**OAuth Endpoints (Optional):**
- `GET /api/auth/google` - Initiate Google OAuth flow
- `GET /api/auth/google/callback` - Google OAuth callback
- `GET /api/auth/linkedin` - Initiate LinkedIn OAuth flow
- `GET /api/auth/linkedin/callback` - LinkedIn OAuth callback
- `GET /api/auth/github` - Initiate GitHub OAuth flow
- `GET /api/auth/github/callback` - GitHub OAuth callback

### Task Endpoints

- `GET /api/tasks` - List tasks (with pagination, filters)
- `POST /api/tasks` - Create new task
- `GET /api/tasks/:id` - Get single task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task
- `PATCH /api/tasks/:id/complete` - Mark task complete
- `PATCH /api/tasks/:id/reorder` - Update task order
- `GET /api/tasks/daily/:date` - Get tasks for specific date
- `GET /api/tasks/monthly/:month` - Get tasks for specific month
- `POST /api/tasks/duplicate-day` - Duplicate schedule from one date to another

### User Endpoints

- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/preferences` - Get user preferences
- `PUT /api/users/preferences` - Update preferences

### Analytics Endpoints

- `GET /api/analytics/completion` - Get completion rate data
- `GET /api/analytics/trends` - Get productivity trends
- `GET /api/analytics/streaks` - Get streak history

## Architecture

```
┌─────────────────────────────────────────┐
│         Angular SPA (Frontend)          │
│  - Components, Services, Guards         │
│  - PWA with Service Worker              │
└─────────────────┬───────────────────────┘
                  │ HTTPS/REST API
┌─────────────────▼───────────────────────┐
│    Node.js + Express.js (Backend)       │
│  - Routes, Controllers, Middleware      │
│  - Background Jobs (node-cron)          │
└─────────────────┬───────────────────────┘
                  │ SQL Queries
┌─────────────────▼───────────────────────┐
│         MySQL Database                   │
│  - users, tasks, streaks, notifications │
└──────────────────────────────────────────┘
```

## Security Features

- JWT-based authentication
- OAuth 2.0 social login (Google, LinkedIn, GitHub)
- Passport.js authentication strategies
- Bcrypt password hashing
- HTTPS enforcement in production
- SQL injection prevention via parameterized queries
- XSS protection with input sanitization
- CORS policy enforcement
- Rate limiting (100 requests/minute)
- Helmet.js security headers
- Secure OAuth token storage

## Performance Optimizations

- Lazy loading for Angular routes
- Virtual scrolling for large task lists
- Database connection pooling
- API response caching
- Pagination (50 items per page)
- Database indexes on frequently queried columns

## Deployment

### Production Checklist

- Set `NODE_ENV=production`
- Configure production database credentials
- Set strong JWT secret
- Configure OAuth credentials (Google, LinkedIn, GitHub)
- Update OAuth callback URLs to production domain
- Configure Twilio credentials (optional)
- Enable HTTPS
- Set appropriate CORS origins
- Set up database backups
- Run security audit: `npm audit`

### Recommended Hosting

- **Frontend**: Vercel, Netlify, AWS S3 + CloudFront
- **Backend**: AWS EC2, DigitalOcean, Heroku
- **Database**: AWS RDS, DigitalOcean Managed MySQL

## OAuth Social Login Setup (Optional)

### How OAuth Works
1. User clicks "Continue with Google/LinkedIn/GitHub" on login page
2. User is redirected to provider's authorization page
3. After authorization, provider redirects back to your app with a code
4. Backend exchanges code for access token and user info
5. User is automatically logged in with JWT token

### User Account Linking
- **New User**: Creates account with OAuth credentials
- **Existing Email**: Links OAuth to existing email/password account
- **Returning User**: Instant login with token refresh
- **Provider Conflict**: Error if email already linked to different provider

### Testing OAuth
1. Add OAuth credentials to `backend/.env`
2. Restart backend server
3. Visit `http://localhost:4200/login`
4. Click "Continue with Google" (or other provider)
5. Authorize and you'll be automatically logged in

## Troubleshooting

### Backend Issues
- **Database connection failed**: Check MySQL is running and credentials are correct
- **Migration errors**: Ensure database exists and user has proper permissions
- **Port already in use**: Change PORT in backend/.env or kill process using the port
- **Environment validation failed**: Ensure `JWT_SECRET` is set in `backend/.env`, is at least 32 characters long, and does not use the default placeholder value. You can generate a secure key using: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`

### Frontend Issues
- **Compilation errors**: Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- **API connection failed**: Verify backend is running on correct port
- **OAuth not working**: Check credentials in backend/.env and callback URLs in provider console

### OAuth Issues
- **"Unknown authentication strategy"**: Restart backend after adding OAuth credentials
- **Redirect fails**: Verify callback URLs match in both .env and provider console
- **Token not stored**: Check browser console for errors and localStorage

## License

MIT

## Support

For issues and questions, please open an issue on the repository.

## ✨ README Improvement Notes

### 📌 Formatting Enhancements Needed
- Improve heading hierarchy for better readability
- Ensure consistent spacing between sections
- Use proper Markdown formatting for code blocks and lists
- Align all installation and usage steps properly

### 🚀 Suggested Structure Upgrade
- Introduction
- Features
- Tech Stack
- Installation
- Usage
- Project Structure
- Contribution Guidelines
- License

### 🛠️ Documentation Improvements
- Add badges (optional): build, license, contributors
- Add screenshots for better UI understanding
- Standardize code blocks for commands

### 🎯 Goal
Improve onboarding experience for new contributors and users by making README more structured, readable, and professional.

