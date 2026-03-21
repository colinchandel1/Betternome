# Betternome

A music/orchestra classroom management platform for instructors and students — similar to Google Classroom/Canvas.

## Features

- **Auth0 authentication** — login and account creation via Auth0 (free tier)
- **Role-based access** — users self-select as **Instructor** or **Student**
- **Classroom management** — instructors create classrooms; students enroll with a classroom ID
- **File uploads** — PDF sheets and audio recordings (mp3, wav, ogg, m4a, flac, aac)
  - **Classroom resources** — uploaded by instructors, visible to all enrolled students
  - **Personal submissions** — uploaded by students, visible only to the student and instructor
- **RESTful API** — Express.js backend with JWT verification

---

## Architecture

```
betternome/
├── server/          # Node.js + Express backend
│   ├── src/
│   │   ├── index.js          # App entry point
│   │   ├── db.js             # node:sqlite database (built-in, Node 22+)
│   │   ├── middleware/auth.js # JWT validation via Auth0 JWKS
│   │   └── routes/
│   │       ├── users.js       # GET /api/users/me, PATCH /api/users/me/role
│   │       ├── classrooms.js  # CRUD classrooms, enroll
│   │       └── uploads.js     # File upload/list/delete
│   └── uploads/              # Stored files (gitignored)
└── client/          # React + Vite frontend
    └── src/
        ├── App.jsx            # Router + Auth0 + user bootstrapping
        ├── pages/
        │   ├── Login.jsx      # Auth0 login / sign-up buttons
        │   ├── RoleSelect.jsx # First-time role selection
        │   ├── Dashboard.jsx  # Classroom list
        │   └── Classroom.jsx  # Classroom detail, file uploads
        └── components/
            ├── Navbar.jsx
            └── FileUpload.jsx
```

---

## Setup

### Prerequisites

- Node.js ≥ 22.5.0 (uses the built-in `node:sqlite` experimental module; the `--experimental-sqlite` flag is added automatically by the `npm start` script)
- An [Auth0](https://auth0.com) account (free tier)

### 1. Auth0 Configuration

1. Create a new **Single-Page Application** in the Auth0 dashboard.
2. In *Application Settings* set:
   - **Allowed Callback URLs**: `http://localhost:5173`
   - **Allowed Logout URLs**: `http://localhost:5173`
   - **Allowed Web Origins**: `http://localhost:5173`
3. Create a new **API** (e.g. `https://betternome-api`).
4. *(Optional)* Add a post-login Action to include `role`, `name`, and `email` as custom claims on the access token under the `https://betternome.app/` namespace.

### 2. Server

```bash
cd server
cp .env.example .env
# Fill in AUTH0_DOMAIN and AUTH0_AUDIENCE in .env
npm install
npm start
```

Server runs on `http://localhost:3001`.

### 3. Client

```bash
cd client
cp .env.example .env
# Fill in VITE_AUTH0_DOMAIN, VITE_AUTH0_CLIENT_ID, VITE_AUTH0_AUDIENCE
npm install
npm run dev
```

Client runs on `http://localhost:5173`.

---

## API Reference

| Method | Path | Role | Description |
|--------|------|------|-------------|
| `GET`  | `/api/users/me` | Any | Get/create current user profile |
| `PATCH` | `/api/users/me/role` | Any | Update role (`student`\|`instructor`) |
| `GET`  | `/api/classrooms` | Any | List classrooms (owned or enrolled) |
| `POST` | `/api/classrooms` | Instructor | Create classroom |
| `GET`  | `/api/classrooms/:id` | Member | Get classroom detail |
| `DELETE` | `/api/classrooms/:id` | Instructor (owner) | Delete classroom |
| `POST` | `/api/classrooms/:id/enroll` | Student | Enroll in classroom |
| `GET`  | `/api/classrooms/:id/files` | Member | List files |
| `POST` | `/api/classrooms/:id/files` | Member | Upload file (multipart/form-data) |
| `DELETE` | `/api/classrooms/:id/files/:fileId` | Owner/Uploader | Delete file |

All endpoints (except `/health`) require a valid Auth0 JWT `Authorization: Bearer <token>` header.
