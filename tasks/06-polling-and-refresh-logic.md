
# Task 6: Polling and Refresh Logic

**Goal:** Tie all the services together in the main process to create the core application loop.

### Steps:

1.  **Implement the Core Loop in `main.ts`:**
    *   After the user has successfully authenticated with Spotify, start a `setInterval` loop that runs every few seconds (e.g., 5-10 seconds).

2.  **Inside the Loop:**
    *   **Get Current Song:** Call the `getCurrentlyPlaying` function from the Spotify service.
    *   **Check for Song Change:**
        *   Store the ID of the current song in a variable.
        *   On each loop iteration, compare the new song ID with the stored ID.
        *   If they are the same, do nothing and wait for the next iteration.
    *   **Fetch New Lyrics:**
        *   If the song has changed (or if it's the first run):
            *   Update the stored song ID.
            *   Call the `getLyrics` function from the Musixmatch service with the new track and artist.
            *   Send the new lyrics to the UI process using `mainWindow.webContents.send('update-lyrics', lyrics)`.
    *   **Handle No Song Playing:**
        *   If `getCurrentlyPlaying` returns that no song is active, send a status update to the UI: `mainWindow.webContents.send('update-status', 'No song playing on Spotify.')`.

3.  **Initial State:**
    *   When the app first starts and after login, trigger the loop immediately once to fetch the first song without waiting for the interval.

4.  **Refine IPC Communication:**
    *   Ensure all communication between the main process (backend logic) and the renderer process (UI) is handled cleanly via the established IPC channels.
