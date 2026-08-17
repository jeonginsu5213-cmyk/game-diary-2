import { useCallback, useEffect, useRef, useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { tokenStore, type MobileTokens } from './src/lib/token-store'

const apiBaseUrl = (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').replace(/\/$/, '')

type User = { id: string; display_name?: string | null; avatar_url?: string | null }
type DiaryItem = {
  id: string
  title: string | null
  startTime: string
  channelName: string | null
  guildName: string | null
  totalDurationMin: number | null
  games: Array<{ title: string; iconUrl: string | null }>
  participantCount: number
  coverImageUrl: string | null
  screenshotCount: number
}
type DiaryDetail = {
  session: {
    id: string
    title: string | null
    startTime: string
    channelName: string | null
    guildName: string | null
    totalDurationMin: number | null
    games: Array<{
      id: string
      title: string
      icon_url: string | null
      play_time_min: number | null
      comments: Array<{ id: string; content: string }>
    }>
    screenshots: Array<{ id: string; url: string; game_title: string | null; comment: string | null }>
    participants: Array<{ user_id: string; duration_min: number | null }>
  }
  profiles: User[]
}
type Screen = 'checking' | 'sign-in' | 'diary' | 'detail'

class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit',
  }).format(new Date(value))
}

function formatDuration(minutes: number | null) {
  if (!minutes || minutes < 1) return '기록 없음'
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (!hours) return `${rest}분`
  return rest ? `${hours}시간 ${rest}분` : `${hours}시간`
}

async function readError(response: Response) {
  const body = await response.json().catch(() => null)
  return typeof body?.error === 'string' ? body.error : '요청을 처리하지 못했습니다.'
}

function Avatar({ user, size = 44 }: { user?: User; size?: number }) {
  if (user?.avatar_url) return <Image source={{ uri: user.avatar_url }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  return <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}><Text style={styles.avatarLetter}>{(user?.display_name ?? '?').slice(0, 1)}</Text></View>
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('checking')
  const [user, setUser] = useState<User | null>(null)
  const [items, setItems] = useState<DiaryItem[]>([])
  const [selected, setSelected] = useState<DiaryDetail | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const exchangingRef = useRef(false)

  const refreshTokens = useCallback(async (): Promise<MobileTokens | null> => {
    const tokens = await tokenStore.getTokens()
    if (!tokens || !apiBaseUrl) return null
    const response = await fetch(`${apiBaseUrl}/api/mobile/auth/refresh`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    })
    if (!response.ok) return null
    const nextTokens = await response.json() as MobileTokens
    if (!nextTokens.accessToken || !nextTokens.refreshToken) return null
    await tokenStore.setTokens(nextTokens)
    return nextTokens
  }, [])

  const request = useCallback(async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
    const tokens = await tokenStore.getTokens()
    if (!tokens || !apiBaseUrl) throw new ApiError('로그인이 필요합니다.', 401)
    const send = (accessToken: string) => fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${accessToken}` },
    })
    let response = await send(tokens.accessToken)
    if (response.status === 401) {
      const renewed = await refreshTokens()
      if (renewed) response = await send(renewed.accessToken)
    }
    if (!response.ok) throw new ApiError(await readError(response), response.status)
    return response.json() as Promise<T>
  }, [refreshTokens])

  const loadDiary = useCallback(async () => {
    const result = await request<{ items: DiaryItem[] }>('/api/mobile/diary?limit=20')
    setItems(result.items)
  }, [request])

  const signOutLocally = useCallback(async () => {
    await Promise.all([tokenStore.clearTokens(), tokenStore.clearAuthState()])
    setUser(null)
    setItems([])
    setSelected(null)
    setScreen('sign-in')
  }, [])

  const restoreSession = useCallback(async () => {
    if (!apiBaseUrl) {
      setMessage('EXPO_PUBLIC_API_BASE_URL에 웹 서비스 주소를 설정해 주세요.')
      setScreen('sign-in')
      return
    }
    if (!(await tokenStore.getTokens())) {
      setScreen('sign-in')
      return
    }
    try {
      const session = await request<{ user: User }>('/api/mobile/session')
      setUser(session.user)
      await loadDiary()
      setScreen('diary')
    } catch {
      await signOutLocally()
    }
  }, [loadDiary, request, signOutLocally])

  const exchangeCode = useCallback(async (url: string) => {
    if (!url.includes('/mobile/auth/callback') || exchangingRef.current) return
    const parsed = Linking.parse(url)
    const code = typeof parsed.queryParams?.code === 'string' ? parsed.queryParams.code : null
    const state = typeof parsed.queryParams?.state === 'string' ? parsed.queryParams.state : null
    const expectedState = await tokenStore.getAuthState()
    if (!code || !state || state !== expectedState || !apiBaseUrl) {
      setMessage('로그인 응답을 확인하지 못했습니다. 다시 시도해 주세요.')
      return
    }

    exchangingRef.current = true
    setWorking(true)
    try {
      const response = await fetch(`${apiBaseUrl}/api/mobile/auth/exchange`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, state }),
      })
      if (!response.ok) throw new Error(await readError(response))
      const result = await response.json() as MobileTokens & { user: User }
      await tokenStore.setTokens(result)
      await tokenStore.clearAuthState()
      await WebBrowser.dismissBrowser()
      setUser(result.user)
      await loadDiary()
      setScreen('diary')
      setMessage(null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '로그인을 완료하지 못했습니다.')
    } finally {
      exchangingRef.current = false
      setWorking(false)
    }
  }, [loadDiary])

  useEffect(() => {
    void restoreSession()
    const subscription = Linking.addEventListener('url', ({ url }) => { void exchangeCode(url) })
    void Linking.getInitialURL().then((url) => { if (url) void exchangeCode(url) })
    return () => subscription.remove()
  }, [exchangeCode, restoreSession])

  const startSignIn = async () => {
    if (!apiBaseUrl) {
      setMessage('EXPO_PUBLIC_API_BASE_URL에 웹 서비스 주소를 설정해 주세요.')
      return
    }
    if (Platform.OS === 'web') {
      setMessage('로그인은 iOS 또는 Android 앱에서 확인해 주세요.')
      return
    }
    setWorking(true)
    setMessage(null)
    try {
      const response = await fetch(`${apiBaseUrl}/api/mobile/auth/request`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform: Platform.OS === 'ios' ? 'ios' : 'android' }),
      })
      if (!response.ok) throw new Error(await readError(response))
      const result = await response.json() as { authorizationUrl: string; state: string }
      if (!result.authorizationUrl || !result.state) throw new Error('로그인 요청 응답이 올바르지 않습니다.')
      await tokenStore.setAuthState(result.state)
      await WebBrowser.openBrowserAsync(result.authorizationUrl)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '로그인을 시작하지 못했습니다.')
    } finally {
      setWorking(false)
    }
  }

  const openDiary = async (id: string) => {
    setWorking(true)
    setMessage(null)
    try {
      const detail = await request<DiaryDetail>(`/api/mobile/diary/${encodeURIComponent(id)}`)
      setSelected(detail)
      setScreen('detail')
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) await signOutLocally()
      setMessage(error instanceof Error ? error.message : '일기를 불러오지 못했습니다.')
    } finally {
      setWorking(false)
    }
  }

  const signOut = () => Alert.alert('로그아웃', '이 기기에서 로그아웃할까요?', [
    { text: '취소', style: 'cancel' },
    { text: '로그아웃', style: 'destructive', onPress: () => { void request('/api/mobile/session', { method: 'DELETE' }).catch(() => undefined).finally(() => signOutLocally()) } },
  ])

  if (screen === 'checking') return <View style={styles.loadingPage}><StatusBar style="light" /><ActivityIndicator color="#e2bdff" /><Text style={styles.loadingText}>세션을 확인하는 중입니다…</Text></View>

  if (screen === 'sign-in') return (
    <SafeAreaView style={styles.authPage}>
      <StatusBar style="light" />
      <View style={styles.brandMark}><Text style={styles.brandLetter}>P</Text></View>
      <Text style={styles.eyebrow}>GAME DIARY</Text>
      <Text style={styles.authTitle}>게임하던 순간을{`\n`}다시 꺼내 보세요.</Text>
      <Text style={styles.muted}>Discord로 로그인하면 나의 플레이 일기를 안전하게 확인할 수 있습니다.</Text>
      {message ? <Text style={styles.errorMessage}>{message}</Text> : null}
      <Pressable accessibilityRole="button" style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, working && styles.disabled]} disabled={working} onPress={() => { void startSignIn() }}>
        <Text style={styles.primaryButtonText}>{working ? '로그인 준비 중…' : 'Discord로 로그인'}</Text>
      </Pressable>
    </SafeAreaView>
  )

  if (screen === 'detail' && selected) {
    const profiles = new Map(selected.profiles.map((profile) => [profile.id, profile]))
    return (
      <SafeAreaView style={styles.page}>
        <StatusBar style="light" />
        <View style={styles.topbar}><Pressable onPress={() => setScreen('diary')}><Text style={styles.backButton}>‹ 목록</Text></Pressable><Text style={styles.topbarLabel}>플레이 일기</Text><View style={styles.topbarSpacer} /></View>
        <ScrollView contentContainerStyle={styles.detailContent}>
          <Text style={styles.eyebrow}>{formatDate(selected.session.startTime)}</Text>
          <Text style={styles.detailTitle}>{selected.session.title || selected.session.channelName || '플레이 기록'}</Text>
          <Text style={styles.muted}>{selected.session.guildName || 'Discord'} · {formatDuration(selected.session.totalDurationMin)}</Text>
          <View style={styles.section}><Text style={styles.sectionTitle}>함께한 사람</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.avatarRow}>{selected.session.participants.map((participant) => <View style={styles.person} key={participant.user_id}><Avatar user={profiles.get(participant.user_id)} /><Text style={styles.personName} numberOfLines={1}>{profiles.get(participant.user_id)?.display_name || '알 수 없음'}</Text></View>)}</ScrollView></View>
          <View style={styles.section}><Text style={styles.sectionTitle}>플레이한 게임</Text>{selected.session.games.map((game) => <View style={styles.gameRow} key={game.id}>{game.icon_url ? <Image source={{ uri: game.icon_url }} style={styles.gameIcon} /> : <View style={styles.gameFallback}><Text>🎮</Text></View>}<View style={styles.gameInfo}><Text style={styles.gameTitle}>{game.title}</Text><Text style={styles.gameMeta}>{formatDuration(game.play_time_min)}</Text>{game.comments.map((comment) => <Text style={styles.comment} key={comment.id}>{comment.content}</Text>)}</View></View>)}</View>
          {selected.session.screenshots.length ? <View style={styles.section}><Text style={styles.sectionTitle}>스크린샷</Text><View style={styles.screenshotGrid}>{selected.session.screenshots.map((screenshot) => <Image source={{ uri: screenshot.url }} style={styles.screenshot} key={screenshot.id} accessibilityLabel={screenshot.comment || screenshot.game_title || '게임 스크린샷'} />)}</View></View> : null}
        </ScrollView>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.page}>
      <StatusBar style="light" />
      <View style={styles.diaryHeader}><View><Text style={styles.eyebrow}>PLOG</Text><Text style={styles.pageTitle}>{user?.display_name || '나'}의 일기</Text></View><Pressable onPress={signOut} accessibilityRole="button"><Avatar user={user ?? undefined} /></Pressable></View>
      {message ? <Text style={[styles.errorMessage, styles.pageMessage]}>{message}</Text> : null}
      <FlatList data={items} keyExtractor={(item) => item.id} contentContainerStyle={items.length ? styles.listContent : styles.emptyList} renderItem={({ item }) => <Pressable accessibilityRole="button" style={({ pressed }) => [styles.diaryCard, pressed && styles.pressed]} onPress={() => { void openDiary(item.id) }} disabled={working}>{item.coverImageUrl ? <Image source={{ uri: item.coverImageUrl }} style={styles.coverImage} /> : <View style={styles.coverFallback}><Text style={styles.coverEmoji}>🎮</Text></View>}<View style={styles.cardBody}><Text style={styles.cardDate}>{formatDate(item.startTime)}</Text><Text style={styles.cardTitle} numberOfLines={1}>{item.title || item.channelName || '플레이 기록'}</Text><Text style={styles.cardMeta} numberOfLines={1}>{item.games.map((game) => game.title).join(', ') || '게임 기록'} · {formatDuration(item.totalDurationMin)}</Text><Text style={styles.cardMeta}>{item.participantCount}명 · 사진 {item.screenshotCount}장</Text></View></Pressable>} ListEmptyComponent={<View style={styles.emptyState}><Text style={styles.emptyMark}>✦</Text><Text style={styles.emptyTitle}>아직 표시할 일기가 없어요.</Text><Text style={styles.emptyText}>데스크톱 웹에서 게임 기록을 남기면 이곳에서 확인할 수 있습니다.</Text></View>} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  loadingPage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: '#17141f' },
  loadingText: { color: '#bcb1ca' },
  authPage: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, backgroundColor: '#17141f' },
  brandMark: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#d8a6ff' },
  brandLetter: { color: '#241d2e', fontSize: 29, fontWeight: '900' },
  eyebrow: { marginTop: 22, marginBottom: 8, color: '#c4a4e3', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  authTitle: { color: '#f5f0f9', fontSize: 37, fontWeight: '800', letterSpacing: -1.8, lineHeight: 43 },
  muted: { marginTop: 18, color: '#afa4ba', fontSize: 15, lineHeight: 24 },
  primaryButton: { minHeight: 54, alignItems: 'center', justifyContent: 'center', marginTop: 30, borderRadius: 16, backgroundColor: '#e2bdff' },
  primaryButtonText: { color: '#241d2e', fontSize: 16, fontWeight: '800' },
  errorMessage: { marginTop: 14, color: '#ffb4b4', fontSize: 14, lineHeight: 20 },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.78 },
  page: { flex: 1, backgroundColor: '#17141f' },
  diaryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 18 },
  pageTitle: { color: '#f5f0f9', fontSize: 28, fontWeight: '800', letterSpacing: -1.2 },
  pageMessage: { marginHorizontal: 20 },
  listContent: { paddingHorizontal: 20, paddingBottom: 24, gap: 14 },
  emptyList: { flexGrow: 1, paddingHorizontal: 20 },
  diaryCard: { minHeight: 118, flexDirection: 'row', overflow: 'hidden', borderWidth: 1, borderColor: '#3b3048', borderRadius: 18, backgroundColor: '#211b2b' },
  coverImage: { width: 112, height: 118 },
  coverFallback: { width: 112, alignItems: 'center', justifyContent: 'center', backgroundColor: '#4c345b' },
  coverEmoji: { fontSize: 28 },
  cardBody: { flex: 1, justifyContent: 'center', gap: 5, padding: 15 },
  cardDate: { color: '#c7a8e4', fontSize: 12 },
  cardTitle: { color: '#f5f0f9', fontSize: 16, fontWeight: '700' },
  cardMeta: { color: '#aaa0b5', fontSize: 12, lineHeight: 17 },
  emptyState: { alignItems: 'center', marginTop: 150 },
  emptyMark: { marginBottom: 12, color: '#e2bdff', fontSize: 30 },
  emptyTitle: { color: '#eee7f5', fontSize: 17, fontWeight: '700' },
  emptyText: { maxWidth: 280, marginTop: 10, color: '#aba1b5', fontSize: 14, lineHeight: 22, textAlign: 'center' },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 56, paddingHorizontal: 20 },
  topbarLabel: { color: '#f5f0f9', fontSize: 15, fontWeight: '700' },
  topbarSpacer: { width: 42 },
  backButton: { color: '#e2bdff', fontSize: 15, fontWeight: '700' },
  detailContent: { paddingBottom: 32 },
  detailTitle: { paddingHorizontal: 20, color: '#f5f0f9', fontSize: 31, fontWeight: '800', letterSpacing: -1.4 },
  section: { marginTop: 28, paddingHorizontal: 20, paddingTop: 23, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#332941' },
  sectionTitle: { marginBottom: 14, color: '#f5f0f9', fontSize: 17, fontWeight: '700' },
  avatarRow: { gap: 14 },
  person: { width: 54, alignItems: 'center', gap: 6 },
  personName: { width: 54, color: '#c4b8cf', fontSize: 10, textAlign: 'center' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#4a3c5a' },
  avatarLetter: { color: '#f5f0f9', fontWeight: '700' },
  gameRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  gameIcon: { width: 46, height: 46, borderRadius: 12 },
  gameFallback: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#41324e' },
  gameInfo: { flex: 1 },
  gameTitle: { color: '#f5f0f9', fontSize: 15, fontWeight: '700' },
  gameMeta: { marginTop: 4, color: '#aaa0b5', fontSize: 13 },
  comment: { marginTop: 4, color: '#ddd3e7', fontSize: 13, lineHeight: 19 },
  screenshotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  screenshot: { width: '48.5%', aspectRatio: 1, borderRadius: 10 },
})
