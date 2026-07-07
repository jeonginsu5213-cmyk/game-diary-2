require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ComponentType,
    EmbedBuilder,
    MessageFlags,
    Partials,
    ChannelType
} = require('discord.js');
const { 
    joinVoiceChannel, 
    createAudioPlayer, 
    createAudioResource, 
    AudioPlayerStatus, 
    VoiceConnectionStatus,
    entersState,
    StreamType
} = require('@discordjs/voice');

const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

// Supabase 초기화
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 🔒 Guild ID 은닉을 위한 헬퍼 함수 (서버 이름이 동일한 경우 섞임 방지)
function encodeGuildId(guildName, guildId) {
    if (!guildId || guildId === 'personal') return guildName;
    try {
        const binStr = BigInt(guildId).toString(2);
        const encoded = binStr.split('').map(bit => bit === '0' ? '\u200B' : '\u200C').join('');
        return guildName + '\u200D' + encoded;
    } catch (e) {
        return guildName;
    }
}

// FFMPEG 경로 설정 (ffmpeg-static 활용)
try {
    const ffmpegPath = require('ffmpeg-static');
    if (ffmpegPath) {
        process.env.FFMPEG_PATH = ffmpegPath;
        console.log(`[System] FFMPEG 경로 설정됨: ${ffmpegPath}`);
    }
} catch (e) {
    console.error("[System] ffmpeg-static 로드 실패:", e.message);
}

// ☁️ 클라우드 배포 대응: 환경 변수에서 서비스 계정 키를 읽거나 로컬 파일을 읽음
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (err) {
        console.error("FIREBASE_SERVICE_ACCOUNT 환경 변수 파싱 실패:", err);
        process.exit(1);
    }
} else {
    try {
        serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));
    } catch (err) {
        console.error("serviceAccountKey.json 파일을 찾을 수 없습니다. 환경 변수를 확인하세요.");
        process.exit(1);
    }
}

if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'gamediary-a7692.firebasestorage.app' 
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences, 
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ],
    partials: [
        Partials.Channel,
        Partials.Message
    ]
});

client.on('error', error => {
    console.error('[Discord Client Error]', error);
});

client.on('guildCreate', async (guild) => {
    console.log(`[Discord] Joined new guild: ${guild.name} (${guild.id})`);
    try {
        const existingChannel = guild.channels.cache.find(
            ch => ch.type === ChannelType.GuildText && ch.name === '일기장'
        );
        if (existingChannel) {
            console.log(`[Discord] '일기장' channel already exists in ${guild.name}`);
            return;
        }

        const newChannel = await guild.channels.create({
            name: '일기장',
            type: ChannelType.GuildText,
            topic: '게임 다이어리 봇이 작성하는 일기장 채널입니다.'
        });
        console.log(`[Discord] Created '일기장' channel in ${guild.name}: ${newChannel.id}`);
    } catch (e) {
        console.error(`[Discord] Failed to create '일기장' channel in ${guild.name}:`, e);
    }
});

const activeSessions = new Map();
const activeSoloSessions = new Map();

async function findMemberInMutualGuilds(userId) {
    // 1. 캐시에서 우선 조회 (지연 없음) 및 presence 정보가 존재하면 즉시 반환
    for (const guild of client.guilds.cache.values()) {
        const member = guild.members.cache.get(userId);
        if (member && member.presence) return member;
    }
    
    // 2. 캐시에 없거나 presence 정보가 없는 경우 모든 길드에 대해 병렬 fetch 시도 (withPresences: true 강제)
    const fetchPromises = Array.from(client.guilds.cache.values()).map(async (guild) => {
        try {
            return await guild.members.fetch({ user: userId, withPresences: true, force: true });
        } catch (e) {
            return null;
        }
    });
    
    // 1.5초 타임아웃 설정
    const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 1500));
    
    try {
        const results = await Promise.race([
            Promise.all(fetchPromises),
            timeoutPromise
        ]);
        
        if (results && Array.isArray(results)) {
            const found = results.find(m => m !== null);
            if (found) return found;
        }
    } catch (e) {
        console.error("[findMemberInMutualGuilds] 병렬 fetch 중 오류:", e);
    }
    
    // 만약 fetch가 실패하거나 타임아웃되었을 경우 캐시된 멤버 정보라도 최종 반환
    for (const guild of client.guilds.cache.values()) {
        const member = guild.members.cache.get(userId);
        if (member) return member;
    }
    
    return null;
}

function formatStatus(status) {
    switch (status) {
        case 'idle': return '자리 비움';
        case 'dnd': return '방해 금지';
        case 'offline': return '오프라인 (보이지 않음)';
        default: return '알 수 없음';
    }
}

async function startSoloSession(interaction, userId, gameName, sessionTitle, activity) {
    const user = interaction.user;
    const sessionId = crypto.randomUUID?.() || crypto.randomBytes(16).toString('hex');
    const displayTitle = sessionTitle || "오늘의 게임일기";
    
    const newSession = {
        id: sessionId,
        guildId: 'personal',
        guildName: '개인 플레이',
        guildIcon: null,
        channelName: '1:1 DM',
        sessionTitle: displayTitle,
        startTime: Date.now(),
        participants: new Set([userId]),
        displayNames: new Map([[userId, user.displayName]]),
        profileImages: new Map([[userId, user.displayAvatarURL({ format: 'png', size: 256 })]]),
        gameLogs: {},
        participantLogs: {},
        pendingScreenshots: [],
        controlMessage: null
    };
    newSession.participantLogs[userId] = [{ joinTime: admin.firestore.Timestamp.now(), leaveTime: null }];
    
    activeSoloSessions.set(userId, newSession);
    
    // 게임 로그 초기화 (게임이 감지되었을 경우에만)
    if (gameName && gameName !== '미지정') {
        newSession.gameLogs[gameName] = { 
            totalPlayTime: 0,
            playerPlayTimes: {},
            players: new Set([userId]),
            activeStartTime: {},
            iconURL: null,
            comments: [],
            startTime: Date.now(),
            endTime: null,
            lastActiveUpdateTime: Date.now()
        };
        newSession.gameLogs[gameName].activeStartTime[userId] = Date.now();
        
        // 아이콘 조회 및 추가
        if (activity) {
            let iconURL = null;
            const gameNameKey = gameName.trim().toLowerCase();
            if (MANUAL_GAME_MAP[gameNameKey]) {
                iconURL = MANUAL_GAME_MAP[gameNameKey];
            } else if (activity.assets) {
                iconURL = activity.assets.largeImageURL({ format: 'png', size: 512 });
            } else if (activity.applicationId) {
                try {
                    const app = await client.rest.get(`/applications/${activity.applicationId}`);
                    if (app && app.icon) {
                        iconURL = `https://cdn.discordapp.com/app-icons/${activity.applicationId}/${app.icon}.png?size=512`;
                    }
                } catch (e) {}
            }
            newSession.gameLogs[gameName].iconURL = iconURL;
        }
    }

    // 제어 패널 메시지 업데이트 (서버와 동일한 양식의 content + 안내 embed + 2개 버튼 구성)
    const isGameActive = gameName && gameName !== '미지정';
    const panelTitle = isGameActive ? `🎮 [${gameName}] 기록 중...` : `🎮 [대기 중] 게임 감지 대기 중...`;
    
    const embed = new EmbedBuilder()
        .setColor(0xE05D38)
        .setTitle(panelTitle)
        .setDescription("플레이 도중 하실 말씀(텍스트)이나 스냅샷(이미지)을 이 DM 창에 자유롭게 보내주세요.\n기록이 끝나면 아래 **기록 종료** 버튼을 눌러주세요.");
        
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('btn_edit_title_solo')
            .setLabel('일기 제목 수정')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('✏️'),
        new ButtonBuilder()
            .setCustomId('btn_solo_end')
            .setLabel('기록 종료')
            .setStyle(ButtonStyle.Danger)
    );
    
    const payload = {
        content: `🎮 **오늘의 게임일기 작성을 시작합니다!**\n현재 제목: **${displayTitle}**`,
        embeds: [embed],
        components: [row]
    };
    
    if (interaction.isButton()) {
        const msg = await interaction.update({ ...payload, fetchReply: true });
        newSession.controlMessage = msg;
    } else if (interaction.isModalSubmit()) {
        const msg = await interaction.update({ ...payload, fetchReply: true });
        newSession.controlMessage = msg;
    }
}

// 📢 게임 상태 알림 함수
async function sendNotification(session, userId, messageText, iconURL) {
    try {
        const payload = {
            content: messageText,
            flags: [MessageFlags.SuppressNotifications]
        };
        
        if (iconURL && (iconURL.startsWith('http://') || iconURL.startsWith('https://'))) {
            const embed = new EmbedBuilder()
                .setColor(0xE05D38)
                .setThumbnail(iconURL);
            payload.embeds = [embed];
        }
        
        if (session.guildName === '개인 플레이') {
            const user = await client.users.fetch(userId);
            if (user) await user.send(payload);
        } else {
            const guild = client.guilds.cache.find(g => g.name === session.guildName) || Array.from(client.guilds.cache.values())[0];
            const logChannel = guild?.channels.cache.find(c => c.name === '일기장');
            if (logChannel) {
                await logChannel.send(payload);
            }
        }
    } catch (e) {
        console.error("[Notification] 알림 전송 실패:", e);
    }
}



// 🌟 [최종 확인된 수동 매칭 리스트]
const MANUAL_GAME_MAP = {
    "valheim": "https://cdn.discordapp.com/app-icons/1124358970618953818/93ac3b8489a031b721995a99102c73f1.png",
    "slay the spire ii": "https://cdn.discordapp.com/app-icons/1479192099734945802/b24d4f6cfaa6b29fc8b54fa78702e51c.png",
    "slay the spire 2": "https://cdn.discordapp.com/app-icons/1479192099734945802/b24d4f6cfaa6b29fc8b54fa78702e51c.png",
    "league of legends": "https://cdn.discordapp.com/app-icons/101538960410427392/9525c52c0f2095c55a5078563c6d7a54.png",
    "overwatch 2": "https://cdn.discordapp.com/app-icons/356860322762162176/67406a6c253457a3e7e8b6f3796f7c81.png"
};

function findSessionByUserId(userId) {
    for (const session of activeSessions.values()) {
        if (session.participants.has(userId)) return session;
    }
    return null;
}

// ⏱️ 게임 플레이 시간 누적 계산 (중복 합산 방지: 실제 흘러간 시간 기준)
function accumulateGamePlayTime(gameLog) {
    const now = Date.now();
    const activePlayers = Object.values(gameLog.activeStartTime || {}).filter(t => t !== null).length;
    if (activePlayers > 0 && gameLog.lastActiveUpdateTime) {
        gameLog.totalPlayTime += (now - gameLog.lastActiveUpdateTime);
    }
    gameLog.lastActiveUpdateTime = now;
}

async function updateGameLog(session, userId, activity) {
    if (!activity || activity.type !== 0) return;

    const originalName = activity.name;
    const gameNameKey = originalName.trim().toLowerCase();
    let iconURL = null;

    console.log(`\n--- 🔍 [아이콘 매칭] "${originalName}" 처리 중 ---`);

    if (MANUAL_GAME_MAP[gameNameKey]) {
        iconURL = MANUAL_GAME_MAP[gameNameKey];
        console.log(`✨ [성공] 수동 리스트 매칭 완료`);
    }

    if (!iconURL && activity.assets) {
        iconURL = activity.assets.largeImageURL({ format: 'png', size: 512 });
        if (iconURL) console.log(`✨ [성공] 리치 프레젠스 에셋 획득`);
    }

    if (!iconURL && activity.applicationId) {
        try {
            const app = await client.rest.get(`/applications/${activity.applicationId}`);
            if (app && app.icon) {
                iconURL = `https://cdn.discordapp.com/app-icons/${activity.applicationId}/${app.icon}.png?size=512`;
                console.log(`✨ [성공] API 조회 성공`);
            }
        } catch (e) {}
    }

    if (!session.gameLogs[originalName]) {
        session.gameLogs[originalName] = { 
            totalPlayTime: 0, playerPlayTimes: {}, players: new Set(), activeStartTime: {}, iconURL: iconURL, comments: [],
            startTime: Date.now(), endTime: Date.now(),
            lastActiveUpdateTime: Date.now()
        };

        if (!session.announcedChecklists?.has(originalName)) {
            if (!session.announcedChecklists) session.announcedChecklists = new Set();
            session.announcedChecklists.add(originalName);
            
            (async () => {
                try {
                    const targetGuildName = encodeGuildId(session.guildName, session.guildId);
                    console.log(`[Checklist] "${originalName}"에 대한 리마인드 검사 시작 (서버: ${targetGuildName})`);
                    
                    // 1. 해당 서버(guildName)의 과거 체크리스트 중 가장 최신의 것 1개 조회
                    const { data: latestChecklists, error: fetchError } = await supabase
                        .from('comments')
                        .select(`
                            id,
                            content,
                            user_id,
                            created_at,
                            session_games!inner(
                                id,
                                title,
                                session_id,
                                sessions!inner(
                                    id,
                                    guild_name,
                                    start_time
                                )
                            )
                        `)
                        .eq('is_checklist', true)
                        .eq('session_games.sessions.guild_name', targetGuildName)
                        .lt('session_games.sessions.start_time', new Date(session.startTime).toISOString())
                        .order('created_at', { ascending: false })
                        .limit(1);

                    if (fetchError) throw fetchError;

                    if (!latestChecklists || latestChecklists.length === 0) {
                        console.log(`[Checklist] 해당 서버의 과거 체크리스트가 존재하지 않습니다.`);
                        return;
                    }

                    const latestChecklist = latestChecklists[0];
                    const gameTitle = latestChecklist.session_games.title;
                    const originSessionId = latestChecklist.session_games.session_id;
                    const originStartTime = latestChecklist.session_games.sessions.start_time;

                    // 조건 2: 가장 최신 체크리스트의 게임과 현재 감지된 게임이 일치하는지 검사
                    if (gameTitle !== originalName) {
                        console.log(`[Checklist] 최신 체크리스트 게임(${gameTitle})이 현재 감지된 게임(${originalName})과 일치하지 않아 리마인드를 대기합니다.`);
                        return;
                    }

                    // 조건 4: 해당 일기장(세션)이 휴지통에 있거나 삭제되었는지 검사 (작성자 기준 is_deleted 여부)
                    const { data: participantData, error: participantError } = await supabase
                        .from('session_participants')
                        .select('is_deleted')
                        .eq('session_id', originSessionId)
                        .eq('user_id', latestChecklist.user_id)
                        .maybeSingle();

                    if (participantError) throw participantError;

                    if (participantData && participantData.is_deleted) {
                        console.log(`[Checklist] 체크리스트가 작성된 세션이 삭제 또는 휴지통 상태이므로 리마인드하지 않습니다.`);
                        return;
                    }

                    // 조건 6: 과거 세션과 현재 세션 사이에 다른 세션이 있었는지 검사 (중간 세션 존재 시 재리마인드 차단)
                    const { count, error: countError } = await supabase
                        .from('sessions')
                        .select('*', { count: 'exact', head: true })
                        .eq('guild_name', targetGuildName)
                        .gt('start_time', originStartTime)
                        .lt('start_time', new Date(session.startTime).toISOString());

                    if (countError) throw countError;

                    if (count > 0) {
                        console.log(`[Checklist] 과거 세션(${originSessionId})과 현재 세션 사이에 다른 세션이 ${count}개 존재하므로 리마인드하지 않습니다.`);
                        return;
                    }

                    // 모든 조건 충족 -> 동일한 게임(여기서는 originalName)에 묶여 작성된 최신 세션의 체크리스트들 일괄 노출
                    const { data: checklistsInGame, error: checklistError } = await supabase
                        .from('comments')
                        .select('content, user_id')
                        .eq('game_id', latestChecklist.session_games.id)
                        .eq('is_checklist', true);

                    if (checklistError) throw checklistError;

                    if (checklistsInGame && checklistsInGame.length > 0) {
                        const { data: profiles } = await supabase.from('profiles').select('id, display_name');
                        const profileMap = Object.fromEntries(profiles.map(p => [p.id, p.display_name]));
                        
                        if (session.guildName === '개인 플레이') {
                            const user = await client.users.fetch(userId);
                            if (user) {
                                const checklistText = checklistsInGame.map(c => `📌 **${profileMap[c.user_id] || c.user_id}**: ${c.content}`).join('\n');
                                await user.send({
                                    content: `💡 **${originalName}**을(를) 다시 시작하셨네요! 과거의 내가 남겨둔 메모가 있어요.\n\n${checklistText}`
                                });
                            }
                        } else {
                            const guild = client.guilds.cache.find(g => g.name === session.guildName) || Array.from(client.guilds.cache.values())[0];
                            const logChannel = guild?.channels.cache.find(c => c.name === '일기장');
                            if (logChannel) {
                                const checklistText = checklistsInGame.map(c => `💬 **${profileMap[c.user_id] || c.user_id}** : ${c.content}`).join('\n');
                                await logChannel.send({ 
                                    content: `💡 **${originalName}**을(를) 다시 시작하셨네요! 과거의 내가 남겨둔 메모가 있어요.\n\n${checklistText}`
                                });
                            }
                        }
                        console.log(`✨ [Checklist] "${originalName}" 체크리스트 리마인드 완료!`);
                    }
                } catch (e) { 
                    console.error("[Checklist] 체크리스트 조회 및 리마인드 처리 실패:", e); 
                }
            })();
        }
    } else if (iconURL && !session.gameLogs[originalName].iconURL) {
        session.gameLogs[originalName].iconURL = iconURL;
    }

    if (!session.gameLogs[originalName].activeStartTime[userId]) {
        accumulateGamePlayTime(session.gameLogs[originalName]);
        session.gameLogs[originalName].activeStartTime[userId] = Date.now();
        session.gameLogs[originalName].players.add(userId);
        session.gameLogs[originalName].endTime = Date.now();
        console.log(`✅ [기록 시작] ${originalName}`);

        // 게임 시작 알림 전송
        (async () => {
            try {
                const gameLog = session.gameLogs[originalName];
                const finalIconURL = gameLog ? gameLog.iconURL : null;
                await sendNotification(session, userId, `${originalName} 기록을 시작합니다.`, finalIconURL);
            } catch (e) {
                console.error("[updateGameLog] 게임 시작 알림 전송 실패:", e);
            }
        })();

        // 솔로 세션 제어 패널 실시간 갱신 (게임 시작 감지 시)
        if (session.guildName === '개인 플레이' && session.controlMessage) {
            try {
                const embed = new EmbedBuilder()
                    .setColor(0xE05D38)
                    .setTitle(`🎮 [${originalName}] 기록 중...`)
                    .setDescription("플레이 도중 하실 말씀(텍스트)이나 스냅샷(이미지)을 이 DM 창에 자유롭게 보내주세요.\n기록이 끝나면 아래 **기록 종료** 버튼을 눌러주세요.");
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('btn_edit_title_solo')
                        .setLabel('일기 제목 수정')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('✏️'),
                    new ButtonBuilder()
                        .setCustomId('btn_solo_end')
                        .setLabel('기록 종료')
                        .setStyle(ButtonStyle.Danger)
                );
                await session.controlMessage.edit({ embeds: [embed], components: [row] });
            } catch (e) {
                console.error("솔로 세션 제어 패널 업데이트 실패:", e);
            }
        }
    }
}

/**
 * Supabase에 세션 정보를 정규화하여 저장
 */
async function saveSessionToSupabase(session, endTime) {
    const sessionId = crypto.randomUUID?.() || crypto.randomBytes(16).toString('hex');
    const baseGuildName = session.guildName || 'Unknown Server';
    const guildName = encodeGuildId(baseGuildName, session.guildId);
    
    console.log(`[Supabase] 세션 저장 시작: ${sessionId}`);

    try {
        // 1. 프로필 및 서버 프로필 업데이트
        for (const [uid, name] of session.displayNames) {
            await supabase.from('profiles').upsert({
                id: uid,
                display_name: name,
                avatar_url: session.profileImages.get(uid) || null,
                updated_at: new Date().toISOString()
            });
            await supabase.from('server_profiles').upsert({
                user_id: uid,
                guild_name: guildName,
                nickname: name,
                avatar_url: session.profileImages.get(uid) || null
            });
        }

        // 2. 세션 삽입
        const { error: sessionError } = await supabase.from('sessions').insert({
            id: sessionId,
            start_time: new Date(session.startTime).toISOString(),
            end_time: new Date(endTime).toISOString(),
            channel_name: session.channelName,
            title: session.sessionTitle,
            guild_name: guildName,
            guild_icon: session.guildIcon,
            total_duration_min: Math.floor((endTime - session.startTime) / 1000 / 60)
        });
        if (sessionError) throw sessionError;

        // 3. 참여자 정보 삽입
        for (const [uid, logs] of Object.entries(session.participantLogs)) {
            let totalMs = 0;
            logs.forEach(log => {
                const start = log.joinTime.toMillis ? log.joinTime.toMillis() : new Date(log.joinTime).getTime();
                const end = log.leaveTime?.toMillis ? log.leaveTime.toMillis() : (log.leaveTime ? new Date(log.leaveTime).getTime() : endTime);
                totalMs += (end - start);
            });
            await supabase.from('session_participants').insert({
                session_id: sessionId,
                user_id: uid,
                duration_min: Math.max(1, Math.round(totalMs / 60000))
            });
        }

        // 4. 게임, 플레이어, 댓글 삽입
        for (const [name, data] of Object.entries(session.gameLogs)) {
            const { data: insertedGame, error: gameError } = await supabase.from('session_games').insert({
                session_id: sessionId,
                title: name,
                icon_url: data.iconURL,
                play_time_min: Math.floor(data.totalPlayTime / 1000 / 60),
                start_time: new Date(data.startTime).toISOString(),
                end_time: new Date(data.endTime || endTime).toISOString()
            }).select().single();

            if (gameError) {
                console.error(`[Supabase] 게임 저장 실패 (${name}):`, gameError);
                continue;
            }

            // 플레이어별 시간
            for (const [uid, ms] of Object.entries(data.playerPlayTimes || {})) {
                await supabase.from('session_game_players').insert({
                    game_id: insertedGame.id,
                    user_id: uid,
                    play_time_min: Math.floor(ms / 1000 / 60)
                });
            }

            // 댓글
            for (const comment of data.comments) {
                await supabase.from('comments').insert({
                    game_id: insertedGame.id,
                    user_id: comment.userId,
                    content: comment.text,
                    is_checklist: comment.isChecklist,
                    created_at: comment.createdAt,
                    reactions: comment.reactions || {},
                    replies: comment.replies || []
                });
            }
        }

        // 5. 스크린샷 삽입
        for (const shot of session.pendingScreenshots) {
            const uploaderId = Array.from(session.displayNames.keys()).find(uid => session.displayNames.get(uid) === shot.user) || shot.user;
            await supabase.from('screenshots').insert({
                session_id: sessionId,
                game_title: shot.gameTitle,
                url: shot.url,
                uploader_id: uploaderId,
                comment: shot.comment,
                created_at: new Date().toISOString()
            });
        }

        console.log(`[Supabase] 세션 저장 완료: ${sessionId}`);
        return sessionId;
    } catch (e) {
        console.error("[Supabase] 세션 저장 중 오류 발생:", e);
        return null;
    }
}

client.once('ready', async () => {
    console.log('--------------------------------------');
    console.log('🤖 Game Diary 봇 온라인!');
    console.log('--------------------------------------');

    for (const guild of client.guilds.cache.values()) {
        for (const voiceState of guild.voiceStates.cache.values()) {
            if (!voiceState.member || voiceState.member.user.bot || !voiceState.channelId) continue;
            const channelId = voiceState.channelId;
            if (!activeSessions.has(channelId)) {
                activeSessions.set(channelId, {
                    guildId: voiceState.guild.id,
                    guildName: voiceState.guild.name,
                    guildIcon: voiceState.guild.iconURL({ format: 'png', size: 512 }),
                    channelName: voiceState.channel.name, sessionTitle: "오늘의 게임일기", startTime: Date.now(),
                    participants: new Set(), displayNames: new Map(), profileImages: new Map(),
                    gameLogs: {}, participantLogs: {}, pendingScreenshots: [], controlMessage: null 
                });
            }
            const s = activeSessions.get(channelId);
            const userId = voiceState.member.user.id;
            s.participants.add(userId);
            s.displayNames.set(userId, voiceState.member.displayName);
            s.profileImages.set(userId, voiceState.member.user.displayAvatarURL({ format: 'png', size: 256 }));
            
            if (!s.participantLogs[userId]) s.participantLogs[userId] = [];
            s.participantLogs[userId].push({ joinTime: admin.firestore.Timestamp.now(), leaveTime: null });

            const activity = voiceState.member.presence?.activities.find(a => a.type === 0);
            if (activity) await updateGameLog(s, userId, activity);
        }
    }
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;
    const userId = member.user.id;
    
    if (newState.channel) {
        const channelId = newState.channel.id;
        if (!activeSessions.has(channelId)) {
            const session = {
                guildId: newState.guild.id,
                guildName: newState.guild.name, guildIcon: newState.guild.iconURL({ format: 'png', size: 512 }),
                channelName: newState.channel.name, sessionTitle: "오늘의 게임일기", startTime: Date.now(),
                participants: new Set([userId]), displayNames: new Map([[userId, member.displayName]]), profileImages: new Map([[userId, member.user.displayAvatarURL({ format: 'png', size: 256 })]]),
                gameLogs: {}, participantLogs: {}, pendingScreenshots: [], controlMessage: null 
            };
            activeSessions.set(channelId, session);
            const logChannel = newState.guild.channels.cache.find(c => c.name === '일기장');
            if (logChannel) {
                try {
                    const pinnedMessages = await logChannel.messages.fetchPinned();
                    for (const pinnedMsg of pinnedMessages.values()) {
                        if (pinnedMsg.author.id === client.user.id) await pinnedMsg.unpin();
                    }
                } catch (e) { console.error("고정 메시지 해제 실패:", e); }

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('btn_edit_title').setLabel('일기 제목 수정').setStyle(ButtonStyle.Primary).setEmoji('✏️')
                );
                const msg = await logChannel.send({ content: `🎮 **오늘의 게임일기 작성을 시작합니다!**\n현재 제목: **${session.sessionTitle}**`, components: [row] });
                try { await msg.pin(); session.controlMessage = msg; } catch (e) {}
            }
        }
        const session = activeSessions.get(channelId);
        session.participants.add(userId);
        session.displayNames.set(userId, member.displayName);
        session.profileImages.set(userId, member.user.displayAvatarURL({ format: 'png', size: 256 }));
        
        if (!session.participantLogs[userId]) session.participantLogs[userId] = [];
        const lastLog = session.participantLogs[userId][session.participantLogs[userId].length - 1];
        if (!lastLog || lastLog.leaveTime) {
            session.participantLogs[userId].push({ joinTime: admin.firestore.Timestamp.now(), leaveTime: null });
        }

        const activity = member.presence?.activities.find(a => a.type === 0);
        if (activity) await updateGameLog(session, userId, activity);
    }

    if (oldState.channel && oldState.channel.id !== newState.channel?.id) {
        const session = activeSessions.get(oldState.channel.id);
        if (session) {
            if (session.participantLogs[userId]) {
                const lastLog = session.participantLogs[userId][session.participantLogs[userId].length - 1];
                if (lastLog && !lastLog.leaveTime) lastLog.leaveTime = admin.firestore.Timestamp.now();
            }

            for (const gameName of Object.keys(session.gameLogs)) {
                const gameLog = session.gameLogs[gameName];
                if (gameLog.activeStartTime[userId]) {
                    accumulateGamePlayTime(gameLog);
                    const startTime = gameLog.activeStartTime[userId];
                    const duration = Date.now() - startTime;
                    if (!gameLog.playerPlayTimes) gameLog.playerPlayTimes = {};
                    gameLog.playerPlayTimes[userId] = (gameLog.playerPlayTimes[userId] || 0) + duration;
                    gameLog.activeStartTime[userId] = null;
                }
            }
            if (oldState.channel.members.filter(m => !m.user.bot).size === 0) {
                const endTime = Date.now();
                
                // Supabase에 먼저 저장 시도
                const supabaseId = await saveSessionToSupabase(session, endTime);

                const diaryData = {
                    guildName: oldState.guild.name, guildIcon: oldState.guild.iconURL({ format: 'png', size: 512 }),
                    channelName: session.channelName, sessionTitle: session.sessionTitle,
                    startTime: admin.firestore.Timestamp.fromMillis(session.startTime), endTime: admin.firestore.Timestamp.fromMillis(endTime),
                    totalDurationMin: Math.floor((endTime - session.startTime) / 1000 / 60),
                    participants: Array.from(session.participants), displayNames: Object.fromEntries(session.displayNames), profileImages: Object.fromEntries(session.profileImages),
                    participantLogs: session.participantLogs,
                    games: Object.entries(session.gameLogs).map(([name, data]) => ({
                        title: name, playTimeMin: Math.floor(data.totalPlayTime / 1000 / 60),
                        playerPlayTimes: Object.fromEntries(Object.entries(data.playerPlayTimes || {}).map(([id, ms]) => [id, Math.floor(ms / 1000 / 60)])),
                        players: Array.from(data.players), iconURL: data.iconURL, comments: data.comments || [],
                        startTime: admin.firestore.Timestamp.fromMillis(data.startTime),
                        endTime: admin.firestore.Timestamp.fromMillis(data.endTime || endTime)
                    })),
                    screenshots: session.pendingScreenshots 
                };
                try {
                    const docRef = await db.collection('sessions').add(diaryData);
                    const finalId = supabaseId || docRef.id; // Supabase ID 우선 사용

                    if (session.controlMessage) { 
                        try { 
                            const msgs = await session.controlMessage.channel.messages.fetch({ limit: 10 });
                            const pinSysMsg = msgs.find(m => m.type === 6 && m.reference?.messageId === session.controlMessage.id);
                            if (pinSysMsg) await pinSysMsg.delete();
                            await session.controlMessage.delete(); 
                        } catch(e){} 
                    }
                    const logChannel = oldState.guild.channels.cache.find(c => c.name === '일기장');
                    if (logChannel) {
                        const embed = new EmbedBuilder()
                            .setColor(0x1A1D1F)
                            .setDescription(`📖 [여기를 눌러 발행된 일기를 확인하세요!](https://game-diary-2.vercel.app?id=${finalId})`)
                            .addFields({ name: '⏱️ 총 시간', value: `${diaryData.totalDurationMin}분`, inline: true })
                            .setTimestamp();
                        const row = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setLabel('일기 확인하기').setStyle(ButtonStyle.Link).setURL(`https://game-diary-2.vercel.app?id=${finalId}`)
                        );
                        await logChannel.send({ content: `✅ **[${session.sessionTitle}]** 기록 완료!`, embeds: [embed], components: [row] });
                    }
                } catch (e) { console.error("일기 저장 또는 알림 실패:", e); }
                activeSessions.delete(oldState.channel.id);
            }
        }
    }
});

client.on('interactionCreate', async (i) => {
    try {
        // 1:1 DM 인터랙션 처리 (길드가 없는 경우)
        if (!i.guild) {
            if (i.isButton()) {
                if (i.customId === 'btn_solo_start') {
                    const userId = i.user.id;
                    
                    // 유저의 온라인 상태 확인
                    const member = await findMemberInMutualGuilds(userId);
                    const status = member?.presence?.status || 'offline';
                    
                    if (status !== 'online') {
                        // 온라인 상태가 아닌 경우 (idle, dnd, offline)
                        const statusText = formatStatus(status);
                        const warningText = `⚠️ **온라인 상태 설정 필요**\n\n` +
                            `자동 게임 감지를 위해 디스코드 상태가 **'온라인'**이어야 합니다.\n` +
                            `현재 상태가 **자리 비움, 방해 금지 또는 오프라인**으로 되어 있다면, 상태를 **'온라인'**으로 변경한 후 다시 시도해 주세요.\n\n` +
                            `*현재 감지된 상태: **${statusText}***`;
                        
                        const row = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId('btn_solo_start')
                                .setLabel('다시 시도')
                                .setStyle(ButtonStyle.Primary)
                                .setEmoji('🔄')
                        );
                        
                        return i.update({ content: warningText, embeds: [], components: [row] });
                    }
                    
                    // 온라인 상태인 경우: 바로 기록 시작 (서버와 동일하게 디폴트 제목으로 시작)
                    // 만약 이전 세션이 활성화된 상태라면 이전 기록을 자동 저장 및 마감 처리
                    const existingSession = activeSoloSessions.get(userId);
                    if (existingSession) {
                        const endTime = Date.now();
                        
                        // 진행 중인 모든 게임의 활성 시간 누적 및 종료 처리
                        for (const gameName of Object.keys(existingSession.gameLogs)) {
                            const gameLog = existingSession.gameLogs[gameName];
                            if (gameLog.activeStartTime[userId]) {
                                accumulateGamePlayTime(gameLog);
                                const startTime = gameLog.activeStartTime[userId];
                                const duration = endTime - startTime;
                                if (!gameLog.playerPlayTimes) gameLog.playerPlayTimes = {};
                                gameLog.playerPlayTimes[userId] = (gameLog.playerPlayTimes[userId] || 0) + duration;
                                gameLog.activeStartTime[userId] = null;
                                gameLog.endTime = endTime;
                            }
                        }
                        
                        if (existingSession.participantLogs[userId]) {
                            const lastLog = existingSession.participantLogs[userId][existingSession.participantLogs[userId].length - 1];
                            if (lastLog && !lastLog.leaveTime) {
                                lastLog.leaveTime = admin.firestore.Timestamp.now();
                            }
                        }
                        
                        const supabaseId = await saveSessionToSupabase(existingSession, endTime);
                        
                        const diaryData = {
                            guildName: '개인 플레이',
                            guildIcon: null,
                            channelName: existingSession.channelName,
                            sessionTitle: existingSession.sessionTitle,
                            startTime: admin.firestore.Timestamp.fromMillis(existingSession.startTime),
                            endTime: admin.firestore.Timestamp.fromMillis(endTime),
                            totalDurationMin: Math.max(1, Math.floor((endTime - existingSession.startTime) / 1000 / 60)),
                            participants: Array.from(existingSession.participants),
                            displayNames: Object.fromEntries(existingSession.displayNames),
                            profileImages: Object.fromEntries(existingSession.profileImages),
                            participantLogs: existingSession.participantLogs,
                            games: Object.entries(existingSession.gameLogs).map(([name, data]) => ({
                                title: name,
                                playTimeMin: Math.max(1, Math.floor(data.totalPlayTime / 1000 / 60)),
                                playerPlayTimes: Object.fromEntries(Object.entries(data.playerPlayTimes || {}).map(([id, ms]) => [id, Math.max(1, Math.floor(ms / 1000 / 60))])),
                                players: Array.from(data.players),
                                iconURL: data.iconURL,
                                comments: data.comments || [],
                                startTime: admin.firestore.Timestamp.fromMillis(data.startTime),
                                endTime: admin.firestore.Timestamp.fromMillis(data.endTime || endTime)
                             })),
                             screenshots: existingSession.pendingScreenshots 
                        };
                        
                        let finalId = supabaseId;
                        try {
                            const docRef = await db.collection('sessions').add(diaryData);
                            if (!finalId) finalId = docRef.id;
                        } catch (e) {
                            console.error("Firebase 이전 세션 자동 저장 실패:", e);
                        }
                        
                        if (!finalId) finalId = existingSession.id;
                        
                        // 기존 제어 패널 메시지 삭제 시도
                        if (existingSession.controlMessage) {
                            try {
                                await existingSession.controlMessage.delete();
                            } catch (e) {}
                        }
                        
                        activeSoloSessions.delete(userId);
                        
                        // 이전 일기 완료 보고 메시지 발송
                        const embed = new EmbedBuilder()
                            .setColor(0x1A1D1F)
                            .setDescription(`📖 [여기를 눌러 발행된 일기를 확인하세요!](https://game-diary-2.vercel.app?id=${finalId})`)
                            .addFields({ name: '⏱️ 총 시간', value: `${diaryData.totalDurationMin}분`, inline: true })
                            .setTimestamp();
                            
                        const row = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setLabel('이전 일기 확인하기')
                                .setStyle(ButtonStyle.Link)
                                .setURL(`https://game-diary-2.vercel.app?id=${finalId}`)
                        );
                        
                        await i.channel.send({
                            content: `⚠️ **이전 일기 자동 마감**\n기록 종료되지 않고 남아 있던 이전 일기 **[${existingSession.sessionTitle}]**를 저장하고 안전하게 종료했습니다.`,
                            embeds: [embed],
                            components: [row]
                        });
                    }
                    
                    const activity = member?.presence?.activities?.find(a => a.type === 0);
                    const gameName = activity ? activity.name : '미지정';
                    await startSoloSession(i, userId, gameName, "오늘의 게임일기", activity || null);
                } else if (i.customId === 'btn_edit_title_solo') {
                    // DM 전용 일기 제목 수정 모달 띄우기
                    const m = new ModalBuilder()
                        .setCustomId('modal_edit_title_solo')
                        .setTitle('일기 제목 입력');
                    
                    m.addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('input_title_solo')
                                .setLabel('오늘 일기의 제목을 입력해 주세요.')
                                .setPlaceholder('예: 오늘의 게임일기')
                                .setStyle(TextInputStyle.Short)
                                .setRequired(true)
                        )
                    );
                    await i.showModal(m);
                } else if (i.customId === 'btn_solo_end') {
                    const userId = i.user.id;
                    const session = activeSoloSessions.get(userId);
                    if (!session) {
                        return i.reply({ content: "진행 중인 개인 기록 세션이 없습니다.", flags: [MessageFlags.Ephemeral] });
                    }
                    
                    // Supabase & Firebase DB 저장이 3초를 초과할 수 있으므로 상호작용 지연 선언
                    await i.deferUpdate();
                    
                    // 세션 종료 및 저장
                    const endTime = Date.now();
                    
                    // 진행 중인 모든 게임의 활성 시간 누적 및 종료 처리
                    for (const gameName of Object.keys(session.gameLogs)) {
                        const gameLog = session.gameLogs[gameName];
                        if (gameLog.activeStartTime[userId]) {
                            accumulateGamePlayTime(gameLog);
                            const startTime = gameLog.activeStartTime[userId];
                            const duration = endTime - startTime;
                            if (!gameLog.playerPlayTimes) gameLog.playerPlayTimes = {};
                            gameLog.playerPlayTimes[userId] = (gameLog.playerPlayTimes[userId] || 0) + duration;
                            gameLog.activeStartTime[userId] = null;
                            gameLog.endTime = endTime;
                        }
                    }
                    
                    if (session.participantLogs[userId]) {
                        const lastLog = session.participantLogs[userId][session.participantLogs[userId].length - 1];
                        if (lastLog && !lastLog.leaveTime) {
                            lastLog.leaveTime = admin.firestore.Timestamp.now();
                        }
                    }
                    
                    const supabaseId = await saveSessionToSupabase(session, endTime);
                    
                    const diaryData = {
                        guildName: '개인 플레이',
                        guildIcon: null,
                        channelName: session.channelName,
                        sessionTitle: session.sessionTitle,
                        startTime: admin.firestore.Timestamp.fromMillis(session.startTime),
                        endTime: admin.firestore.Timestamp.fromMillis(endTime),
                        totalDurationMin: Math.max(1, Math.floor((endTime - session.startTime) / 1000 / 60)),
                        participants: Array.from(session.participants),
                        displayNames: Object.fromEntries(session.displayNames),
                        profileImages: Object.fromEntries(session.profileImages),
                        participantLogs: session.participantLogs,
                        games: Object.entries(session.gameLogs).map(([name, data]) => ({
                            title: name,
                            playTimeMin: Math.max(1, Math.floor(data.totalPlayTime / 1000 / 60)),
                            playerPlayTimes: Object.fromEntries(Object.entries(data.playerPlayTimes || {}).map(([id, ms]) => [id, Math.max(1, Math.floor(ms / 1000 / 60))])),
                            players: Array.from(data.players),
                            iconURL: data.iconURL,
                            comments: data.comments || [],
                            startTime: admin.firestore.Timestamp.fromMillis(data.startTime),
                            endTime: admin.firestore.Timestamp.fromMillis(data.endTime || endTime)
                         })),
                         screenshots: session.pendingScreenshots 
                    };
                    
                    let finalId = supabaseId;
                    try {
                        const docRef = await db.collection('sessions').add(diaryData);
                        if (!finalId) finalId = docRef.id;
                    } catch (e) {
                        console.error("Firebase 저장 실패:", e);
                    }
                    
                    if (!finalId) finalId = session.id;
                    
                    activeSoloSessions.delete(userId);
                    
                    // 기존 제어 메시지 삭제
                    if (session.controlMessage) {
                        try {
                            await session.controlMessage.delete();
                        } catch (e) {
                            console.error("솔로 세션 제어 메시지 삭제 실패:", e);
                        }
                    }
                    
                    const embed = new EmbedBuilder()
                        .setColor(0x1A1D1F)
                        .setDescription(`📖 [여기를 눌러 발행된 일기를 확인하세요!](https://game-diary-2.vercel.app?id=${finalId})`)
                        .addFields({ name: '⏱️ 총 시간', value: `${diaryData.totalDurationMin}분`, inline: true })
                        .setTimestamp();
                        
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setLabel('일기 확인하기')
                            .setStyle(ButtonStyle.Link)
                            .setURL(`https://game-diary-2.vercel.app?id=${finalId}`)
                    );
                    
                    await i.channel.send({ content: `✅ **[${session.sessionTitle}]** 기록 완료!`, embeds: [embed], components: [row] });
                }
            } else if (i.isModalSubmit()) {
                if (i.customId === 'modal_edit_title_solo') {
                    const userId = i.user.id;
                    const session = activeSoloSessions.get(userId);
                    if (!session) {
                        return i.reply({ content: "진행 중인 개인 기록 세션이 없습니다.", flags: [MessageFlags.Ephemeral] });
                    }
                    
                    session.sessionTitle = i.fields.getTextInputValue('input_title_solo');
                    
                    // 제어 패널 메시지의 content 부분 업데이트하여 제목 반영
                    if (session.controlMessage) {
                        try {
                            const existingEmbeds = session.controlMessage.embeds.map(e => EmbedBuilder.from(e));
                            const existingComponents = session.controlMessage.components.map(row => ActionRowBuilder.from(row));
                            
                            await session.controlMessage.edit({
                                content: `🎮 **오늘의 게임일기 작성을 시작합니다!**\n현재 제목: **${session.sessionTitle}**`,
                                embeds: existingEmbeds,
                                components: existingComponents
                            });
                        } catch (e) {
                            console.error("솔로 세션 제목 업데이트 메시지 수정 오류:", e);
                        }
                    }
                    
                    await i.reply({ content: '일기 제목이 변경되었습니다.', flags: [MessageFlags.Ephemeral] });
                }
            }
            return;
        }

        // 서버(길드) 인터랙션 처리
        const s = activeSessions.get(i.member?.voice?.channelId);
        if (i.isButton()) {
            if (!s) return i.reply({ content: "채널 참여 중이어야 함.", flags: [MessageFlags.Ephemeral] });
            if (i.customId === 'btn_edit_title') { 
                const m = new ModalBuilder().setCustomId('modal_edit_title').setTitle('일기 제목 입력'); 
                m.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('input_title')
                            .setLabel("오늘 일기의 제목을 입력해 주세요.")
                            .setPlaceholder("예: 오늘의 게임일기")
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                    )
                ); 
                await i.showModal(m); 
            }
        }
        if (i.isModalSubmit() && s) {
            if (i.customId === 'modal_edit_title') { 
                s.sessionTitle = i.fields.getTextInputValue('input_title'); 
                if (s.controlMessage) await s.controlMessage.edit({ content: `🎮 제목: **${s.sessionTitle}**` }); 
                await i.reply({ content: '변경됨', flags: [MessageFlags.Ephemeral] }); 
            }
        }
    } catch (error) {
        console.error("인터랙션 처리 중 오류 발생:", error);
        try {
            if (!i.replied && !i.deferred) {
                await i.reply({ content: "요청을 처리하는 도중 오류가 발생했습니다. 다시 시도해 주세요.", flags: [MessageFlags.Ephemeral] });
            }
        } catch (e) {}
    }
});

client.on('messageCreate', async (m) => {
    if (m.author.bot) return;

    // 1:1 DM 처리
    if (!m.guild) {
        const session = activeSoloSessions.get(m.author.id);
        if (!session) {
            // 진행 중인 개인 세션이 없으면 안내 패널 전송
            const embed = new EmbedBuilder()
                .setColor(0xE05D38)
                .setTitle(`🎮 개인 게임 일기 기록`)
                .setDescription(`안녕하세요! Game Diary 봇입니다.\n서버에 참여하지 않고도 개인 플레이 일기를 기록하실 수 있습니다.\n\n아래 **기록 시작** 버튼을 누르면 기록을 시작합니다.`);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('btn_solo_start')
                    .setLabel('기록 시작')
                    .setStyle(ButtonStyle.Success)
            );
            await m.channel.send({ embeds: [embed], components: [row] });
            return;
        }

        // 진행 중인 세션이 있는 경우
        let activeGameTitle = "미지정";
        const member = await findMemberInMutualGuilds(m.author.id);
        const presence = member?.presence;
        const uploaderGame = presence?.activities.find(a => a.type === 0);
        if (uploaderGame) {
            activeGameTitle = uploaderGame.name;
            if (!session.gameLogs[activeGameTitle]) {
                await updateGameLog(session, m.author.id, uploaderGame);
            }
        } else {
            for (const [name, log] of Object.entries(session.gameLogs)) {
                const isPlayerActive = log.activeStartTime[m.author.id] !== null;
                if (isPlayerActive) {
                    activeGameTitle = name;
                    break;
                }
            }
            if (activeGameTitle === "미지정") {
                const keys = Object.keys(session.gameLogs);
                if (keys.length > 0) activeGameTitle = keys[0];
            }
        }

        if (m.attachments.size === 0 && m.content.trim()) {
            if (activeGameTitle !== "미지정" && session.gameLogs[activeGameTitle]) {
                let text = m.content.trim();
                let isChecklist = false;
                let isReplacement = false;
                
                if (text.startsWith('메모)')) {
                    isChecklist = true;
                    text = text.replace(/^메모\)\s*/, '');
    
                    const existingIndex = session.gameLogs[activeGameTitle].comments.findIndex(
                        c => c.userId === m.author.id && c.isChecklist
                    );
                    
                    if (existingIndex !== -1) {
                        isReplacement = true;
                        session.gameLogs[activeGameTitle].comments.splice(existingIndex, 1);
                    }
                }
    
                session.gameLogs[activeGameTitle].comments.push({
                    userId: m.author.id,
                    user: m.author.displayName,
                    image: m.author.displayAvatarURL({ format: 'png', size: 128 }),
                    text: text,
                    isChecklist: isChecklist,
                    createdAt: new Date().toISOString(),
                    reactions: {},
                    replies: []
                });
    
                if (isChecklist) {
                    m.react(isReplacement ? '🔄' : '📌');
                } else {
                    m.react('💬');
                }
            }
        }
        if (m.attachments.size > 0) {
            for (const a of m.attachments.values()) {
                if (a.contentType?.startsWith('image/')) {
                    try {
                        const buffer = Buffer.from(await (await fetch(a.url)).arrayBuffer());
                        const fileName = `${Date.now()}_${a.name}`;
                        
                        // Firebase (Legacy)
                        const f = bucket.file(`screenshots/${fileName}`);
                        await f.save(buffer, { contentType: a.contentType });
                        await f.makePublic();
                        
                        // Supabase (New)
                        const { data: uploadData, error: uploadError } = await supabase.storage
                            .from('screenshots')
                            .upload(`shots/${fileName}`, buffer, { contentType: a.contentType });
                        
                        let finalUrl = f.publicUrl();
                        if (!uploadError) {
                            const { data: publicUrlData } = supabase.storage.from('screenshots').getPublicUrl(`shots/${fileName}`);
                            finalUrl = publicUrlData.publicUrl;
                        }
    
                        session.pendingScreenshots.push({
                            url: finalUrl,
                            user: m.author.displayName,
                            comment: m.content || "",
                            gameTitle: activeGameTitle
                        });
                        m.react('✅');
                    } catch (e) {
                        console.error("이미지 업로드 실패:", e);
                    }
                }
            }
        }
        return;
    }

    // 길드(서버) 처리
    const logChannel = m.guild.channels.cache.find(c => c.name === '일기장');
    if (m.channel.id !== logChannel?.id) return;
    const voiceChannelId = m.guild.voiceStates.cache.get(m.author.id)?.channelId;
    const s = activeSessions.get(voiceChannelId);
    if (!s) return;
    let activeGameTitle = "미지정";
    const member = m.guild.members.cache.get(m.author.id);
    const presence = member?.presence;
    const uploaderGame = presence?.activities.find(a => a.type === 0);
    if (uploaderGame) {
        activeGameTitle = uploaderGame.name;
        if (!s.gameLogs[activeGameTitle]) await updateGameLog(s, m.author.id, uploaderGame);
    } else {
        for (const [name, log] of Object.entries(s.gameLogs)) {
            const isAnyPlayerActive = Object.values(log.activeStartTime).some(time => time !== null);
            if (isAnyPlayerActive) { activeGameTitle = name; break; }
        }
    }
    if (m.attachments.size === 0 && m.content.trim()) {
        if (activeGameTitle !== "미지정" && s.gameLogs[activeGameTitle]) {
            let text = m.content.trim();
            let isChecklist = false;
            let isReplacement = false;
            
            if (text.startsWith('메모)')) {
                isChecklist = true;
                text = text.replace(/^메모\)\s*/, '');

                const existingIndex = s.gameLogs[activeGameTitle].comments.findIndex(
                    c => c.userId === m.author.id && c.isChecklist
                );
                
                if (existingIndex !== -1) {
                    isReplacement = true;
                    s.gameLogs[activeGameTitle].comments.splice(existingIndex, 1);
                }
            }

            s.gameLogs[activeGameTitle].comments.push({
                userId: m.author.id, user: m.member.displayName,
                image: m.author.displayAvatarURL({ format: 'png', size: 128 }),
                text: text, isChecklist: isChecklist, createdAt: new Date().toISOString(), reactions: {}, replies: []
            });

            if (isChecklist) {
                m.react(isReplacement ? '🔄' : '📌');
            } else {
                m.react('💬');
            }
        }
    }
    if (m.attachments.size > 0) {
        for (const a of m.attachments.values()) {
            if (a.contentType?.startsWith('image/')) {
                try {
                    const buffer = Buffer.from(await (await fetch(a.url)).arrayBuffer());
                    const fileName = `${Date.now()}_${a.name}`;
                    
                    // Firebase (Legacy)
                    const f = bucket.file(`screenshots/${fileName}`);
                    await f.save(buffer, { contentType: a.contentType });
                    await f.makePublic();
                    
                    // Supabase (New)
                    const { data: uploadData, error: uploadError } = await supabase.storage
                        .from('screenshots')
                        .upload(`shots/${fileName}`, buffer, { contentType: a.contentType });
                    
                    let finalUrl = f.publicUrl();
                    if (!uploadError) {
                        const { data: publicUrlData } = supabase.storage.from('screenshots').getPublicUrl(`shots/${fileName}`);
                        finalUrl = publicUrlData.publicUrl;
                    }

                    s.pendingScreenshots.push({ url: finalUrl, user: m.member.displayName, comment: m.content || "", gameTitle: activeGameTitle });
                    m.react('✅');
                } catch (e) { console.error("이미지 업로드 실패:", e); }
            }
        }
    }
});

client.on('presenceUpdate', async (o, n) => {
    if (!n.member || n.user.bot) return;
    let s = findSessionByUserId(n.userId);
    if (!s) {
        s = activeSoloSessions.get(n.userId);
    }
    if (!s) return;
    const oldG = o?.activities.find(a => a.type === 0);
    const newG = n.activities.find(a => a.type === 0);
    if (oldG && (!newG || oldG.name !== newG.name)) {
        const gameLog = s.gameLogs[oldG.name];
        if (gameLog) {
            const startTime = gameLog.activeStartTime[n.userId];
            if (startTime) {
                accumulateGamePlayTime(gameLog);
                const duration = Date.now() - startTime;
                if (!gameLog.playerPlayTimes) gameLog.playerPlayTimes = {};
                gameLog.playerPlayTimes[n.userId] = (gameLog.playerPlayTimes[n.userId] || 0) + duration;
                gameLog.activeStartTime[n.userId] = null;
                gameLog.endTime = Date.now();

                // 게임 플레이 종료 알림 전송
                (async () => {
                    try {
                        const durationSec = Math.floor(duration / 1000);
                        let durationText = `${durationSec}초`;
                        if (durationSec >= 60) {
                            const durationMin = Math.floor(durationSec / 60);
                            durationText = `${durationMin}분`;
                        }
                        
                        const finalIconURL = gameLog ? gameLog.iconURL : null;
                        await sendNotification(s, n.userId, `${oldG.name} 기록을 종료합니다. (플레이 시간: ${durationText})`, finalIconURL);
                    } catch (e) {
                        console.error("[presenceUpdate] 게임 종료 알림 전송 실패:", e);
                    }
                })();
            }
        }
    }
    if (newG) await updateGameLog(s, n.userId, newG);
});

client.login(process.env.DISCORD_TOKEN);
