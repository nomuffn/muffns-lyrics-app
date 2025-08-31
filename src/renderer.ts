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

function initializeApp() {
  const storedTokenExpiry = sessionStorage.getItem("tokenExpiryTime")
  if (storedTokenExpiry && parseInt(storedTokenExpiry) > Date.now()) {
    isAuthenticated = true
    tokenExpiryTime = parseInt(storedTokenExpiry)

    // Hide login button and show auth status
    if (loginButton) loginButton.classList.add("hidden")
    if (authStatus) authStatus.classList.remove("hidden")
    if (fetchSongButton) fetchSongButton.classList.remove("hidden")

    // Update auth status
    if (loginStatus) loginStatus.textContent = "Logged in"
    updateTokenExpiry()

    // Show main view
    if (mainView) mainView.classList.remove("hidden")

    // Request current song
    window.electron.ipcRenderer.send("request-current-song")
  } else {
    // Not authenticated
    if (loginButton) loginButton.classList.remove("hidden")
    if (authStatus) authStatus.classList.add("hidden")
    if (fetchSongButton) fetchSongButton.classList.add("hidden")
  }
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
    window.electron.ipcRenderer.send("request-current-song")
  })
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

  // Update auth status
  if (loginStatus) loginStatus.textContent = "Logged in"
  updateTokenExpiry()

  // Show main view
  if (mainView) mainView.classList.remove("hidden")

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
})

// Listen for lyrics update
window.electron.ipcRenderer.on("update-lyrics", (_event: IpcRendererEvent, lyrics: string | null) => {
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
    }
  } else {
    if (lyricsContainer) lyricsContainer.textContent = ""
    if (statusMessage) statusMessage.textContent = "Lyrics not found for this song."
    lyricsLines = []
    currentLyricsIndex = -1
  }
})

// Listen for status updates
window.electron.ipcRenderer.on("update-status", (_event: IpcRendererEvent, message: string) => {
  // Ensure message is a string
  const msg = message || ""

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
  } else if (msg === "No song is currently playing") {
    // Update song info
    if (songTitle) songTitle.textContent = "No song playing"
    if (songArtist) songArtist.textContent = ""
    if (songAlbum) songAlbum.textContent = ""
    if (songDuration) songDuration.textContent = ""
    if (songProgressCurrent) songProgressCurrent.textContent = "0:00"
    if (songProgressTotal) songProgressTotal.textContent = "0:00"
    if (songProgress) songProgress.style.width = "0%"
    if (statusMessage) statusMessage.textContent = msg

    // Clear lyrics
    if (lyricsContainer) lyricsContainer.textContent = ""
    lyricsLines = []
    currentLyricsIndex = -1
  } else if (msg.includes("Error")) {
    if (statusMessage) statusMessage.textContent = msg
  } else {
    if (statusMessage) statusMessage.textContent = msg
  }
})

// Listen for when we start fetching lyrics
window.electron.ipcRenderer.on("fetching-lyrics", () => {
  if (statusMessage) statusMessage.textContent = "Fetching lyrics..."
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
      window.electron.ipcRenderer.send("request-lyrics", { track: item.name, artist: item.artists[0].name })
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
