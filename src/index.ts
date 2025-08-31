import axios, { isAxiosError } from "axios"
import * as dotenv from "dotenv"
import { app, BrowserWindow, ipcMain } from "electron"
import * as http from "http"
import * as url from "url"
import { getLyrics } from "./services/lrclibService"
import { initiateSpotifyLogin } from "./services/spotifyAuth"
import { getCurrentlyPlaying, refreshAccessToken } from "./services/spotifyService"

dotenv.config()

declare const MAIN_WINDOW_WEBPACK_ENTRY: string
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string

let mainWindow: BrowserWindow | null

// In a real application, you should use a more secure method to store tokens
let spotifyTokens: { access_token: string; refresh_token: string } | null = null

// Polling variables
let pollInterval: NodeJS.Timeout | null = null
let currentSongId: string | null = null

// Lyrics cache
const lyricsCache: { [key: string]: string | null } = {}

if (require("electron-squirrel-startup")) {
  app.quit()
}

const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    height: 600,
    width: 800,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY
    }
  })

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY)

  mainWindow.webContents.openDevTools()
}

app.on("ready", createWindow)

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// Function to start polling for currently playing song
function startPolling() {
  // Clear any existing interval
  if (pollInterval) {
    clearInterval(pollInterval)
  }

  // Start new polling interval (every 5 seconds)
  pollInterval = setInterval(async () => {
    await checkCurrentlyPlaying()
  }, 5000)

  // Trigger immediately for the first check
  checkCurrentlyPlaying()
}

// Function to check currently playing song
async function checkCurrentlyPlaying() {
  if (!spotifyTokens || !mainWindow) {
    return
  }

  try {
    const result = await getCurrentlyPlaying(spotifyTokens.access_token)

    // Handle case when nothing is playing
    if (!result || !result.is_playing) {
      // Only send update if we were previously showing a song
      if (currentSongId !== null) {
        currentSongId = null
        mainWindow.webContents.send("update-status", "No song is currently playing")
        mainWindow.webContents.send("update-lyrics", null)
      }
      return
    }

    // Get the current song ID (Spotify track ID)
    const songId = result.item.id
    const trackName = result.item.name
    const artistName = result.item.artists[0].name

    // Send detailed song information to renderer
    mainWindow.webContents.send("update-song-info", result)

    // Check if it's a new song
    if (songId !== currentSongId) {
      // Update the current song ID
      currentSongId = songId

      // Update status message
      mainWindow.webContents.send("update-status", `Now playing: ${trackName} by ${artistName}`)

      // Check if we have cached lyrics for this song
      if (lyricsCache[songId]) {
        // Use cached lyrics
        console.log("Using cached lyrics for song:", songId)
        mainWindow.webContents.send("update-lyrics", lyricsCache[songId])
      } else {
        // Notify that we're fetching lyrics
        mainWindow.webContents.send("fetching-lyrics")

        // Fetch lyrics for the new song
        try {
          const lyrics = await getLyrics(trackName, artistName)
          console.log({ lyrics })

          // Cache the lyrics
          lyricsCache[songId] = lyrics

          mainWindow.webContents.send("update-lyrics", lyrics)

          if (!lyrics) {
            mainWindow.webContents.send(
              "update-status",
              `Now playing: ${trackName} by ${artistName} (Lyrics not found)`
            )
          }
        } catch (lyricsError) {
          console.error("Error fetching lyrics:", lyricsError)
          mainWindow.webContents.send("update-lyrics", null)
          mainWindow.webContents.send(
            "update-status",
            `Now playing: ${trackName} by ${artistName} (Error fetching lyrics)`
          )
        }
      }
    }
  } catch (error: unknown) {
    // Handle token expiration
    if (isAxiosError(error) && error.response?.status === 401) {
      try {
        // Refresh the access token
        const newAccessToken = await refreshAccessToken(spotifyTokens.refresh_token)
        spotifyTokens.access_token = newAccessToken

        // Retry the request with the new token
        await checkCurrentlyPlaying()
      } catch (refreshError) {
        console.error("Error refreshing token:", refreshError)
        if (mainWindow) {
          mainWindow.webContents.send("update-status", "Error refreshing Spotify authentication")
        }
      }
    } else {
      console.error("Error fetching currently playing song:", error)
      if (mainWindow) {
        mainWindow.webContents.send("update-status", "Error fetching currently playing song")
      }
    }
  }
}

ipcMain.on("login-spotify", () => {
  initiateSpotifyLogin()

  // Create server to handle Spotify callback
  const server = http.createServer((req: any, res: any) => {
    const parsedUrl = url.parse(req.url || "", true)
    if (parsedUrl.pathname === "/callback") {
      const code = parsedUrl.query.code as string

      // Send response to user
      res.writeHead(200, { "Content-Type": "text/html" })
      res.end(`
        <html>
          <body>
            <h1>Authentication successful!</h1>
            <p>You can close this window now.</p>
            <script>
              // Close the window after a short delay
              setTimeout(() => {
                window.close();
              }, 2000);
            </script>
          </body>
        </html>
      `)

      // Handle the authentication response
      handleSpotifyCallback(code)
        .then(() => {
          // Close server after handling callback
          server.close(() => {
            console.log("Callback server closed")
          })
        })
        .catch((error) => {
          console.error("Error handling Spotify callback:", error)
          server.close(() => {
            console.log("Callback server closed due to error")
          })
        })
    } else {
      // Handle other routes
      res.writeHead(404, { "Content-Type": "text/plain" })
      res.end("Not found")
    }
  })

  server.listen(3000, () => {
    console.log("Callback server listening on port 3000")
  })

  // Handle server errors
  server.on("error", (error: any) => {
    console.error("Callback server error:", error)
    mainWindow?.webContents.send("spotify-auth-error", "Failed to start callback server")
  })
})

// Handle Spotify authentication callback
async function handleSpotifyCallback(code: string) {
  try {
    const response = await axios.post(
      "https://accounts.spotify.com/api/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI || "",
        client_id: process.env.SPOTIFY_CLIENT_ID || "",
        client_secret: process.env.SPOTIFY_CLIENT_SECRET || ""
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    )

    const { access_token, refresh_token } = response.data
    // Store tokens securely (in a real app, use a secure storage solution)
    spotifyTokens = { access_token, refresh_token }

    mainWindow?.webContents.send("spotify-auth-success")

    // Start polling after successful authentication
    startPolling()
  } catch (error) {
    console.error("Error getting tokens", error)
    mainWindow?.webContents.send("spotify-auth-error", "Failed to get authentication tokens")
  }
}

// IPC handler for requesting the current song (manual refresh)
ipcMain.on("request-current-song", async () => {
  await checkCurrentlyPlaying()
})

// IPC handler for toggling always on top
ipcMain.on("toggle-always-on-top", () => {
  if (mainWindow) {
    const isAlwaysOnTop = mainWindow.isAlwaysOnTop()
    mainWindow.setAlwaysOnTop(!isAlwaysOnTop)
    mainWindow.webContents.send("always-on-top-updated", !isAlwaysOnTop)
  }
})
