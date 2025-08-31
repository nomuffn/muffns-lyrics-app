
# Task 4: Musixmatch API Integration

**Goal:** Fetch lyrics from the Musixmatch API based on the song title and artist from Spotify.

**Note:** This requires a Musixmatch developer account to get an API key. This should be stored securely using `dotenv`.

### Steps:

1.  **Add API Key to `.env`:**
    *   Add your Musixmatch API key to the `.env` file:
        ```
        MUSIXMATCH_API_KEY=your_api_key
        ```

2.  **Create a Musixmatch Service:**
    *   Create a new file (e.g., `src/services/musixmatchService.ts`).

3.  **Implement `getLyrics` function:**
    *   This function should take the `track` name and `artist` name as arguments.
    *   It will make a GET request to the Musixmatch `matcher.lyrics.get` endpoint.
    *   The request URL should look like this:
        ```
        https://api.musixmatch.com/ws/1.1/matcher.lyrics.get?q_track=<track>&q_artist=<artist>&apikey=<your_api_key>
        ```
    *   Use `encodeURIComponent` on the track and artist names to ensure they are URL-safe.

4.  **Handle the Response:**
    *   Parse the JSON response from Musixmatch.
    *   The lyrics are located in `message.body.lyrics.lyrics_body`.
    *   Handle cases where lyrics are not found (Musixmatch may return a 404 status or an empty body).

5.  **Integrate with Main Process:**
    *   In `src/main.ts`, after successfully fetching the currently playing song from Spotify, call this `getLyrics` function with the song details.
