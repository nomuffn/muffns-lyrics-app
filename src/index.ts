import axios, { isAxiosError } from "axios"
import * as dotenv from "dotenv"
import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen } from "electron"
import * as http from "http"
import * as url from "url"
import * as path from "path"
import * as fs from "fs"
import { getLyrics } from "./services/lrclibService"
import { initiateSpotifyLogin } from "./services/spotifyAuth"
import { getCurrentlyPlaying, refreshAccessToken } from "./services/spotifyService"

// Load environment variables (webpack DefinePlugin will handle this in production)
if (!app.isPackaged) {
  // In development, load from .env file
  dotenv.config()
}

console.log("Spotify Client ID loaded:", process.env.SPOTIFY_CLIENT_ID ? "Yes" : "No")

declare const MAIN_WINDOW_WEBPACK_ENTRY: string
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string

let mainWindow: BrowserWindow | null
let tray: Tray | null = null

// In a real application, you should use a more secure method to store tokens
let spotifyTokens: { access_token: string; refresh_token: string } | null = null

// Polling variables
let pollInterval: NodeJS.Timeout | null = null
let currentSongId: string | null = null

// Lyrics cache
const lyricsCache: { [key: string]: string | null } = {}

// Settings management
interface AppSettings {
  windowPosition?: { x: number; y: number }
  windowSize?: { width: number; height: number }
  alwaysOnTop?: boolean
  opacityLevel?: number
  showInTaskbar?: boolean
}

let appSettings: AppSettings = {}

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

function loadSettings(): AppSettings {
  try {
    const settingsPath = getSettingsPath()
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8')
      return JSON.parse(data)
    }
  } catch (error) {
    console.error('Error loading settings:', error)
  }
  return {
    alwaysOnTop: true, // Default to always on top
    opacityLevel: 0 // Default to opaque
  }
}

function saveSettings(): void {
  try {
    const settingsPath = getSettingsPath()
    fs.writeFileSync(settingsPath, JSON.stringify(appSettings, null, 2))
  } catch (error) {
    console.error('Error saving settings:', error)
  }
}

if (require("electron-squirrel-startup")) {
  app.quit()
}

const createSystemTray = (): void => {
  // Only create tray if it doesn't exist
  if (tray) {
    updateTrayMenu()
    return
  }

  // Create a simple programmatic icon as fallback
  const trayIcon = nativeImage.createFromBuffer(
    Buffer.from([
      // Simple 16x16 PNG header + minimal icon data
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00, 0x10,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x91, 0x68, 0x36, 0x00, 0x00, 0x00,
      0x0C, 0x49, 0x44, 0x41, 0x54, 0x28, 0x15, 0x63, 0xF8, 0x0F, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x18, 0xDD, 0x8D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ])
  )

  // Try to use a simple fallback icon, or use programmatic icon
  let iconToUse = trayIcon
  try {
    // Try different potential icon locations
    const possiblePaths = [
      path.join(__dirname, '../assets/icon.png'),
      path.join(__dirname, '../assets/tray.png'),
      path.join(process.resourcesPath, 'assets/icon.png')
    ]
    
    for (const iconPath of possiblePaths) {
      if (fs.existsSync(iconPath)) {
        iconToUse = nativeImage.createFromPath(iconPath)
        break
      }
    }
  } catch (error) {
    console.log('Using programmatic tray icon:', error)
  }

  tray = new Tray(iconToUse)
  
  // Handle tray click to show/hide window
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide()
      } else {
        mainWindow.show()
        mainWindow.focus()
      }
    }
  })

  tray.setToolTip('Lyrics App - Currently Playing Songs')
  updateTrayMenu()
}

const updateTrayMenu = (): void => {
  if (!tray) return
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Window',
      type: 'normal',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        }
      }
    },
    {
      label: 'Bring to Top',
      type: 'normal',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
          mainWindow.moveTop()
        }
      }
    },
    {
      label: 'Hide Window',
      type: 'normal',
      click: () => {
        if (mainWindow) {
          mainWindow.hide()
        }
      }
    },
    {
      label: 'Reset Window Position',
      type: 'normal',
      click: () => {
        if (mainWindow) {
          // Reset to center of screen
          const primaryDisplay = screen.getPrimaryDisplay()
          const { width, height } = primaryDisplay.workAreaSize
          
          const windowWidth = 800
          const windowHeight = 600
          const x = Math.floor((width - windowWidth) / 2)
          const y = Math.floor((height - windowHeight) / 2)
          
          mainWindow.setBounds({
            x: x,
            y: y,
            width: windowWidth,
            height: windowHeight
          })
          mainWindow.show()
          mainWindow.focus()
          
          // Update saved settings
          appSettings.windowPosition = { x, y }
          appSettings.windowSize = { width: windowWidth, height: windowHeight }
          saveSettings()
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Show Taskbar Icon',
      type: 'checkbox',
      checked: appSettings.showInTaskbar !== false,
      click: () => {
        if (mainWindow) {
          const newShowInTaskbar = !(appSettings.showInTaskbar !== false)
          mainWindow.setSkipTaskbar(!newShowInTaskbar)
          
          // Save the setting
          appSettings.showInTaskbar = newShowInTaskbar
          saveSettings()
          
          // Update tray menu to reflect new state
          updateTrayMenu()
        }
      }
    },
    {
      label: 'Always On Top',
      type: 'checkbox',
      checked: appSettings.alwaysOnTop !== false,
      click: () => {
        // Trigger the same toggle as the UI button
        if (mainWindow) {
          const isAlwaysOnTop = mainWindow.isAlwaysOnTop()
          const newState = !isAlwaysOnTop
          mainWindow.setAlwaysOnTop(newState, newState ? 'screen-saver' : 'normal')
          appSettings.alwaysOnTop = newState
          saveSettings()
          mainWindow.webContents.send("always-on-top-updated", newState)
          
          // Update tray menu
          updateTrayMenu()
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      type: 'normal',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
}

const createWindow = (): void => {
  // Load settings
  appSettings = loadSettings()
  
  mainWindow = new BrowserWindow({
    height: appSettings.windowSize?.height || 600,
    width: appSettings.windowSize?.width || 800,
    x: appSettings.windowPosition?.x,
    y: appSettings.windowPosition?.y,
    frame: false, // Remove window frame
    transparent: true, // Enable transparency
    backgroundColor: "#00000000", // Set background to transparent
    alwaysOnTop: false, // Set to false initially, we'll configure it properly below
    skipTaskbar: false, // Show in taskbar
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Set taskbar visibility based on saved setting (default to show in taskbar)
  const shouldShowInTaskbar = appSettings.showInTaskbar !== false
  mainWindow.setSkipTaskbar(!shouldShowInTaskbar)
  
  // Set always on top with proper level to appear above taskbar
  // Use 'screen-saver' level which is above taskbar but stable
  if (appSettings.alwaysOnTop !== false) {
    mainWindow.setAlwaysOnTop(true, 'screen-saver')
  }

  // Disable the context menu
  mainWindow.webContents.on("context-menu", (e) => {
    e.preventDefault()
  })

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY)

  // Create system tray after window is created
  createSystemTray()

  // Only open DevTools in development, as it breaks transparency
  if (process.env.NODE_ENV === "development") {
    mainWindow.webContents.openDevTools()
  }

  // Save window position and size when changed
  mainWindow.on('moved', () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds()
      appSettings.windowPosition = { x: bounds.x, y: bounds.y }
      saveSettings()
    }
  })

  mainWindow.on('resized', () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds()
      appSettings.windowSize = { width: bounds.width, height: bounds.height }
      saveSettings()
    }
  })

  // Send initial settings to renderer
  mainWindow.webContents.once('did-finish-load', () => {
    if (mainWindow) {
      mainWindow.webContents.send('load-settings', appSettings)
    }
  })
}

app.on("ready", createWindow)

app.on("window-all-closed", () => {
  // Don't quit the app when all windows are closed if tray is active
  // This allows the app to continue running in the system tray
  if (process.platform !== "darwin" && !tray) {
    app.quit()
  }
})

app.on("before-quit", () => {
  // Clean up tray when app is quitting
  if (tray) {
    tray.destroy()
    tray = null
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
    const newState = !isAlwaysOnTop
    
    // Use 'screen-saver' level to ensure window appears above taskbar on Windows
    // This level places the window above the taskbar
    mainWindow.setAlwaysOnTop(newState, newState ? 'screen-saver' : 'normal')
    
    // Save the state
    appSettings.alwaysOnTop = newState
    saveSettings()
    
    mainWindow.webContents.send("always-on-top-updated", newState)
  }
})

// IPC handler for saving opacity level
ipcMain.on("save-opacity-level", (_event, opacityLevel: number) => {
  appSettings.opacityLevel = opacityLevel
  saveSettings()
  
  // Enable click-through when fully transparent (level 3), disable otherwise
  if (mainWindow) {
    if (opacityLevel === 3) {
      // Enable click-through but forward mouse events to buttons
      mainWindow.setIgnoreMouseEvents(true, { forward: true })
    } else {
      // Disable click-through for other transparency levels
      mainWindow.setIgnoreMouseEvents(false)
    }
  }
})

// IPC handler for managing selective mouse events (for button interactions)
ipcMain.on("set-ignore-mouse-events", (_event, ignore: boolean, options?: { forward?: boolean }) => {
  if (mainWindow) {
    mainWindow.setIgnoreMouseEvents(ignore, options)
  }
})
