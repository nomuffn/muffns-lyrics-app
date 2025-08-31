import { shell } from 'electron';
import * as dotenv from 'dotenv';

dotenv.config();

const spotifyClientId = process.env.SPOTIFY_CLIENT_ID;
const spotifyRedirectUri = process.env.SPOTIFY_REDIRECT_URI;

export function initiateSpotifyLogin() {
    if (!spotifyClientId || !spotifyRedirectUri) {
        throw new Error('Spotify client ID or redirect URI not configured');
    }
    
    const scopes = 'user-read-playback-state';
    const authUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${spotifyClientId}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(spotifyRedirectUri)}`;

    shell.openExternal(authUrl);
}
