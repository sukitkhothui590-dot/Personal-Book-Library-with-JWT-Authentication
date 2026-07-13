# Personal Book Library

A full-stack personal library dashboard built with React, Express, SQLite and JWT authentication. Users can search, filter, rate and manage books, look up metadata by ISBN, and inspect the API through Swagger UI.

## Branch guide

The repository keeps each development milestone on a separate branch so the implementation history is easy to review.

| Branch | Purpose | Main contents |
| --- | --- | --- |
| `main` | Submission-ready application | Complete frontend, backend, tests, documentation and Bruno collection |
| `develop` | Integrated development baseline | Frontend and backend combined with API integration tests |
| `feature/backend-setup` | Initial project foundation | npm workspaces, Vite/Express setup, environment example and ignore rules |
| `feature/book-api` | Book data API | Express server, SQLite persistence and book CRUD endpoints |
| `feature/jwt-auth` | Backend authentication | Login endpoint, expiring JWT generation and protected write middleware |
| `feature/book-library-ui` | Library dashboard | Responsive dashboard, forms, book cards, details, ratings, search and filters |
| `feature/frontend-auth` | Frontend session flow | Login screen, localStorage token handling, auth guard and automatic logout on `401` |
| `docs/submission` | Submission documentation | README, REFLECTION, Bruno API collection and setup instructions |

For final review and normal usage, clone or check out `main`. The feature branches are retained to show how the project was built in stages.

## Requirements

- Node.js 20 or newer
- npm

## Installation

```powershell
git clone https://github.com/sukitkhothui590-dot/Personal-Book-Library-with-JWT-Authentication.git
cd Personal-Book-Library-with-JWT-Authentication
Copy-Item server/.env.example server/.env
npm install
npm install --prefix server
npm install --prefix client
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`
- Swagger API Docs: `http://localhost:4000/api/docs`
- Demo username: `reader`
- Demo password: `library123`

## Environment variables

Configure `server/.env` before starting the application:

```env
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
JWT_SECRET=replace-with-a-long-random-secret
DEMO_USERNAME=reader
DEMO_PASSWORD=library123
```

SQLite is stored locally at `server/data/library.db` and is created automatically. Database files, `.env`, build output and dependencies are excluded from Git.

The frontend API URL defaults to `http://localhost:4000/api`. Set `VITE_API_URL` before starting Vite only when using a different backend address.

## Commands

```powershell
npm run dev               # Run frontend and backend together
npm run build             # Build the React application
npm run start             # Start the backend
npm test --prefix server  # Run isolated API integration tests
```

## API endpoints

| Method | Endpoint | Authentication | Purpose |
| --- | --- | --- | --- |
| POST | `/api/login` | No | Create an expiring JWT |
| GET | `/api/books` | No | List all books |
| GET | `/api/books/:id` | No | Get book details |
| POST | `/api/books` | Bearer JWT | Create a book |
| PUT | `/api/books/:id` | Bearer JWT | Update details or rating |
| DELETE | `/api/books/:id` | Bearer JWT | Delete a book |
| GET | `/api/isbn/:isbn` | No | Look up book metadata from Open Library |

## Bruno API collection

Open `api-collection/` in Bruno and select the `local` environment. Run **Login** first; its post-response script stores the JWT in the `token` environment variable automatically. Protected create, update and delete requests then use that token.

## Testing

The API tests run against a separate temporary SQLite database and cover:

- `401` for protected requests without a JWT
- `422` validation errors
- Create, read, update and delete flow
- `404` for a missing book

Book-cover images and ISBN metadata are provided by Open Library. The UI includes loading, empty, error and fallback-cover states.
