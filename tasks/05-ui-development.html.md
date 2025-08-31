
# Task 5: UI Development

**Goal:** Create the user interface to display the lyrics and handle user interactions.

### Steps:

1.  **Structure the HTML:**
    *   In `src/index.html`, create the basic layout.
    *   Include a "Login with Spotify" button.
    *   Add a main container `<div>` (e.g., `<div id="lyrics-container">`) where the lyrics will be displayed.
    *   Add a status message area (e.g., `<p id="status-message">`) to show messages like "Connecting to Spotify..." or "No song playing."

2.  **Style the Application:**
    *   Create a `src/styles.css` file and link it in your `index.html`.
    *   Apply modern styling. A dark theme is often preferred for media-related apps.
    *   Style the lyrics container for readability (e.g., good font size, line height, centered text).
    *   Initially hide the lyrics container and login button as appropriate.

3.  **Implement Renderer Logic (`src/renderer.ts`):**
    *   **Login Button:**
        *   Add a click event listener to the "Login with Spotify" button.
        *   When clicked, use `ipcRenderer.send()` to send a message (e.g., `'login-spotify'`) to the main process to start the authentication flow.
    *   **Update UI:**
        *   Use `ipcRenderer.on()` to listen for messages from the main process:
            *   `'spotify-auth-success'`: Hide the login button and show the main lyrics view.
            *   `'update-lyrics'`: This message should include the lyrics text. Update the content of the `#lyrics-container` div with the new lyrics.
            *   `'update-status'`: This message should include a status text. Update the `#status-message` element.

4.  **Preload Script:**
    *   Ensure your `preload.ts` script is correctly configured in your Webpack/Electron setup to safely expose `ipcRenderer` to the renderer process. The default Electron Forge template should handle this.
