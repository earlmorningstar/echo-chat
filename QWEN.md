# EchoChat - Project Context

## Project Overview

**EchoChat** is a full-stack real-time chat application with voice and video calling capabilities. It consists of:

- **Backend**: Node.js/Express REST API with WebSocket support for real-time messaging
- **Frontend**: React (TypeScript) single-page application with Material UI components

The application supports real-time messaging, friend management, voice/video calls (via Twilio), file uploads, and user authentication.

### Architecture

```
echo-chat/
├── backend/              # Express.js API server
│   ├── config/           # Database and storage configuration
│   ├── controllers/      # Request handlers (e.g., callController.js)
│   ├── middleware/       # Auth middleware (JWT authentication)
│   ├── models/           # MongoDB schemas (friendshipSchema.js)
│   ├── routes/           # API route definitions
│   ├── utils/            # Helper utilities (network control, constants, validators)
│   └── WebSocket/        # WebSocket server and event handling
└── frontend/             # React TypeScript app
    ├── src/
    │   ├── calls/        # Call interface components
    │   ├── chatAppPages/ # Main app pages (chat, calls, settings, etc.)
    │   ├── components/   # Reusable UI components
    │   ├── contexts/     # React contexts (Auth, Call, Chat, WebSocket)
    │   ├── pages/        # Auth and onboarding pages
    │   ├── types/        # TypeScript type definitions
    │   └── utils/        # API clients, validators, utilities
    └── public/           # Static assets
```

## Tech Stack

### Backend

- **Runtime**: Node.js (>=18), ES Modules
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose + native MongoDB driver)
- **Real-time**: WebSocket (`ws` library) with custom event handler
- **Authentication**: JWT (jsonwebtoken), bcryptjs
- **Calls**: Twilio (Voice & Video SDK)
- **File Uploads**: Multer
- **Email**: Nodemailer
- **HTTP Client**: Axios

### Frontend

- **Framework**: React 18 with TypeScript
- **Build Tool**: CRACO (Custom React App Configuration Override)
- **UI Library**: Material UI (MUI) v6, Framer Motion, React Icons
- **Routing**: React Router v6
- **State Management**: React Context (Auth, Call, Chat, WebSocket)
- **Data Fetching**: TanStack React Query (v5)
- **Calling SDK**: Twilio Voice SDK, Twilio Video SDK
- **HTTP Client**: Axios

## Key Features

1. **Authentication**: Signup, login, password reset with email verification
2. **Friend System**: Send/accept friend requests, view friend profiles, block users
3. **Real-time Chat**: WebSocket-based messaging with typing indicators, read receipts, online/offline status
4. **Voice Calls**: One-to-one voice calls via Twilio Voice SDK
5. **Video Calls**: One-to-one video calls via Twilio Video SDK with room management
6. **Call History**: Aggregated call history with participant details (60-day retention)
7. **File Uploads**: Image/file upload with storage configuration
8. **WebSocket Features**: Rate limiting, heartbeat/ping-pong, message acknowledgment, retry logic

## API Routes

| Route             | Description                                                   |
| ----------------- | ------------------------------------------------------------- |
| `/api/auth/*`     | Authentication (login, signup, password reset, token renewal) |
| `/api/*`          | User management, friend requests, profiles                    |
| `/api/messages/*` | Message CRUD operations                                       |
| `/api/uploads/*`  | File/image uploads                                            |
| `/api/call/*`     | Call initiation, acceptance, rejection, end, history          |
| `/api/health`     | Health check endpoint                                         |

## WebSocket Events

| Event           | Description                   |
| --------------- | ----------------------------- |
| `register`      | Register client with userId   |
| `message`       | Send/receive chat messages    |
| `typing`        | Typing indicator              |
| `status`        | Online/offline status updates |
| `read_status`   | Message read receipts         |
| `call_initiate` | Initiate call invitation      |
| `call_accept`   | Accept incoming call          |
| `call_reject`   | Reject incoming call          |
| `call_end`      | End active call               |

## Building and Running

### Prerequisites

- Node.js >= 18
- MongoDB instance (local or Atlas)
- Twilio account (for voice/video calls)
- `.env` files in both `backend/` and `frontend/` directories

### Backend

```bash
cd backend
npm install
npm start          # Start the server (default port: 5000)
```

**Required Environment Variables** (`.env` in `backend/`):

- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secret for JWT token signing
- `PORT` - Server port (default: 5000)
- `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY`, `TWILIO_API_SECRET`, `TWILIO_AUTH_TOKEN`, `TWILIO_APP_SID` - Twilio credentials
- `BASE_URL` - Base URL for Twilio webhooks

### Frontend

```bash
cd frontend
npm install
npm start          # Start dev server (http://localhost:3000)
npm build          # Production build
npm test           # Run tests
```

### CORS Configuration

The backend is configured to accept requests from:

- `http://localhost:3000`
- `https://echochat-livid.vercel.app`
- `https://echochat-1b63ov1sd-onyeabor-joels-projects.vercel.app`

## Database

- **Database Name**: `javascriptforpractice`
- **Collections**: `users`, `friendships`, `messages`, `calls`, `callHistory` (30-day TTL), uploads
- **TTL Indexes**: `calls` collection (24-hour expiry), `callHistory` collection (30-day expiry)

## Development Conventions

- **Backend**: ES Modules (`"type": "module"` in package.json), async/await pattern, MongoDB native driver alongside Mongoose
- **Frontend**: TypeScript, React functional components with hooks, Context API for state management
- **Error Handling**: Centralized error handler in middleware, custom `ErrorBoundary` and `CallErrorFallback` components on frontend
- **WebSocket**: Message acknowledgment with retry logic, rate limiting per client, heartbeat mechanism (45s interval, 20s timeout)
- **Security**: JWT authentication, password hashing with bcryptjs, input validation, rate limiting on WebSocket connections

## Author

Onyeabor Joel
