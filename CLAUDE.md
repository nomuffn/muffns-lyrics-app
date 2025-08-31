# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Development**: `npm start` - Start the Electron app in development mode
- **Build**: `npm run package` - Package the Electron app for distribution  
- **Distribution**: `npm run make` - Create distributable packages
- **Linting**: `npm run lint` - Run ESLint on TypeScript files

## Architecture Overview

This is an Electron-based lyrics application that displays synchronized lyrics for the currently playing Spotify track.

### Main Process (`src/index.ts`)
- Creates a frameless, transparent Electron window
- Handles Spotify OAuth authentication flow via HTTP callback server
- Manages polling for currently playing track (5-second intervals)
- Coordinates between Spotify API and lyrics fetching services
- Implements lyrics caching system to reduce API calls
- Handles token refresh for expired Spotify access tokens

### Renderer Process (`src/renderer.ts`)  
- Manages UI state and user interactions
- Displays synchronized lyrics with timing-based highlighting
- Handles progress tracking and visual updates
- Implements transparency toggle and always-on-top functionality
- Parses and displays both synced ([mm:ss.xx] format) and plain text lyrics

### Services Layer
- **spotifyAuth.ts**: Initiates Spotify OAuth flow
- **spotifyService.ts**: Fetches currently playing tracks and refreshes tokens
- **lrclibService.ts**: Searches and retrieves lyrics from LRCLIB API

### Key Features
- Real-time lyric synchronization with playback progress
- Lyrics caching to minimize API requests
- Automatic Spotify authentication and token refresh
- Transparent/opaque background modes
- Always-on-top window option

### Environment Variables Required
- `SPOTIFY_CLIENT_ID`: Spotify application client ID
- `SPOTIFY_CLIENT_SECRET`: Spotify application client secret  
- `SPOTIFY_REDIRECT_URI`: OAuth callback URL (typically `http://localhost:3000/callback`)

### Build System
Uses Electron Forge with Webpack for bundling TypeScript sources. The main entry point is `src/index.ts` for the main process and `src/renderer.ts` for the renderer.