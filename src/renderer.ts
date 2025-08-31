/**
 * This file will automatically be loaded by webpack and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/latest/tutorial/process-model
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.js` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import "./index.css"
import "./styles.css"
import "@fortawesome/fontawesome-free/css/all.min.css"

console.log('👋 This message is being logged by"renderer.ts", bundled via webpack')

// Define the Electron API interface
interface ElectronAPI {
  ipcRenderer: {
    send(channel: string, ...args: any[]): void // eslint-disable-line @typescript-eslint/no-explicit-any
    on(channel: string, func: (...args: any[]) => void): void // eslint-disable-line @typescript-eslint/no-explicit-any
  }
}

// Define event interface
interface IpcRendererEvent {
  sender: any // eslint-disable-line @typescript-eslint/no-explicit-any
  // Add other properties as needed
}

// Define lyrics line interface
interface LyricsLine {
  time: number // Time in seconds
  text: string
}

// Define lyrics cache interface
interface LyricsCache {
  [key: string]: string | null // songId -> lyrics
}

declare global {
  interface Window {
    electron: ElectronAPI
  }
}

// Get DOM elements
const loginButton = document.getElementById("login-btn") as HTMLButtonElement
const authStatus = document.getElementById("auth-status") as HTMLDivElement
const loginStatus = document.getElementById("login-status") as HTMLSpanElement
const tokenExpiry = document.getElementById("token-expiry") as HTMLSpanElement
const mainView = document.getElementById("main-view") as HTMLDivElement
const statusMessage = document.getElementById("status-message") as HTMLParagraphElement
const lyricsContainer = document.getElementById("lyrics-container") as HTMLDivElement
const songTitle = document.getElementById("song-title") as HTMLParagraphElement
const songArtist = document.getElementById("song-artist") as HTMLParagraphElement
const songAlbum = document.getElementById("song-album") as HTMLParagraphElement
const songDuration = document.getElementById("song-duration") as HTMLParagraphElement
const songProgress = document.getElementById("song-progress") as HTMLDivElement
const songProgressCurrent = document.getElementById("song-progress-current") as HTMLSpanElement
const songProgressTotal = document.getElementById("song-progress-total") as HTMLSpanElement
const fetchSongButton = document.getElementById("fetch-song-btn") as HTMLButtonElement
const stickTopButton = document.getElementById("stick-top-btn") as HTMLButtonElement
const toggleOpacityButton = document.getElementById("toggle-opacity-btn") as HTMLButtonElement

// Track authentication state
let isAuthenticated = false
let tokenExpiryTime: number | null = null

// Track current song and lyrics
let currentSongId: string | null = null
let lyricsLines: LyricsLine[] = []
let currentLyricsIndex = -1
let songStartTime: number | null = null
let songProgressMs: number | null = null
let isPlaying = false
let localSongProgressMs: number | null = null
let songProgressTimer: NodeJS.Timeout | null = null

// Track transparency state
let isTransparent = false

// Lyrics cache
const lyricsCache: LyricsCache = {}

function initializeApp() {
  const storedTokenExpiry = sessionStorage.getItem("tokenExpiryTime")
  if (storedTokenExpiry && parseInt(storedTokenExpiry) > Date.now()) {
    isAuthenticated = true
    tokenExpiryTime = parseInt(storedTokenExpiry)

    // Hide login button and show auth status
    if (loginButton) loginButton.classList.add("hidden")
    if (authStatus) authStatus.classList.remove("hidden")
    if (fetchSongButton) fetchSongButton.classList.remove("hidden")
    if (stickTopButton) stickTopButton.classList.remove("hidden")
    if (toggleOpacityButton) toggleOpacityButton.classList.remove("hidden")

    // Update auth status
    if (loginStatus) loginStatus.textContent = "Logged in"
    updateTokenExpiry()

    // Request current song
    window.electron.ipcRenderer.send("request-current-song")
  } else {
    // Not authenticated - automatically initiate Spotify login
    if (loginButton) loginButton.classList.remove("hidden")
    if (authStatus) authStatus.classList.add("hidden")
    if (fetchSongButton) fetchSongButton.classList.add("hidden")
    if (stickTopButton) stickTopButton.classList.add("hidden")
    if (toggleOpacityButton) toggleOpacityButton.classList.add("hidden")
    
    // Automatically trigger Spotify login
    initiateSpotifyLogin()
  }
}

// Function to automatically initiate Spotify login
function initiateSpotifyLogin() {
  window.electron.ipcRenderer.send("login-spotify")
}

// Add click event listener to the login button
if (loginButton) {
  loginButton.addEventListener("click", () => {
    window.electron.ipcRenderer.send("login-spotify")
  })
}

// Add click event listener to the fetch song button
if (fetchSongButton) {
  fetchSongButton.addEventListener("click", () => {
    const icon = fetchSongButton.querySelector('i')
    if (icon) {
      icon.classList.add('fa-spin')
    }
    fetchSongButton.title = "Fetching..."
    window.electron.ipcRenderer.send("request-current-song")
  })
}

// Add click event listener to the stick to top button
if (stickTopButton) {
  stickTopButton.addEventListener("click", () => {
    window.electron.ipcRenderer.send("toggle-always-on-top")
  })
}

// Add click event listener to the toggle opacity button
if (toggleOpacityButton) {
  toggleOpacityButton.addEventListener("click", () => {
    toggleBackgroundOpacity()
  })
}

// Function to toggle background opacity
function toggleBackgroundOpacity() {
  isTransparent = !isTransparent
  
  const appContainer = document.querySelector('.app-container')
  const lyricsContainerElement = document.getElementById('lyrics-container')
  
  if (isTransparent) {
    // Apply transparent styles
    if (appContainer) {
      appContainer.classList.add('transparent-background')
    }
    if (lyricsContainerElement) {
      lyricsContainerElement.classList.add('transparent-lyrics-container')
    }
    
    // Update button icon and title
    if (toggleOpacityButton) {
      toggleOpacityButton.title = "Make Background Opaque"
      toggleOpacityButton.classList.add('transparent')
      const icon = toggleOpacityButton.querySelector('i')
      if (icon) {
        icon.className = 'fas fa-eye-slash'
      }
    }
  } else {
    // Remove transparent styles
    if (appContainer) {
      appContainer.classList.remove('transparent-background')
    }
    if (lyricsContainerElement) {
      lyricsContainerElement.classList.remove('transparent-lyrics-container')
    }
    
    // Update button icon and title
    if (toggleOpacityButton) {
      toggleOpacityButton.title = "Make Background Transparent"
      toggleOpacityButton.classList.remove('transparent')
      const icon = toggleOpacityButton.querySelector('i')
      if (icon) {
        icon.className = 'fas fa-eye'
      }
    }
  }
}

// Listen for Spotify authentication success
window.electron.ipcRenderer.on("spotify-auth-success", () => {
  isAuthenticated = true
  tokenExpiryTime = Date.now() + 60 * 60 * 1000 // 1 hour from now
  sessionStorage.setItem("tokenExpiryTime", tokenExpiryTime.toString())

  // Hide login button and show auth status
  if (loginButton) loginButton.classList.add("hidden")
  if (authStatus) authStatus.classList.remove("hidden")
  if (fetchSongButton) fetchSongButton.classList.remove("hidden")
  if (stickTopButton) stickTopButton.classList.remove("hidden")
  if (toggleOpacityButton) toggleOpacityButton.classList.remove("hidden")

  // Update auth status
  if (loginStatus) loginStatus.textContent = "Logged in"
  updateTokenExpiry()

  // Update status message
  if (statusMessage) statusMessage.textContent = "Connecting to Spotify..."

  // Set initial song info
  if (songTitle) songTitle.textContent = "-"
  if (songArtist) songArtist.textContent = "-"
  if (songAlbum) songAlbum.textContent = "-"
  if (songDuration) songDuration.textContent = "-"
  if (songProgressCurrent) songProgressCurrent.textContent = "0:00"
  if (songProgressTotal) songProgressTotal.textContent = "0:00"
  if (songProgress) songProgress.style.width = "0%"
})

// Listen for Spotify authentication error
window.electron.ipcRenderer.on("spotify-auth-error", (_event: IpcRendererEvent, message?: string) => {
  if (statusMessage) statusMessage.textContent = message || "Failed to authenticate with Spotify. Please try again."
  if (loginStatus) loginStatus.textContent = "Authentication failed"
  if (stickTopButton) stickTopButton.classList.add("hidden")
  if (toggleOpacityButton) toggleOpacityButton.classList.add("hidden")
  
  // Show login button so user can try again
  if (loginButton) loginButton.classList.remove("hidden")
})

// Listen for lyrics update
window.electron.ipcRenderer.on("update-lyrics", (_event: IpcRendererEvent, lyrics: string | null) => {
  if (fetchSongButton) {
    // Stop spinning animation
    const icon = fetchSongButton.querySelector('i')
    if (icon) {
      icon.classList.remove('fa-spin')
    }
    fetchSongButton.title = "Lyrics Fetched"

    // Change icon to checkmark temporarily
    if (icon) {
      icon.className = 'fas fa-check'
    }

    // Reset to refresh icon after 2 seconds
    setTimeout(() => {
      if (icon) {
        icon.className = 'fas fa-sync-alt'
      }
      if (fetchSongButton) {
        fetchSongButton.title = "Fetch Current Song"
      }
    }, 2000)
  }

  console.log({ lyrics })
  console.log({ lyricsLines })
  console.log(lyricsLines.length)
  console.log("update-lyrics")

  // Cache the lyrics for the current song
  if (currentSongId) {
    lyricsCache[currentSongId] = lyrics
  }

  // Only update lyrics if it's a new song
  // We determine this by checking if we have lyrics already
  const isNewSong = lyricsLines.length === 0

  if (lyrics && lyrics !== "") {
    // Parse synced lyrics if they exist
    if (isSyncedLyrics(lyrics)) {
      lyricsLines = parseSyncedLyrics(lyrics)
      currentLyricsIndex = -1
      updateLyricsDisplay()
    } else {
      // Display plain lyrics
      if (lyricsContainer) lyricsContainer.textContent = lyrics
      if (statusMessage) statusMessage.textContent = ""
      lyricsLines = []
      currentLyricsIndex = -1
    }
  } else if (isNewSong) {
    // If it's a new song and can't find lyrics, show "no lyrics found" text
    if (lyricsContainer) lyricsContainer.textContent = "Lyrics not found for this song."
    if (statusMessage) statusMessage.textContent = ""
    lyricsLines = []
    currentLyricsIndex = -1

    if (songProgressTimer) {
      clearInterval(songProgressTimer)
      songProgressTimer = null
    }
  } else {
    // song was probably paused, clear the timer to stop the lyrics from progressing
    if (songProgressTimer) {
      clearInterval(songProgressTimer)
      songProgressTimer = null
    }
  }
  // If it's not a new song and lyrics are null/empty, we don't update anything
})

// Listen for status updates
window.electron.ipcRenderer.on("update-status", (_event: IpcRendererEvent, message: string) => {
  // Ensure message is a string
  const msg = message || ""

  console.log("update-status: ", msg)

  // Check if this is a"Now playing" message
  if (msg.startsWith("Now playing:")) {
    // Parse the message to extract song info
    const match = msg.match(/Now playing: (.+) by (.+?)(?: \(.*\))?$/)

    if (match) {
      const [, title, artist] = match
      if (songTitle) songTitle.textContent = title || "-"
      if (songArtist) songArtist.textContent = artist || "-"
    }

    // Clear status message when we have a song
    if (statusMessage) statusMessage.textContent = ""
  } else if (msg.includes("Error")) {
    if (statusMessage) statusMessage.textContent = msg
  } else {
    if (statusMessage) statusMessage.textContent = msg
  }
})

// Listen for when we start fetching lyrics
window.electron.ipcRenderer.on("fetching-lyrics", () => {
  if (fetchSongButton) {
    const icon = fetchSongButton.querySelector('i')
    if (icon) {
      icon.classList.add('fa-spin')
    }
    fetchSongButton.title = "Fetching Lyrics..."
  }
  if (statusMessage) statusMessage.textContent = "Fetching lyrics..."
})

// Listen for always on top status updates
window.electron.ipcRenderer.on("always-on-top-updated", (_event: IpcRendererEvent, isAlwaysOnTop: boolean) => {
  if (stickTopButton) {
    if (isAlwaysOnTop) {
      stickTopButton.classList.add("stuck")
      stickTopButton.title = "Sticking to Top"
    } else {
      stickTopButton.classList.remove("stuck")
      stickTopButton.title = "Stick to Top"
    }
  }
})

// Listen for detailed song information
window.electron.ipcRenderer.on("update-song-info", (_event: IpcRendererEvent, songInfo: any) => {
  if (songInfo && songInfo.item) {
    const item = songInfo.item
    const newSongId = item.id

    // Check if it's a new song
    if (newSongId !== currentSongId) {
      currentSongId = newSongId
      lyricsLines = []
      currentLyricsIndex = -1

      // Check if we have cached lyrics for this song
      if (lyricsCache[newSongId]) {
        // Use cached lyrics
        console.log("Using cached lyrics for song:", newSongId)
        window.electron.ipcRenderer.send("update-lyrics", lyricsCache[newSongId])
      } else {
        // Request new lyrics
        console.log("Fetching lyrics for new song:", newSongId)
        window.electron.ipcRenderer.send("request-lyrics", { track: item.name, artist: item.artists[0].name })
      }
    }

    // Update song details
    if (songTitle) songTitle.textContent = item.name || "-"
    if (songArtist)
      songArtist.textContent =
        item.artists && item.artists.length > 0 ? item.artists.map((artist: any) => artist.name).join(", ") : "-"
    if (songAlbum) songAlbum.textContent = item.album ? item.album.name : "-"

    // Format duration
    const durationMs = item.duration_ms || 0
    const durationSec = Math.floor(durationMs / 1000)
    const durationMin = Math.floor(durationSec / 60)
    const durationRemSec = durationSec % 60
    if (songDuration) songDuration.textContent = `${durationMin}:${durationRemSec.toString().padStart(2, "0")}`
    if (songProgressTotal)
      songProgressTotal.textContent = `${durationMin}:${durationRemSec.toString().padStart(2, "0")}`

    // Update progress and playing state
    songProgressMs = songInfo.progress_ms || 0
    isPlaying = songInfo.is_playing || false

    // Clear any existing timer
    if (songProgressTimer) {
      clearInterval(songProgressTimer)
      songProgressTimer = null
    }

    // Set song start time for synced lyrics
    if (isPlaying) {
      songStartTime = Date.now() - songProgressMs
      localSongProgressMs = songProgressMs

      // Start a local timer to update the progress
      songProgressTimer = setInterval(() => {
        if (isPlaying && songStartTime) {
          localSongProgressMs = Date.now() - songStartTime
          updateProgressDisplay(localSongProgressMs)
          updateSyncedLyrics(localSongProgressMs / 1000)
        }
      }, 100)
    } else {
      localSongProgressMs = songProgressMs
    }

    // Update progress display
    updateProgressDisplay(localSongProgressMs)

    // Clear status message
    if (statusMessage) statusMessage.textContent = ""
  }
})

// Function to update progress display
function updateProgressDisplay(progress: number) {
  if (progress === null) return

  const progressSec = Math.floor(progress / 1000)
  const progressMin = Math.floor(progressSec / 60)
  const progressRemSec = progressSec % 60
  if (songProgressCurrent)
    songProgressCurrent.textContent = `${progressMin}:${progressRemSec.toString().padStart(2, "0")}`

  // Update progress bar if we have duration
  const durationElement = document.getElementById("song-duration")
  if (durationElement) {
    const durationText = durationElement.textContent || "0:00"
    const [durationMinStr, durationSecStr] = durationText.split(":")
    const durationMs = (parseInt(durationMinStr) * 60 + parseInt(durationSecStr)) * 1000

    if (durationMs > 0) {
      const progressPercent = (progress / durationMs) * 100
      if (songProgress) songProgress.style.width = `${Math.min(progressPercent, 100)}%`
    }
  }
}

// Function to check if lyrics are synced
function isSyncedLyrics(lyrics: string): boolean {
  // Check if lyrics contain timestamp format [mm:ss.xx]
  return /\d{2}:\d{2}\.\d{2}\]/.test(lyrics)
}

// Function to parse synced lyrics
function parseSyncedLyrics(lyrics: string): LyricsLine[] {
  const lines: LyricsLine[] = []
  const lyricLines = lyrics.split("\n")

  for (const line of lyricLines) {
    // Match timestamp format [mm:ss.xx] or [mm:ss]
    const timestampMatch = line.match(/\[(\d{2}):(\d{2})\.(\d{2})\](.*)/)
    if (timestampMatch) {
      const [, minutes, seconds, centiseconds, text] = timestampMatch
      const time = parseInt(minutes) * 60 + parseInt(seconds) + parseInt(centiseconds || "0") / 100
      lines.push({ time, text: text.trim() })
    }
  }

  return lines
}

// Function to update synced lyrics display
function updateSyncedLyrics(currentTime: number) {
  if (lyricsLines.length === 0) return

  // Add a small offset for better timing
  const timeOffset = 0.5 // 500ms
  const adjustedTime = currentTime + timeOffset

  // Find the current lyrics line
  let newIndex = -1
  for (let i = 0; i < lyricsLines.length; i++) {
    if (lyricsLines[i].time <= adjustedTime) {
      newIndex = i
    } else {
      break
    }
  }

  // Update display if index changed
  if (newIndex !== currentLyricsIndex) {
    currentLyricsIndex = newIndex
    updateLyricsDisplay()
  }
}

// Function to update lyrics display
function updateLyricsDisplay() {
  if (!lyricsContainer) return

  if (lyricsLines.length === 0) {
    return
  }

  // Create HTML for synced lyrics
  let html = ""
  for (let i = 0; i < lyricsLines.length; i++) {
    const line = lyricsLines[i]
    const className =
      i === currentLyricsIndex
        ? "lyrics-line current"
        : i < currentLyricsIndex
          ? "lyrics-line past"
          : "lyrics-line future"
    html += `<div class="${className}" data-time="${line.time}">${line.text || "♪"}</div>`
  }

  lyricsContainer.innerHTML = html

  // Scroll to the current line
  const currentLineElement = lyricsContainer.querySelector(".lyrics-line.current")
  if (currentLineElement) {
    currentLineElement.scrollIntoView({ behavior: "smooth", block: "center" })
  }
}

// Function to update token expiry display
function updateTokenExpiry() {
  if (tokenExpiryTime) {
    const now = Date.now()
    const minutesLeft = Math.floor((tokenExpiryTime - now) / (1000 * 60))

    if (minutesLeft > 0) {
      tokenExpiry.textContent = `${minutesLeft} minutes`
    } else {
      tokenExpiry.textContent = "Expired"
      loginStatus.textContent = "Token expired"
    }
  }
}

// Update token expiry every minute
setInterval(() => {
  if (isAuthenticated) {
    updateTokenExpiry()
  }
}, 60000)

initializeApp()
