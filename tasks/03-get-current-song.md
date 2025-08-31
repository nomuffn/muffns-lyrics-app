
# Task 3: Get Currently Playing Song

**Goal:** Use the Spotify API access token to fetch the user's currently playing song.

### Steps:

1.  **Create a Spotify Service:**
    *   Create a new file (e.g., `src/services/spotifyService.ts`).
    *   This service will be responsible for all interactions with the Spotify Web API.

2.  **Implement `getCurrentlyPlaying` function:**
    *   This function should take the `access_token` as an argument.
    *   It will make a GET request to the `https://api.spotify.com/v1/me/player/currently-playing` endpoint.
    *   Include the `access_token` in the `Authorization` header as a Bearer token: `Authorization: Bearer <access_token>`.

3.  **Handle the Response:**
    *   If a song is playing, the API will return a JSON object containing track information.
    *   Parse the response to extract the following details:
        *   `item.name` (the song title)
        *   `item.artists[0].name` (the primary artist's name)
        *   `is_playing` (boolean)
    *   If the response is empty or `is_playing` is false, it means nothing is currently playing.

4.  **Handle Token Refresh:**
    *   The Spotify API will return a `401 Unauthorized` error if the `access_token` is expired.
    *   Implement logic to use the `refresh_token` (obtained during authentication) to request a new `access_token` and retry the API call.

5.  **Integrate with Main Process:**
    *   Call this `getCurrentlyPlaying` function from the main Electron process (`src/main.ts`).
