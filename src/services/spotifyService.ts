import axios from 'axios';

interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
}

interface SpotifyCurrentlyPlayingResponse {
  is_playing: boolean;
  item: SpotifyTrack;
}

/**
 * Fetches the currently playing song from Spotify
 * @param access_token The Spotify access token
 * @returns Currently playing track information or null if nothing is playing
 */
export async function getCurrentlyPlaying(access_token: string): Promise<SpotifyCurrentlyPlayingResponse | null> {
  try {
    const response = await axios.get<SpotifyCurrentlyPlayingResponse>(
      'https://api.spotify.com/v1/me/player/currently-playing',
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    // If nothing is playing, Spotify returns 204 No Content
    if (response.status === 204) {
      return null;
    }

    return response.data;
  } catch (error) {
    console.error('Error fetching currently playing song:', error);
    throw error;
  }
}

/**
 * Refreshes the Spotify access token
 * @param refresh_token The Spotify refresh token
 * @returns New access token
 */
export async function refreshAccessToken(refresh_token: string): Promise<string> {
  try {
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refresh_token,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(
            `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
          ).toString('base64')}`,
        },
      }
    );

    return response.data.access_token;
  } catch (error) {
    console.error('Error refreshing access token:', error);
    throw error;
  }
}