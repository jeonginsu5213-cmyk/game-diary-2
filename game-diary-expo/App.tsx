import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import { BlurView } from 'expo-blur'
import MaskedView from '@react-native-masked-view/masked-view'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useFonts } from 'expo-font'
import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Keyboard,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import BackIcon from './assets/login/back.svg'
import DiscordIcon from './assets/login/discord.svg'
import PlogLogo from './assets/login/plog-logo.svg'
import DiaryBellIcon from './assets/diary/bell.svg'
import DiaryCalendarIcon from './assets/diary/calendar.svg'
import DiaryCaretDownIcon from './assets/diary/caret-down.svg'
import DiaryListIcon from './assets/diary/list.svg'
import DiarySearchIcon from './assets/diary/search.svg'
import DiaryServerIcon from './assets/diary/server.svg'
import DiaryTrashIcon from './assets/diary/trash.svg'
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

function formatShortDate(value: string) {
  const date = new Date(value)
  return `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

async function readError(response: Response) {
  const body = await response.json().catch(() => null)
  return typeof body?.error === 'string' ? body.error : '요청을 처리하지 못했습니다.'
}

function Avatar({ user, size = 44 }: { user?: User; size?: number }) {
  if (user?.avatar_url) return <Image source={{ uri: user.avatar_url }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  return <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}><Text style={styles.avatarLetter}>{(user?.display_name ?? '?').slice(0, 1)}</Text></View>
}

function GlassSurface({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.glassSurface, style]}>
      <View style={styles.glassSurfaceMask}>
        <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.glassSurfaceFill]} />
        <LinearGradient colors={['rgba(255, 255, 255, 0.72)', 'rgba(255, 255, 255, 0)']} end={{ x: 0, y: 1 }} pointerEvents="none" start={{ x: 0, y: 0 }} style={styles.glassInnerHighlight} />
        <LinearGradient colors={['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.08)']} end={{ x: 0, y: 1 }} pointerEvents="none" start={{ x: 0, y: 0 }} style={styles.glassInnerShade} />
        <View style={styles.glassSurfaceContent}>{children}</View>
      </View>
    </View>
  )
}

export default function App() {
  return <SafeAreaProvider style={styles.safeAreaProvider}><AppContent /></SafeAreaProvider>
}

function AppContent() {
  const [fontsLoaded] = useFonts({
    PretendardMedium: require('./assets/fonts/Pretendard-Medium.otf'),
    PretendardSemiBold: require('./assets/fonts/Pretendard-SemiBold.otf'),
    PretendardBold: require('./assets/fonts/Pretendard-Bold.otf'),
  })
  const [screen, setScreen] = useState<Screen>('checking')
  const [user, setUser] = useState<User | null>(null)
  const [items, setItems] = useState<DiaryItem[]>([])
  const [selected, setSelected] = useState<DiaryDetail | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const [diarySearchTerm, setDiarySearchTerm] = useState('')
  const [isLatestFirst, setIsLatestFirst] = useState(true)
  const exchangingRef = useRef(false)
  const keyboardOffset = useRef(new Animated.Value(0)).current
  const insets = useSafeAreaInsets()

  useEffect(() => {
    const animateSearchDock = (event: KeyboardEvent) => {
      const keyboardHeight = Math.max(0, Dimensions.get('window').height - event.endCoordinates.screenY)
      Animated.timing(keyboardOffset, {
        toValue: -keyboardHeight,
        duration: event.duration || 250,
        useNativeDriver: true,
      }).start()
    }
    const resetSearchDock = (event: KeyboardEvent) => {
      Animated.timing(keyboardOffset, {
        toValue: 0,
        duration: event.duration || 250,
        useNativeDriver: true,
      }).start()
    }

    if (Platform.OS === 'ios') {
      const changeFrame = Keyboard.addListener('keyboardWillChangeFrame', animateSearchDock)
      const hide = Keyboard.addListener('keyboardWillHide', resetSearchDock)
      return () => { changeFrame.remove(); hide.remove() }
    }

    const show = Keyboard.addListener('keyboardDidShow', animateSearchDock)
    const hide = Keyboard.addListener('keyboardDidHide', resetSearchDock)
    return () => { show.remove(); hide.remove() }
  }, [keyboardOffset])

  const visibleDiaryItems = useMemo(() => {
    const normalizedSearchTerm = diarySearchTerm.trim().toLocaleLowerCase('ko-KR')
    return items
      .filter((item) => {
        if (!normalizedSearchTerm) return true
        const searchText = [item.title, item.channelName, item.guildName, ...item.games.map((game) => game.title)]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase('ko-KR')
        return searchText.includes(normalizedSearchTerm)
      })
      .sort((left, right) => {
        const difference = new Date(right.startTime).getTime() - new Date(left.startTime).getTime()
        return isLatestFirst ? difference : -difference
      })
  }, [diarySearchTerm, isLatestFirst, items])

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
    setDiarySearchTerm('')
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
      void WebBrowser.dismissBrowser().catch(() => undefined)
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

  if (screen === 'checking' || !fontsLoaded) return <View style={styles.loadingPage}><StatusBar style="light" /><ActivityIndicator color="#e2bdff" /><Text style={styles.loadingText}>세션을 확인하는 중입니다…</Text></View>

  if (screen === 'sign-in') return (
    <SafeAreaView style={styles.authPage}>
      <StatusBar style="dark" />
      <View style={styles.authHeader}>
        <View style={styles.homeLink} accessibilityLabel="메인으로">
          <BackIcon width={22} height={22} />
          <Text allowFontScaling={false} style={styles.homeLinkText}>메인으로</Text>
        </View>
      </View>
      <View style={styles.authContent}>
        <View style={styles.serviceName}>
          <PlogLogo width={28} height={28} />
          <Text allowFontScaling={false} style={styles.serviceNameText}>PLOG</Text>
        </View>
        <View style={styles.authActions}>
          <Pressable accessibilityRole="button" style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, working && styles.disabled]} disabled={working} onPress={() => { void startSignIn() }}>
            <DiscordIcon width={24} height={18} />
            <Text allowFontScaling={false} style={styles.primaryButtonText}>{working ? '로그인 준비 중…' : '디스코드로 시작하기'}</Text>
          </Pressable>
          <Text allowFontScaling={false} style={styles.termsText}>로그인 시 <Text style={styles.termsLink}>이용 약관</Text> 및 <Text style={styles.termsLink}>개인정보 처리방침</Text>에 동의하게 됩니다.</Text>
          {message ? <Text style={styles.authErrorMessage}>{message}</Text> : null}
        </View>
      </View>
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
      <View style={styles.diaryPage}>
        <StatusBar style="dark" />
        <View style={[styles.diaryTabs, { paddingTop: insets.top + 16 }]}>
        <Pressable accessibilityRole="button" onPress={signOut} style={({ pressed }) => [styles.profileTab, pressed && styles.pressed]}>
          <Avatar size={44} user={user ?? undefined} />
        </Pressable>
        <GlassSurface style={styles.activeTab}>
          <View style={styles.activeTabContent}><View style={styles.listIconFrame}><DiaryListIcon width={14} height={10.002} /></View><Text allowFontScaling={false} style={styles.activeTabText}>목록</Text></View>
        </GlassSurface>
        <GlassSurface style={styles.iconTab}><View style={styles.iconGlyphFrame}><DiaryCalendarIcon width={14.833} height={16.5} /></View></GlassSurface>
        <GlassSurface style={styles.iconTab}><View style={styles.iconGlyphFrame}><DiaryTrashIcon width={14.833} height={16.5} /></View></GlassSurface>
        <GlassSurface style={styles.iconTab}><View style={styles.iconGlyphFrame}><DiaryBellIcon width={13.333} height={15} /></View></GlassSurface>
        </View>
        <View style={styles.diarySheet}>
        {message ? <Text style={styles.diaryMessage}>{message}</Text> : null}
        <FlatList
          data={visibleDiaryItems}
          keyExtractor={(item) => item.id}
          style={styles.diaryScroll}
          contentContainerStyle={visibleDiaryItems.length ? styles.diaryListContent : styles.diaryEmptyList}
          renderItem={({ item }) => <Pressable accessibilityRole="button" style={({ pressed }) => [styles.diaryListRow, pressed && styles.pressed]} onPress={() => { void openDiary(item.id) }} disabled={working}>
            <View style={styles.diaryListItem}>
              <View style={styles.diaryListLeading}><DiaryServerIcon width={28} height={28} /><Text allowFontScaling={false} numberOfLines={1} style={styles.diaryListTitle}>{item.title || item.channelName || '플레이 기록'}</Text></View>
              <Text allowFontScaling={false} style={styles.diaryListDate}>{formatShortDate(item.startTime)}</Text>
            </View>
          </Pressable>}
          ListEmptyComponent={<View style={styles.emptyState}><Text allowFontScaling={false} style={styles.emptyTitle}>{diarySearchTerm ? '검색 결과가 없어요.' : '아직 표시할 일기가 없어요.'}</Text><Text allowFontScaling={false} style={styles.emptyText}>{diarySearchTerm ? '다른 검색어를 입력해 보세요.' : '데스크톱 웹에서 게임 기록을 남기면 이곳에서 확인할 수 있습니다.'}</Text></View>}
        />
        <View pointerEvents="box-none" style={styles.sortOverlay}>
          <MaskedView
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
            maskElement={<LinearGradient colors={['#ffffff', 'rgba(255, 255, 255, 0)']} end={{ x: 0, y: 1 }} locations={[0, 1]} start={{ x: 0, y: 0 }} style={StyleSheet.absoluteFill} />}
          >
            <View style={StyleSheet.absoluteFill}>
              <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
              <View style={[StyleSheet.absoluteFill, styles.sortOverlayWhiteFill]} />
            </View>
          </MaskedView>
          <Pressable accessibilityRole="button" onPress={() => setIsLatestFirst((latestFirst) => !latestFirst)} style={({ pressed }) => [styles.sortButton, pressed && styles.pressed]}>
            <Text allowFontScaling={false} style={styles.sortText}>{isLatestFirst ? '최신순' : '오래된순'}</Text>
            <View style={styles.caretIconFrame}><DiaryCaretDownIcon width={7.867} height={4.533} /></View>
          </Pressable>
        </View>
        </View>
        <Animated.View style={[styles.searchDock, { transform: [{ translateY: keyboardOffset }] }]}>
          <GlassSurface style={styles.searchDockSurface}>
            <View style={styles.searchDockContent}>
              <View style={styles.searchIconFrame}><DiarySearchIcon width={16.5} height={16.5} /></View>
              <TextInput
                allowFontScaling={false}
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setDiarySearchTerm}
                placeholder="일기 제목 검색..."
                placeholderTextColor="#999999"
                returnKeyType="search"
                style={styles.diarySearchInput}
                value={diarySearchTerm}
              />
            </View>
          </GlassSurface>
        </Animated.View>
      </View>
  )
}

const styles = StyleSheet.create({
  safeAreaProvider: { flex: 1 },
  loadingPage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: '#17141f' },
  loadingText: { color: '#bcb1ca' },
  authPage: { flex: 1, backgroundColor: '#ffffff' },
  authHeader: { height: 60, justifyContent: 'center', paddingHorizontal: 20 },
  homeLink: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  homeLinkText: { color: '#111111', fontFamily: 'PretendardMedium', fontSize: 16, letterSpacing: -0.4, lineHeight: 22.4 },
  authContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28, paddingHorizontal: 32, paddingBottom: 95 },
  serviceName: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  serviceNameText: { color: '#111111', fontFamily: 'PretendardMedium', fontSize: 24, letterSpacing: -0.6, lineHeight: 33.6 },
  authActions: { width: '100%', alignItems: 'center', gap: 16 },
  eyebrow: { marginTop: 22, marginBottom: 8, color: '#c4a4e3', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  authTitle: { color: '#f5f0f9', fontSize: 37, fontWeight: '800', letterSpacing: -1.8, lineHeight: 43 },
  muted: { marginTop: 18, color: '#afa4ba', fontSize: 15, lineHeight: 24 },
  primaryButton: { width: '100%', minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 16, backgroundColor: '#ff383c' },
  primaryButtonText: { color: '#ffffff', fontFamily: 'PretendardSemiBold', fontSize: 16, letterSpacing: -0.4, lineHeight: 22.4 },
  termsText: { width: '100%', color: '#999999', fontFamily: 'PretendardMedium', fontSize: 12, letterSpacing: -0.3, lineHeight: 16.8, textAlign: 'center' },
  termsLink: { color: '#767676', fontFamily: 'PretendardSemiBold', textDecorationLine: 'underline' },
  authErrorMessage: { width: '100%', color: '#d92d32', fontSize: 12, lineHeight: 17, textAlign: 'center' },
  errorMessage: { marginTop: 14, color: '#ffb4b4', fontSize: 14, lineHeight: 20 },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.78 },
  page: { flex: 1, backgroundColor: '#17141f' },
  diaryPage: { flex: 1, backgroundColor: '#f5f5f5' },
  diaryTabs: { flexDirection: 'row', alignItems: 'center', gap: 7.5, paddingHorizontal: 16, paddingVertical: 16 },
  profileTab: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
  glassSurface: { position: 'relative', shadowColor: '#000000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 18, elevation: 5 },
  glassSurfaceMask: { flex: 1, minWidth: 0, overflow: 'hidden', borderRadius: 100, backgroundColor: 'rgba(249, 249, 249, 0.9)' },
  glassSurfaceFill: { backgroundColor: 'rgba(249, 249, 249, 0.9)' },
  glassInnerHighlight: { position: 'absolute', top: 0, right: 0, left: 0, height: 14 },
  glassInnerShade: { position: 'absolute', right: 0, bottom: 0, left: 0, height: 14 },
  glassSurfaceContent: { flex: 1, minWidth: 0 },
  activeTab: { height: 44, flex: 1, minWidth: 0 },
  activeTabContent: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  activeTabText: { color: '#111111', fontFamily: 'PretendardMedium', fontSize: 14, letterSpacing: -0.35, lineHeight: 19.6 },
  iconTab: { width: 60, height: 44, alignItems: 'center', justifyContent: 'center' },
  listIconFrame: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  iconGlyphFrame: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  caretIconFrame: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  diarySheet: { flex: 1, minHeight: 0, overflow: 'hidden', borderTopLeftRadius: 16, borderTopRightRadius: 16, backgroundColor: '#ffffff' },
  diaryMessage: { paddingHorizontal: 20, paddingTop: 12, color: '#d92d32', fontFamily: 'PretendardMedium', fontSize: 12, textAlign: 'center' },
  sortOverlay: { position: 'absolute', top: 0, right: 0, left: 0, zIndex: 2, height: 44, overflow: 'hidden', borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  sortOverlayWhiteFill: { backgroundColor: '#ffffff' },
  sortButton: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingTop: 8, paddingHorizontal: 16 },
  sortText: { color: '#767676', fontFamily: 'PretendardMedium', fontSize: 14, letterSpacing: -0.35, lineHeight: 19.6 },
  diaryScroll: { flex: 1, minHeight: 0 },
  diaryListContent: { paddingTop: 44, paddingBottom: 200 },
  diaryEmptyList: { flexGrow: 1, paddingTop: 44, paddingBottom: 200 },
  diaryListRow: { height: 44, paddingHorizontal: 20, paddingVertical: 8 },
  diaryListItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  diaryListLeading: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 12 },
  diaryListTitle: { flex: 1, minWidth: 0, color: '#767676', fontFamily: 'PretendardMedium', fontSize: 14, letterSpacing: -0.35, lineHeight: 19.6 },
  diaryListDate: { width: 40, color: '#999999', fontFamily: 'PretendardMedium', fontSize: 14, letterSpacing: -0.35, lineHeight: 19.6, textAlign: 'right' },
  searchDock: { position: 'absolute', right: '9.45%', bottom: 40, left: '9.45%', zIndex: 3, height: 48 },
  searchDockSurface: { flex: 1, minWidth: 0 },
  searchDockContent: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 20, paddingRight: 12 },
  searchIconFrame: { width: 15, height: 15, alignItems: 'center', justifyContent: 'center' },
  diarySearchInput: { flex: 1, height: '100%', minWidth: 0, padding: 0, color: '#111111', fontFamily: 'PretendardMedium', fontSize: 14, letterSpacing: -0.35, lineHeight: 19.6 },
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
