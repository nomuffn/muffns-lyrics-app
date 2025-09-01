lyrics app - resizable - pin to top - transparency toggle
Made it so i can resize it to a thin window and pin it to a bottom corner of my screen to alway see the current lyrics line of a song


## Features

- Real-time synchronized lyrics display
- Transparent/opaque background modes
- Always-on-top window option
- Resizable interface
- Automatic Spotify integration

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file with your Spotify credentials:
   ```
   SPOTIFY_CLIENT_ID=your_client_id
   SPOTIFY_CLIENT_SECRET=your_client_secret
   SPOTIFY_REDIRECT_URI=http://localhost:3000/callback
   ```

## Usage

Start the development server:
```bash
npm start
```

Build for distribution:
```bash
npm run package
```

## How it Works

The app connects to your Spotify account to fetch currently playing tracks, then retrieves synchronized lyrics from LRCLIB. Lyrics are displayed with real-time highlighting based on playback progress.
