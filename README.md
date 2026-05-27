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

## Docker

```bash
docker build -t kuvox-frontend .
docker run -p 3000:3000 kuvox-frontend
```

## Related repositories

- **[kuvox-api](../api)** — ASP.NET business backend
- **[kuvox-ai](../ai-service)** — Python AI / media service
- **[kuvox-mobile](../mobile)** — React Native (Expo) mobile client
