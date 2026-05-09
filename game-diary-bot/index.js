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
    EmbedBuilder 
} = require('discord.js');
const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));

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
        GatewayIntentBits.MessageContent 
    ],
});

const activeSessions = new Map();

// 헬퍼 함수: 시간 포맷팅 (분 -> n시간 n분)
function formatDuration(minutes) {
    if (minutes < 60) return `${minutes}분`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

// 헬퍼 함수: 게임 추적 중지 및 시간 합산
function stopGameTracking(session, userId, gameName) {
    if (session.gameLogs[gameName] && session.gameLogs[gameName].activeStartTime[userId]) {
        const startTime = session.gameLogs[gameName].activeStartTime[userId];
        const duration = Date.now() - startTime;
        
        // 전체 시간 합산
        session.gameLogs[gameName].totalPlayTime += duration;
        
        // 개별 인원 시간 합산
        if (!session.gameLogs[gameName].playerPlayTimes) {
            session.gameLogs[gameName].playerPlayTimes = {};
        }
        if (!session.gameLogs[gameName].playerPlayTimes[userId]) {
            session.gameLogs[gameName].playerPlayTimes[userId] = 0;
        }
        session.gameLogs[gameName].playerPlayTimes[userId] += duration;
        
        session.gameLogs[gameName].activeStartTime[userId] = null;
        console.log(`🎮 [Game Tracking] 유저(${userId})가 ${gameName} 플레이 종료 (${Math.floor(duration/1000)}초)`);
    }
}

// 헬퍼 함수: 게임 로그 업데이트 (시작) - 아이콘 수집 로직 강화
async function updateGameLog(session, userId, activity) {
    if (activity && activity.type === 0) {
        const gameName = activity.name;
        
        // 1. 우선순위: 리치 프레젠스 에셋 이미지
        let iconURL = activity.assets ? activity.assets.largeImageURL({ format: 'png', size: 512 }) : null;

        // 2. 차선순위: 애플리케이션 공식 아이콘 (사용자 제보 기반)
        if (!iconURL && activity.applicationId) {
            try {
                // 게임 앱 정보를 디스코드에서 가져와 아이콘 추출
                const app = await client.applications.fetch(activity.applicationId);
                if (app && app.icon) {
                    iconURL = app.iconURL({ format: 'png', size: 512 });
                }
            } catch (e) {
                // 오류 시 무시 (권한 또는 등록되지 않은 앱)
            }
        }

        if (!session.gameLogs[gameName]) {
            session.gameLogs[gameName] = { 
                totalPlayTime: 0, 
                playerPlayTimes: {},
                players: new Set(), 
                activeStartTime: {}, 
                iconURL: iconURL,
                comments: [] 
            };
        } else if (!session.gameLogs[gameName].iconURL && iconURL) {
            // 나중에라도 아이콘을 찾으면 업데이트
            session.gameLogs[gameName].iconURL = iconURL;
        }

        if (!session.gameLogs[gameName].activeStartTime[userId]) {
            session.gameLogs[gameName].activeStartTime[userId] = Date.now();
            session.gameLogs[gameName].players.add(userId);
            console.log(`🎮 [Game Tracking] 유저(${userId})가 ${gameName} 플레이 시작`);
        }
    }
}

client.once('ready', async () => {
    console.log('--------------------------------------');
    console.log('🤖 [Game Diary] 일기 공유 및 한줄평 시스템 가동 중...');
    console.log('--------------------------------------');

    // 🚀 부팅 시 이미 음성 채널에 있는 유저들 감지 및 세션 생성
    for (const guild of client.guilds.cache.values()) {
        for (const voiceState of guild.voiceStates.cache.values()) {
            if (!voiceState.member || voiceState.member.user.bot || !voiceState.channelId) continue;
            
            const channel = voiceState.channel;
            const channelId = channel.id;
            const member = voiceState.member;
            const userId = member.user.id;
            const nickname = member.displayName;
            const avatarURL = member.user.displayAvatarURL({ format: 'png', size: 256 });

            if (!activeSessions.has(channelId)) {
                const session = {
                    channelName: channel.name,
                    sessionTitle: "오늘의 게임일기",
                    startTime: Date.now(),
                    participants: new Set(),
                    displayNames: new Map(),
                    profileImages: new Map(),
                    gameLogs: {},
                    pendingScreenshots: [],
                    controlMessage: null 
                };
                activeSessions.set(channelId, session);
                console.log(`📡 [Startup] ${channel.name} 채널 세션 자동 생성`);
            }

            const session = activeSessions.get(channelId);
            session.participants.add(userId);
            session.displayNames.set(userId, nickname);
            session.profileImages.set(userId, avatarURL);

            const currentActivity = member.presence?.activities.find(a => a.type === 0);
            if (currentActivity) {
                await updateGameLog(session, userId, currentActivity);
            }
        }
    }
});

// 🎤 음성 채널 세션 관리
client.on('voiceStateUpdate', async (oldState, newState) => {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    const userId = member.user.id;
    const nickname = member.displayName;
    const avatarURL = member.user.displayAvatarURL({ format: 'png', size: 256 });
    
    const oldChannel = oldState.channel;
    const newChannel = newState.channel;

    // 1. 새로운 채널에 입장했거나 채널을 이동한 경우
    if (newChannel) {
        const channelId = newChannel.id;
        
        // 해당 채널의 세션이 없으면 새로 생성
        if (!activeSessions.has(channelId)) {
            const session = {
                channelName: newChannel.name,
                sessionTitle: "오늘의 게임일기",
                startTime: Date.now(),
                participants: new Set([userId]),
                displayNames: new Map([[userId, nickname]]),
                profileImages: new Map([[userId, avatarURL]]),
                gameLogs: {},
                pendingScreenshots: [],
                controlMessage: null 
            };
            activeSessions.set(channelId, session);

            const logChannel = newState.guild.channels.cache.find(c => c.name === '일기장');
            if (logChannel) {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('btn_edit_title')
                        .setLabel('일기 제목 수정')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('✏️'),
                    new ButtonBuilder()
                        .setCustomId('btn_write_review')
                        .setLabel('게임 한줄평 작성')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('📝')
                );

                const msg = await logChannel.send({
                    content: `🎮 **오늘의 게임일기 작성을 시작합니다!**\n현재 제목: **${session.sessionTitle}**`,
                    components: [row]
                });

                try {
                    await msg.pin();
                    session.controlMessage = msg;
                } catch (e) {
                    console.error("메시지 고정 실패 (권한 필요):", e);
                }
            }
        }
        
        const session = activeSessions.get(channelId);
        session.participants.add(userId);
        session.displayNames.set(userId, nickname);
        session.profileImages.set(userId, avatarURL);

        // 현재 하고 있는 게임 추적 시작
        const currentActivity = member.presence?.activities.find(a => a.type === 0);
        if (currentActivity) {
            await updateGameLog(session, userId, currentActivity);
        }
    }

    // 2. 이전 채널에서 퇴장했거나 채널을 이동한 경우
    if (oldChannel && oldChannel.id !== newChannel?.id) {
        const channelId = oldChannel.id;
        if (activeSessions.has(channelId)) {
            const session = activeSessions.get(channelId);
            
            // 퇴장하는 사용자의 게임 추적 중지
            for (const gameName of Object.keys(session.gameLogs)) {
                stopGameTracking(session, userId, gameName);
            }

            // 채널에 남은 인원 확인 (봇 제외)
            const remainingHumans = oldChannel.members.filter(m => !m.user.bot).size;
            if (remainingHumans === 0) {
                const endTime = Date.now();
                
                // 🛑 세션 종료 전 모든 활성 게임 로그를 현재 시간으로 마감
                for (const [gameName, data] of Object.entries(session.gameLogs)) {
                    for (const [pId, startTime] of Object.entries(data.activeStartTime)) {
                        if (startTime) {
                            stopGameTracking(session, pId, gameName);
                        }
                    }
                }

                const diaryData = {
                    guildName: oldState.guild.name, 
                    guildIcon: oldState.guild.iconURL({ format: 'png', size: 512 }),
                    channelName: session.channelName,
                    sessionTitle: session.sessionTitle,
                    startTime: admin.firestore.Timestamp.fromMillis(session.startTime),
                    endTime: admin.firestore.Timestamp.fromMillis(endTime),
                    totalDurationMin: Math.floor((endTime - session.startTime) / 1000 / 60),
                    participants: Array.from(session.participants),
                    displayNames: Object.fromEntries(session.displayNames),
                    profileImages: Object.fromEntries(session.profileImages),
                    games: Object.entries(session.gameLogs).map(([name, data]) => ({
                        title: name,
                        playTimeMin: Math.floor(data.totalPlayTime / 1000 / 60),
                        playerPlayTimes: Object.fromEntries(
                            Object.entries(data.playerPlayTimes || {}).map(([id, ms]) => [id, Math.floor(ms / 1000 / 60)])
                        ),
                        players: Array.from(data.players),
                        iconURL: data.iconURL,
                        comments: data.comments || [] 
                    })),
                    screenshots: session.pendingScreenshots 
                };

                try {
                    // 🌟 1. Firestore에 저장하고 ID를 받아옵니다.
                    const docRef = await db.collection('sessions').add(diaryData);
                    
                    if (session.controlMessage) {
                        await session.controlMessage.unpin().catch(() => {});
                        await session.controlMessage.edit({ 
                            content: `✅ **오늘의 게임일기 기록이 완료되었습니다!**\n최종 제목: **${session.sessionTitle}**\n*(이 메시지는 기록 보존을 위해 남겨집니다.)*`,
                            components: [] 
                        }).catch(() => {});
                    }

                    // 🌟 2. 채널에 '발행 완료' 카드 전송
                    const logChannel = oldState.guild.channels.cache.find(c => c.name === '일기장');
                    if (logChannel) {
                        const webURL = `https://game-diary-2.vercel.app?id=${docRef.id}`;
                        const gameList = Object.keys(session.gameLogs).join(', ') || '대화';
                        
                        const embed = new EmbedBuilder()
                            .setColor(0x1A1D1F)
                            .setTitle(`📖 [${session.sessionTitle}] 일기가 발행되었습니다!`)
                            .setDescription(`오늘의 추억이 성공적으로 기록되었습니다. 아래 버튼을 눌러 일기장에서 확인해보세요!`)
                            .addFields(
                                { name: '🎮 플레이한 게임', value: gameList, inline: true },
                                { name: '⏱️ 총 시간', value: formatDuration(diaryData.totalDurationMin), inline: true },
                                { name: '👥 참여 인원', value: `${session.participants.size}명`, inline: true }
                            )
                            .setTimestamp();

                        const row = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setLabel('웹에서 일기 확인하기')
                                .setStyle(ButtonStyle.Link)
                                .setURL(webURL),
                            new ButtonBuilder()
                                .setCustomId(`delete_session_${docRef.id}`)
                                .setLabel('기록 삭제')
                                .setStyle(ButtonStyle.Danger)
                        );

                        await logChannel.send({ embeds: [embed], components: [row] });
                    }

                    console.log(`✅ [Firebase] 일기 저장 및 공유 완료! (ID: ${docRef.id})`);
                } catch (e) { console.error('❌ 저장 실패:', e); }
                activeSessions.delete(channelId);
            }
        }
    }
});

// 📸 메시지 감지 및 스크릿샷 분류 (기존 유지)
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const channelId = message.member?.voice?.channelId;
    if (!channelId || !activeSessions.has(channelId)) return;
    const session = activeSessions.get(channelId);

    if (message.attachments.size > 0) {
        const uploaderNickname = message.member.displayName;
        const comment = message.content || "";
        const uploadedIndices = [];

        for (const attachment of message.attachments.values()) {
            if (attachment.contentType?.startsWith('image/')) {
                try {
                    const fileName = `screenshots/${Date.now()}_${attachment.name}`;
                    const file = bucket.file(fileName);
                    const response = await fetch(attachment.url);
                    const buffer = Buffer.from(await response.arrayBuffer());
                    await file.save(buffer, { contentType: attachment.contentType });
                    await file.makePublic();
                    
                    const newScreenshot = {
                        url: file.publicUrl(),
                        user: uploaderNickname,
                        comment: comment,
                        gameTitle: "미지정"
                    };
                    
                    session.pendingScreenshots.push(newScreenshot);
                    uploadedIndices.push(session.pendingScreenshots.length - 1);
                    message.react('✅');
                } catch (error) { console.error('❌ 사진 업로드 오류:', error); }
            }
        }

        const games = Object.keys(session.gameLogs);
        if (games.length > 0 && uploadedIndices.length > 0) {
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`select_game_${Date.now()}`)
                .setPlaceholder('이 사진들은 어떤 게임인가요?')
                .addOptions(games.map(game => ({ label: game, value: game })));

            const row = new ActionRowBuilder().addComponents(selectMenu);
            const response = await message.reply({
                content: '📸 **스크린샷 분류**: 게임을 선택해 주세요!',
                components: [row]
            });

            const collector = response.createMessageComponentCollector({
                componentType: ComponentType.StringSelect,
                time: 60000 
            });

            collector.on('collect', async (i) => {
                if (i.user.id !== message.author.id) {
                    return i.reply({ content: '직접 올린 사진만 분류할 수 있어요!', ephemeral: true });
                }
                const selectedGame = i.values[0];
                uploadedIndices.forEach(idx => {
                    if (session.pendingScreenshots[idx]) {
                        session.pendingScreenshots[idx].gameTitle = selectedGame;
                    }
                });
                await i.update({
                    content: `✅ 사진이 **${selectedGame}**으로 분류되었습니다!`,
                    components: [] 
                });
            });

            collector.on('end', collected => {
                if (collected.size === 0) response.edit({ components: [] }).catch(() => {});
            });
        }
    }
});

// 🎮 실시간 게임 감지
client.on('presenceUpdate', async (oldPresence, newPresence) => {
    if (!newPresence || newPresence.user.bot) return;
    const member = newPresence.member;
    const channelId = member?.voice?.channelId;
    if (!channelId || !activeSessions.has(channelId)) return;
    
    const session = activeSessions.get(channelId);
    const userId = member.user.id;

    const oldGame = oldPresence?.activities.find(a => a.type === 0);
    const newGame = newPresence.activities.find(a => a.type === 0);

    // 게임이 바뀌었거나 종료된 경우
    if (oldGame && (!newGame || oldGame.name !== newGame.name)) {
        stopGameTracking(session, userId, oldGame.name);
    }

    // 새로운 게임 시작
    if (newGame) {
        await updateGameLog(session, userId, newGame);
    }
});

client.login(process.env.DISCORD_TOKEN);