import * as SecureStore from 'expo-secure-store'

const accessTokenKey = 'plog.mobile.access-token'
const refreshTokenKey = 'plog.mobile.refresh-token'
const authStateKey = 'plog.mobile.auth-state'

export type MobileTokens = {
  accessToken: string
  refreshToken: string
}

export const tokenStore = {
  async getTokens(): Promise<MobileTokens | null> {
    const [accessToken, refreshToken] = await Promise.all([
      SecureStore.getItemAsync(accessTokenKey),
      SecureStore.getItemAsync(refreshTokenKey),
    ])

    return accessToken && refreshToken ? { accessToken, refreshToken } : null
  },

  setTokens: (tokens: MobileTokens) =>
    Promise.all([
      SecureStore.setItemAsync(accessTokenKey, tokens.accessToken),
      SecureStore.setItemAsync(refreshTokenKey, tokens.refreshToken),
    ]).then(() => undefined),

  clearTokens: () =>
    Promise.all([
      SecureStore.deleteItemAsync(accessTokenKey),
      SecureStore.deleteItemAsync(refreshTokenKey),
    ]).then(() => undefined),

  getAuthState: () => SecureStore.getItemAsync(authStateKey),
  setAuthState: (state: string) => SecureStore.setItemAsync(authStateKey, state),
  clearAuthState: () => SecureStore.deleteItemAsync(authStateKey),
}
