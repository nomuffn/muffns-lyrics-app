import axios from "axios"

const LRCLIB_BASE_URL = "https://lrclib.net/api"

interface LrcLibSearchResult {
  id: number
  trackName: string
  artistName: string
  albumName: string
  duration: number
  instrumental: boolean
  plainLyrics: string | null
  syncedLyrics: string | null
}

/**
 * Search for tracks on LRCLIB
 * @param query The search query (track and artist)
 * @returns Array of search results
 */
async function searchTracks(query: string): Promise<LrcLibSearchResult[]> {
  try {
    const response = await axios.get<LrcLibSearchResult[]>(`${LRCLIB_BASE_URL}/search`, {
      params: {
        q: query
      },
      headers: {
        "User-Agent": "LyricsApp/1.0 (https://github.com/yourusername/lyrics-app)"
      }
    })

    return response.data
  } catch (error) {
    console.error("Error searching tracks on LRCLIB:", error)
    throw error
  }
}

/**
 * Fetches lyrics from LRCLIB based on track and artist
 * @param track The song title
 * @param artist The artist name
 * @returns The lyrics or null if not found
 */
export async function getLyrics(track: string, artist: string): Promise<string | null> {
  try {
    // Search for the track
    const query = `${track} ${artist}`
    const searchResults = await searchTracks(query)

    // Find the best match
    const bestMatch = searchResults.find(
      (result) =>
        (result.syncedLyrics || result.plainLyrics) &&
        result.trackName.toLowerCase().includes(track.toLowerCase()) &&
        result.artistName.toLowerCase().includes(artist.toLowerCase())
    )

    // If we found a match with lyrics, return them (prefer synced over plain)
    if (bestMatch) {
      if (bestMatch.syncedLyrics) {
        return bestMatch.syncedLyrics
      } else if (bestMatch.plainLyrics) {
        return bestMatch.plainLyrics
      }
    }

    // If no match with lyrics found, just return the first result with lyrics (prefer synced over plain)
    const firstWithLyrics = searchResults.find((result) => result.syncedLyrics || result.plainLyrics)
    if (firstWithLyrics) {
      if (firstWithLyrics.syncedLyrics) {
        return firstWithLyrics.syncedLyrics
      } else if (firstWithLyrics.plainLyrics) {
        return firstWithLyrics.plainLyrics
      }
    }
    
    return null
  } catch (error) {
    console.error("Error fetching lyrics from LRCLIB:", error)
    throw error
  }
}
