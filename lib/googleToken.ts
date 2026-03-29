let cachedToken: string | null = null
let tokenExpiration: Date | null = null
// Fallback token if API fails or hasn't run yet

export async function initializeGoogleToken() {
  try {
    const res = await fetch("https://pflow.app/api/google-auth?id=1", {
      cache: "no-store",
    })

    if (!res.ok) {
      throw new Error(`Failed to fetch token: ${res.status}`)
    }

    const data = await res.json()

    if (data.success && data.data && data.data.access_token) {
      cachedToken = data.data.access_token
      if (data.data.expiredAt) {
        tokenExpiration = new Date(data.data.expiredAt)
      }
      console.log("Google Token updated successfully.")
      return cachedToken
    } else {
      console.warn("Invalid token response format", data)
    }
  } catch (error) {
    console.error("Error initializing Google Token:", error)
  }
  return null
}

export async function getGoogleToken() {
  // If no token or token expired (simplified check), try to refresh
  const now = new Date()
  if (!cachedToken || (tokenExpiration && tokenExpiration < now)) {
    await initializeGoogleToken()
  }

  // Return cached token or fallback to environment/default
  return cachedToken
}

// Initial fetch attempt (fire and forget to start warming up)
// This runs when the module is imported
initializeGoogleToken()
  .then((token) => {
    console.log("Google Token initialized successfully.", token)
  })
  .catch((err) => console.error("Initial token fetch failed", err))
