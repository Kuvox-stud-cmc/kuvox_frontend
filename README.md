# kuvox-frontend

The web frontend of **Kuvox** — a graph-augmented retrieval system for intelligent
video editing. This is a React + TypeScript single-page application that provides
the video upload UI, timeline editor, preview playback, conversational command
interface, and project management screens. It communicates with the ASP.NET
business backend via REST and WebSocket.

## Tech stack

- **React** with **React Router v7** (file-based routing, SSR-capable)
- **Redux** for global state management
- **TypeScript** (strict mode)
- **TailwindCSS** for styling
- **Vite** for bundling and HMR

## Prerequisites

- Node.js **20+** (LTS recommended)
- npm (ships with Node)

## Getting started

```bash
# Install dependencies
npm install

# Start the dev server with HMR
npm run dev
```

The app will be available at `http://localhost:5173`.

## Building for production

```bash
npm run build
```

Output lands in `build/` (client + server bundles).

## Environment variables

Configuration is loaded from environment variables (or a `.env` file in
development). Key variables:

| Variable       | Description                         | Default                  |
| -------------- | ----------------------------------- | ------------------------ |
| `VITE_API_URL` | Base URL of the ASP.NET backend     | `http://localhost:5000`  |
| `VITE_WS_URL`  | WebSocket URL for real-time updates | `ws://localhost:5000/ws` |

## Media Processing

Uploads are sent to the ASP.NET API, not directly to the AI service. The frontend
renders the API's media pipeline fields: `Uploaded` appears as optimizing,
optimized images/audio become `Ready`, and optimized videos move to `Processing`
while the AI ingestion worker indexes them. Realtime updates arrive through the
media hub, with polling/loaders acting as the fallback source of truth.

If media appears stuck in optimizing, check the backend first: RabbitMQ queue
`media.optimization.requested` should have a media optimization worker consumer,
and the API's media recovery service should eventually requeue stale `Uploaded`
rows. The frontend does not start workers or mutate pipeline state locally.

## Docker

```bash
docker build -t kuvox-frontend .
docker run -p 3000:3000 kuvox-frontend
```

## Related repositories

- **[kuvox-api](../api)** — ASP.NET business backend
- **[kuvox-ai](../ai-service)** — Python AI / media service
- **[kuvox-mobile](../mobile)** — React Native (Expo) mobile client

## API Design Patterns

The frontend API client (`app/lib/api-client.server.ts` and related files) is architected using several classic design patterns to ensure scalability, modularity, and easy testing:

- **Singleton Pattern**: The `ApiClient.getInstance()` ensures there is only one global instance of the HTTP client managing the base URL and fetch pipelines across the application.
- **Strategy Pattern**: Authentication is implemented via `AuthStrategy` (`NoAuth`, `BearerAuth`), allowing us to cleanly inject different token strategies without altering the core fetch logic.
- **Decorator Pattern**: Middleware functions like `withLogging`, `withCorrelationId`, and `withAuthStrategy` wrap the core `FetchFn`. This allows us to dynamically "decorate" our HTTP requests with logging, headers, and tracing.
- **Template Method Pattern**: `BaseApiModule` provides the skeletal implementation for standard CRUD operations (`list`, `create`, `deleteVoid`). Subclasses like `MediaApi` and `ProjectsApi` inherit this template, keeping the module files incredibly DRY.
- **Facade Pattern**: The exported instances (e.g., `mediaApi`, `projectsApi`) and their backward-compatible wrapper functions (e.g., `listMedia`) act as a simple facade. The UI components call these methods without ever needing to know about the underlying `ApiClient`, headers, or auth strategies.
