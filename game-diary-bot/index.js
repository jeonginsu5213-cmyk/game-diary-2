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

// 🌟 수동 게임 아이콘 매칭 리스트 (계속 업데이트 가능)
const MANUAL_GAME_MAP = {
    "valheim": "https://cdn.discordapp.com/app-icons/1124358970618953818/93ac3b8489a031b721995a99102c73f1.png",
    "slay the spire ii": "https://cdn.discordapp.com/app-icons/1479192099734945802/5277873557e53f1f3e79122396160533.png",
    "league of legends": "https://cdn.discordapp.com/app-icons/101538960410427392/9525c52c0f2095c55a5078563c6d7a54.png",
    "overwatch 2": "https://cdn.discordapp.com/app-icons/356860322762162176/67406a6c253457a3e7e8b6f3796f7c81.png",
    "minecraft": "https://cdn.discordapp.com/app-icons/357186981195612161/96f6e520f92b77a79e49195b058f509a.png"
};

// 헬퍼: 현재 유저가 포함된 세션 찾기
function findSessionByUserId(userId) {
    for (const session of activeSessions.values()) {
        if (session.participants.has(userId)) return session;
    }
    return null;
}

function formatDuration(minutes) {
    if (minutes < 60) return `${minutes}분`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

function stopGameTracking(session, userId, gameName) {
    if (session.gameLogs[gameName] && session.gameLogs[gameName].activeStartTime[userId]) {
        const startTime = session.gameLogs[gameName].activeStartTime[userId];
        const duration = Date.now() - startTime;
        session.gameLogs[gameName].totalPlayTime += duration;
        if (!session.gameLogs[gameName].playerPlayTimes) session.gameLogs[gameName].playerPlayTimes = {};
        session.gameLogs[gameName].playerPlayTimes[userId] = (session.gameLogs[gameName].playerPlayTimes[userId] || 0) + duration;
        session.gameLogs[gameName].activeStartTime[userId] = null;
        console.log(`🎮 [기록 종료] ${gameName} (유저ID: ${userId})`);
    }
}

async function updateGameLog(session, userId, activity) {
    if (!activity || activity.type !== 0) return;

    const originalName = activity.name;
    const gameNameKey = originalName.trim().toLowerCase();
    let iconURL = null;

    // 1. 수동 매칭
    if (MANUAL_GAME_MAP[gameNameKey]) {
        iconURL = MANUAL_GAME_MAP[gameNameKey];
        console.log(`✨ [Icon Success] 수동 매칭 적용: ${originalName}`);
    }

    // 2. 리치 프레젠스 에셋
    if (!iconURL && activity.assets) {
        iconURL = activity.assets.largeImageURL({ format: 'png', size: 512 });
        if (iconURL) console.log(`✨ [Icon Success] 리치 프레젠스 이미지 획득`);
    }

    // 3. API 직접 호출 (가장 안정적인 방식)
    if (!iconURL && activity.applicationId) {
        try {
            // Routes 함수 대신 직접 엔드포인트 경로 사용 (버전 충돌 방지)
            const app = await client.rest.get(`/applications/${activity.applicationId}`);
            if (app && app.icon) {
                iconURL = `https://cdn.discordapp.com/app-icons/${activity.applicationId}/${app.icon}.png?size=512`;
                console.log(`✨ [Icon Success] 디스코드 서버에서 아이콘 획득 완료`);
            }
        } catch (e) {
            console.log(`❌ [Icon Error] API 조회 실패: ${e.message}`);
        }
    }

    if (!session.gameLogs[originalName]) {
        session.gameLogs[originalName] = { 
            totalPlayTime: 0, playerPlayTimes: {}, players: new Set(), activeStartTime: {}, iconURL: iconURL, comments: [] 
        };
    } else if (iconURL && !session.gameLogs[originalName].iconURL) {
        session.gameLogs[originalName].iconURL = iconURL;
    }

    if (!session.gameLogs[originalName].activeStartTime[userId]) {
        session.gameLogs[originalName].activeStartTime[userId] = Date.now();
        session.gameLogs[originalName].players.add(userId);
        console.log(`✅ [기록 시작] ${originalName} (시작 시간 저장됨)`);
    }
}

client.once('ready', async () => {
    console.log('--------------------------------------');
    console.log('🤖 Game Diary 봇 온라인! 아이콘 수집 엔진 가동');
    console.log('--------------------------------------');

    for (const guild of client.guilds.cache.values()) {
        for (const voiceState of guild.voiceStates.cache.values()) {
            if (!voiceState.member || voiceState.member.user.bot || !voiceState.channelId) continue;
            const channelId = voiceState.channelId;
            if (!activeSessions.has(channelId)) {
                activeSessions.set(channelId, {
                    channelName: voiceState.channel.name, sessionTitle: "오늘의 게임일기", startTime: Date.now(),
                    participants: new Set(), displayNames: new Map(), profileImages: new Map(),
                    gameLogs: {}, pendingScreenshots: [], controlMessage: null 
                });
            }
            const s = activeSessions.get(channelId);
            const userId = voiceState.member.user.id;
            s.participants.add(userId);
            s.displayNames.set(userId, voiceState.member.displayName);
            s.profileImages.set(userId, voiceState.member.user.displayAvatarURL({ format: 'png', size: 256 }));
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
                gameLogs: {}, pendingScreenshots: [], controlMessage: null 
            };
            activeSessions.set(channelId, session);
            const logChannel = newState.guild.channels.cache.find(c => c.name === '일기장');
            if (logChannel) {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('btn_edit_title').setLabel('일기 제목 수정').setStyle(ButtonStyle.Primary).setEmoji('✏️'),
                    new ButtonBuilder().setCustomId('btn_write_review').setLabel('게임 한줄평 작성').setStyle(ButtonStyle.Success).setEmoji('📝')
                );
                const msg = await logChannel.send({ content: `🎮 **오늘의 게임일기 작성을 시작합니다!**\n현재 제목: **${session.sessionTitle}**`, components: [row] });
                try { await msg.pin(); session.controlMessage = msg; } catch (e) {}
            }
        }
        const session = activeSessions.get(channelId);
        session.participants.add(userId);
        session.displayNames.set(userId, member.displayName);
        session.profileImages.set(userId, member.user.displayAvatarURL({ format: 'png', size: 256 }));
        const activity = member.presence?.activities.find(a => a.type === 0);
        if (activity) await updateGameLog(session, userId, activity);
    }

    if (oldState.channel && oldState.channel.id !== newState.channel?.id) {
        const session = activeSessions.get(oldState.channel.id);
        if (session) {
            for (const gameName of Object.keys(session.gameLogs)) stopGameTracking(session, userId, gameName);
            const remainingHumans = oldState.channel.members.filter(m => !m.user.bot).size;
            if (remainingHumans === 0) {
                const endTime = Date.now();
                for (const [name, data] of Object.entries(session.gameLogs)) {
                    for (const [pId, start] of Object.entries(data.activeStartTime)) if (start) stopGameTracking(session, pId, name);
                }
                const diaryData = {
                    guildName: oldState.guild.name, guildIcon: oldState.guild.iconURL({ format: 'png', size: 512 }),
                    channelName: session.channelName, sessionTitle: session.sessionTitle,
                    startTime: admin.firestore.Timestamp.fromMillis(session.startTime), endTime: admin.firestore.Timestamp.fromMillis(endTime),
                    totalDurationMin: Math.floor((endTime - session.startTime) / 1000 / 60),
                    participants: Array.from(session.participants), displayNames: Object.fromEntries(session.displayNames), profileImages: Object.fromEntries(session.profileImages),
                    games: Object.entries(session.gameLogs).map(([name, data]) => ({
                        title: name, playTimeMin: Math.floor(data.totalPlayTime / 1000 / 60),
                        playerPlayTimes: Object.fromEntries(Object.entries(data.playerPlayTimes || {}).map(([id, ms]) => [id, Math.floor(ms / 1000 / 60)])),
                        players: Array.from(data.players), iconURL: data.iconURL, comments: data.comments || [] 
                    })),
                    screenshots: session.pendingScreenshots 
                };
                try {
                    const docRef = await db.collection('sessions').add(diaryData);
                    if (session.controlMessage) { try { await session.controlMessage.unpin(); } catch(e){} await session.controlMessage.edit({ content: `✅ **오늘의 게임일기 기록이 완료되었습니다!**`, components: [] }).catch(() => {}); }
                    const logChannel = oldState.guild.channels.cache.find(c => c.name === '일기장');
                    if (logChannel) {
                        const webURL = `https://game-diary-2.vercel.app?id=${docRef.id}`;
                        const embed = new EmbedBuilder().setColor(0x1A1D1F).setTitle(`📖 [${session.sessionTitle}] 일기 발행!`).addFields({ name: '⏱️ 총 시간', value: formatDuration(diaryData.totalDurationMin), inline: true }).setTimestamp();
                        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('일기 확인').setStyle(ButtonStyle.Link).setURL(webURL), new ButtonBuilder().setCustomId(`delete_session_${docRef.id}`).setLabel('삭제').setStyle(ButtonStyle.Danger));
                        await logChannel.send({ embeds: [embed], components: [row] });
                    }
                } catch (e) {}
                activeSessions.delete(oldState.channel.id);
            }
        }
    }
});

client.on('interactionCreate', async (i) => {
    const channelId = i.member?.voice?.channelId;
    const session = activeSessions.get(channelId);
    if (i.isButton()) {
        if (i.customId.startsWith('delete_session_')) {
            try { await db.collection('sessions').doc(i.customId.replace('delete_session_', '')).delete(); await i.reply({ content: '삭제됨.', flags: [MessageFlags.Ephemeral] }); await i.message.delete().catch(() => {}); } catch (e) {}
            return;
        }
        if (!session) return i.reply({ content: "❌ 현재 채널에 있어야만 버튼 작동이 가능합니다.", flags: [MessageFlags.Ephemeral] });
        if (i.customId === 'btn_edit_title') {
            const m = new ModalBuilder().setCustomId('modal_edit_title').setTitle('제목 설정');
            m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('input_title').setLabel("제목").setStyle(TextInputStyle.Short).setRequired(true)));
            await i.showModal(m);
        } else if (i.customId === 'btn_write_review') {
            const g = Object.keys(session.gameLogs);
            if (g.length === 0) return i.reply({ content: "❌ 아직 기록된 게임이 없습니다.", flags: [MessageFlags.Ephemeral] });
            await i.reply({ content: '작성할 게임을 선택하세요.', components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('select_game_for_review').addOptions(g.map(name => ({ label: name, value: name }))))], flags: [MessageFlags.Ephemeral] });
        }
    }
    if (i.isModalSubmit() && session) {
        if (i.customId === 'modal_edit_title') { session.sessionTitle = i.fields.getTextInputValue('input_title'); if (session.controlMessage) await session.controlMessage.edit({ content: `🎮 **오늘의 게임일기**\n현재 제목: **${session.sessionTitle}**` }); await i.reply({ content: `변경됨.`, flags: [MessageFlags.Ephemeral] }); }
        else if (i.customId.startsWith('modal_review_')) { const name = i.customId.replace('modal_review_', ''); if (session.gameLogs[name]) { session.gameLogs[name].comments.push({ userId: i.user.id, user: i.user.username, text: i.fields.getTextInputValue('input_review_text') }); await i.reply({ content: `기록됨!`, flags: [MessageFlags.Ephemeral] }); } }
    }
    if (i.isStringSelectMenu() && i.customId === 'select_game_for_review') {
        const m = new ModalBuilder().setCustomId(`modal_review_${i.values[0]}`).setTitle(`${i.values[0]} 한줄평`);
        m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('input_review_text').setLabel("소감").setStyle(TextInputStyle.Paragraph).setRequired(true)));
        await i.showModal(m);
    }
});

client.on('messageCreate', async (m) => {
    if (m.author.bot) return;
    const s = activeSessions.get(m.member?.voice?.channelId);
    if (!s || m.attachments.size === 0) return;
    for (const a of m.attachments.values()) {
        if (a.contentType?.startsWith('image/')) {
            try {
                const f = bucket.file(`screenshots/${Date.now()}_${a.name}`);
                await f.save(Buffer.from(await (await fetch(a.url)).arrayBuffer()), { contentType: a.contentType });
                await f.makePublic();
                s.pendingScreenshots.push({ url: f.publicUrl(), user: m.member.displayName, comment: m.content || "", gameTitle: "미지정" });
                m.react('✅');
            } catch (e) {}
        }
    }
});

client.on('presenceUpdate', async (o, n) => {
    if (!n.member || n.user.bot) return;
    const s = findSessionByUserId(n.userId);
    if (!s) return;
    const oldG = o?.activities.find(a => a.type === 0);
    const newG = n.activities.find(a => a.type === 0);
    if (oldG && (!newG || oldG.name !== newG.name)) stopGameTracking(s, n.userId, oldG.name);
    if (newG) await updateGameLog(s, n.userId, newG);
});

client.login(process.env.DISCORD_TOKEN);