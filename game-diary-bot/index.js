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
    MessageFlags
} = require('discord.js');
const admin = require('firebase-admin');
const path = require('path');

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
        GatewayIntentBits.MessageContent 
    ],
});

const activeSessions = new Map();

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
                    const snapshot = await db.collection('sessions')
                        .where('startTime', '<', admin.firestore.Timestamp.fromMillis(session.startTime))
                        .orderBy('startTime', 'desc')
                        .limit(10)
                        .get();

                    for (const doc of snapshot.docs) {
                        const prevData = doc.data();
                        const prevGame = prevData.games?.find(g => g.title === originalName);
                        if (prevGame) {
                            const checklists = prevGame.comments?.filter(c => c.isChecklist);
                            if (checklists && checklists.length > 0) {
                                const guild = client.guilds.cache.find(g => g.name === prevData.guildName) || Array.from(client.guilds.cache.values())[0];
                                const logChannel = guild?.channels.cache.find(c => c.name === '일기장');
                                if (logChannel) {
                                    const checklistText = checklists.map(c => `💬 **${c.user}** : ${c.text}`).join('\n');
                                    await logChannel.send({ 
                                        content: `💡 **${originalName}**을(를) 다시 시작하셨네요! 과거의 내가 남겨둔 메모가 있어요.\n\n${checklistText}`
                                    });
                                }
                            }
                            break;
                        }
                    }
                } catch (e) { console.error("체크리스트 조회 실패:", e); }
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
                            .setDescription(`📖 [여기를 눌러 발행된 일기를 확인하세요!](https://game-diary-2.vercel.app?id=${docRef.id})`)
                            .addFields({ name: '⏱️ 총 시간', value: `${diaryData.totalDurationMin}분`, inline: true })
                            .setTimestamp();
                        const row = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setLabel('일기 확인하기').setStyle(ButtonStyle.Link).setURL(`https://game-diary-2.vercel.app?id=${docRef.id}`)
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
    const s = activeSessions.get(i.member?.voice?.channelId);
    if (i.isButton()) {
        if (!s) return i.reply({ content: "채널 참여 중이어야 함.", flags: [MessageFlags.Ephemeral] });
        if (i.customId === 'btn_edit_title') { 
            const m = new ModalBuilder().setCustomId('modal_edit_title').setTitle('제목 설정'); 
            m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('input_title').setLabel("제목").setStyle(TextInputStyle.Short).setRequired(true))); 
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
});

client.on('messageCreate', async (m) => {
    if (m.author.bot || !m.guild) return;
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
            s.gameLogs[activeGameTitle].comments.push({
                userId: m.author.id, user: m.member.displayName,
                image: m.author.displayAvatarURL({ format: 'png', size: 128 }),
                text: m.content.trim(), createdAt: new Date().toISOString(), reactions: {}, replies: []
            });
            m.react('💬');
        }
    }
    if (m.attachments.size > 0) {
        for (const a of m.attachments.values()) {
            if (a.contentType?.startsWith('image/')) {
                try {
                    const f = bucket.file(`screenshots/${Date.now()}_${a.name}`);
                    await f.save(Buffer.from(await (await fetch(a.url)).arrayBuffer()), { contentType: a.contentType });
                    await f.makePublic();
                    s.pendingScreenshots.push({ url: f.publicUrl(), user: m.member.displayName, comment: m.content || "", gameTitle: activeGameTitle });
                    m.react('✅');
                } catch (e) { console.error("이미지 업로드 실패:", e); }
            }
        }
    }
});

client.on('presenceUpdate', async (o, n) => {
    if (!n.member || n.user.bot) return;
    const s = findSessionByUserId(n.userId);
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
            }
        }
    }
    if (newG) await updateGameLog(s, n.userId, newG);
});

client.login(process.env.DISCORD_TOKEN);
