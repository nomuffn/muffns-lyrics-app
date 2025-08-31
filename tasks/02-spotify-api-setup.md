
# Task 2: Spotify API Setup & Authentication

**Goal:** Implement the Spotify OAuth 2.0 Authorization Code Flow to allow the app to access a user's Spotify data.

**Note:** This requires a Spotify Developer account and an App registration to get a `Client ID` and `Client Secret`. These should be stored securely, for example, using an environment variable management library like `dotenv`.

### Steps:

1.  **Install Libraries:**
    *   Install `axios` for making HTTP requests and `dotenv` for managing environment variables.
    *   ```bash
        npm install axios dotenv
        ```

2.  **Create `.env` file:**
    *   Create a `.env` file in the project root to store your Spotify credentials:
        ```
        SPOTIFY_CLIENT_ID=your_client_id
        SPOTIFY_CLIENT_SECRET=your_client_secret
        SPOTIFY_REDIRECT_URI=http://localhost:3000/callback
        ```
    *   Add `.env` to your `.gitignore` file to avoid committing secrets.

3.  **Implement Authentication Flow:**
    *   **Create an Authentication Service:** Create a new file (e.g., `src/services/spotifyAuth.ts`).
    *   **Initiate Authorization:** Create a function that constructs the Spotify authorization URL and opens it in the user's default browser. The URL should request the `user-read-playback-state` scope.
    *   **Handle the Redirect:**
        *   Set up a simple web server within the Electron main process (using Node's `http` module) to listen for the redirect from Spotify at `http://localhost:3000/callback`.
        *   When the callback is received, extract the authorization `code` from the URL query parameters.
    *   **Request Access Tokens:**
        *   Exchange the authorization `code` for an `access_token` and `refresh_token` by making a POST request to Spotify's `/api/token` endpoint.
        *   Securely store the received tokens (e.g., in memory for the session, or using `electron-store` for persistence).

4.  **Expose to UI:**
    *   Create a "Login with Spotify" button in the UI (`index.html`).
    *   Use Electron's `ipcMain` and `ipcRenderer` to trigger the authentication flow from the UI button and notify the UI when authentication is complete.
