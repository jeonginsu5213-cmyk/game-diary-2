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
    Routes,
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

// 🌟 [수동 게임 매칭 리스트] 아이콘이 잘 안 나오는 게임들을 위해 URL 직접 등록
const MANUAL_GAME_MAP = {
    "Valheim": "https://cdn.discordapp.com/app-icons/1124358970618953818/93ac3b8489a031b721995a99102c73f1.png",
    "League of Legends": "https://cdn.discordapp.com/app-icons/101538960410427392/9525c52c0f2095c55a5078563c6d7a54.png",
    "Overwatch 2": "https://cdn.discordapp.com/app-icons/356860322762162176/67406a6c253457a3e7e8b6f3796f7c81.png",
    "Minecraft": "https://cdn.discordapp.com/app-icons/357186981195612161/96f6e520f92b77a79e49195b058f509a.png",
    "PUBG: BATTLEGROUNDS": "https://cdn.discordapp.com/app-icons/533343206016581632/66f6c888d3e6d299446d3f234383c480.png"
};

// 헬퍼 함수: 시간 포맷팅
function formatDuration(minutes) {
    if (minutes < 60) return `${minutes}분`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

// 헬퍼 함수: 게임 추적 중지
function stopGameTracking(session, userId, gameName) {
    if (session.gameLogs[gameName] && session.gameLogs[gameName].activeStartTime[userId]) {
        const startTime = session.gameLogs[gameName].activeStartTime[userId];
        const duration = Date.now() - startTime;
        session.gameLogs[gameName].totalPlayTime += duration;
        if (!session.gameLogs[gameName].playerPlayTimes) session.gameLogs[gameName].playerPlayTimes = {};
        if (!session.gameLogs[gameName].playerPlayTimes[userId]) session.gameLogs[gameName].playerPlayTimes[userId] = 0;
        session.gameLogs[gameName].playerPlayTimes[userId] += duration;
        session.gameLogs[gameName].activeStartTime[userId] = null;
        console.log(`🎮 [Game Tracking] 유저(${userId})가 ${gameName} 플레이 종료 (${Math.floor(duration/1000)}초)`);
    }
}

// 헬퍼 함수: 게임 로그 업데이트
async function updateGameLog(session, userId, activity) {
    if (activity && activity.type === 0) {
        const gameName = activity.name.trim(); // 공백 제거
        let iconURL = null;

        // 1. 우선순위: 수동 매칭 리스트
        if (MANUAL_GAME_MAP[gameName]) {
            iconURL = MANUAL_GAME_MAP[gameName];
            console.log(`🖼️ [Icon Success] ${gameName} 수동 매칭 적용 완료!`);
        }

        // 2. 차선순위: 리치 프레젠스 에셋
        if (!iconURL && activity.assets) {
            iconURL = activity.assets.largeImageURL({ format: 'png', size: 512 });
        }

        // 3. 마지막 수단: API 조회
        if (!iconURL && activity.applicationId) {
            try {
                const app = await client.rest.get(Routes.application(activity.applicationId));
                if (app && app.icon) {
                    iconURL = `https://cdn.discordapp.com/app-icons/${activity.applicationId}/${app.icon}.png?size=512`;
                }
            } catch (e) {}
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
            session.gameLogs[gameName].iconURL = iconURL;
        }

        if (!session.gameLogs[gameName].activeStartTime[userId]) {
            session.gameLogs[gameName].activeStartTime[userId] = Date.now();
            session.gameLogs[gameName].players.add(userId);
            console.log(`🎮 [Game Tracking] ${gameName} 기록 시작`);
        }
    }
}

client.once('ready', async () => {
    console.log('--------------------------------------');
    console.log('🤖 [Game Diary] 시스템이 성공적으로 재시작되었습니다.');
    console.log('--------------------------------------');

    for (const guild of client.guilds.cache.values()) {
        for (const voiceState of guild.voiceStates.cache.values()) {
            if (!voiceState.member || voiceState.member.user.bot || !voiceState.channelId) continue;
            const session = activeSessions.get(voiceState.channelId);
            if (!session) {
                activeSessions.set(voiceState.channelId, {
                    channelName: voiceState.channel.name, sessionTitle: "오늘의 게임일기", startTime: Date.now(),
                    participants: new Set(), displayNames: new Map(), profileImages: new Map(),
                    gameLogs: {}, pendingScreenshots: [], controlMessage: null 
                });
            }
            const s = activeSessions.get(voiceState.channelId);
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
    const nickname = member.displayName;
    const avatarURL = member.user.displayAvatarURL({ format: 'png', size: 256 });
    
    if (newState.channel) {
        const channelId = newState.channel.id;
        if (!activeSessions.has(channelId)) {
            const session = {
                channelName: newState.channel.name, sessionTitle: "오늘의 게임일기", startTime: Date.now(),
                participants: new Set([userId]), displayNames: new Map([[userId, nickname]]), profileImages: new Map([[userId, avatarURL]]),
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
        session.displayNames.set(userId, nickname);
        session.profileImages.set(userId, avatarURL);

        const activity = member.presence?.activities.find(a => a.type === 0);
        if (activity) await updateGameLog(session, userId, activity);
    }

    if (oldState.channel && oldState.channel.id !== newState.channel?.id) {
        const session = activeSessions.get(oldState.channel.id);
        if (session) {
            for (const gameName of Object.keys(session.gameLogs)) stopGameTracking(session, userId, gameName);
            if (oldState.channel.members.filter(m => !m.user.bot).size === 0) {
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
                    if (session.controlMessage) {
                        await session.controlMessage.unpin().catch(() => {});
                        await session.controlMessage.edit({ content: `✅ **오늘의 게임일기 기록이 완료되었습니다!**\n최종 제목: **${session.sessionTitle}**`, components: [] }).catch(() => {});
                    }
                    const logChannel = oldState.guild.channels.cache.find(c => c.name === '일기장');
                    if (logChannel) {
                        const webURL = `https://game-diary-2.vercel.app?id=${docRef.id}`;
                        const embed = new EmbedBuilder().setColor(0x1A1D1F).setTitle(`📖 [${session.sessionTitle}] 일기가 발행되었습니다!`)
                            .setDescription(`오늘의 추억이 성공적으로 기록되었습니다. 아래 버튼을 눌러 일기장에서 확인해보세요!`)
                            .addFields({ name: '🎮 플레이한 게임', value: Object.keys(session.gameLogs).join(', ') || '대화', inline: true }, { name: '⏱️ 총 시간', value: formatDuration(diaryData.totalDurationMin), inline: true }, { name: '👥 참여 인원', value: `${session.participants.size}명`, inline: true })
                            .setTimestamp();
                        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('웹에서 일기 확인하기').setStyle(ButtonStyle.Link).setURL(webURL), new ButtonBuilder().setCustomId(`delete_session_${docRef.id}`).setLabel('기록 삭제').setStyle(ButtonStyle.Danger));
                        await logChannel.send({ embeds: [embed], components: [row] });
                    }
                } catch (e) { console.error('❌ 저장 실패:', e); }
                activeSessions.delete(oldState.channel.id);
            }
        }
    }
});

client.on('interactionCreate', async (interaction) => {
    const session = activeSessions.get(interaction.member?.voice?.channelId);
    if (interaction.isButton()) {
        if (interaction.customId.startsWith('delete_session_')) {
            try { await db.collection('sessions').doc(interaction.customId.replace('delete_session_', '')).delete(); await interaction.reply({ content: '✅ 일기 기록이 삭제되었습니다.', flags: [MessageFlags.Ephemeral] }); await interaction.message.delete().catch(() => {}); } catch (e) { await interaction.reply({ content: '❌ 삭제 실패.', flags: [MessageFlags.Ephemeral] }); }
            return;
        }
        if (!session) return interaction.reply({ content: "❌ 음성 채널 참여 중에만 가능합니다.", flags: [MessageFlags.Ephemeral] });
        if (interaction.customId === 'btn_edit_title') {
            const modal = new ModalBuilder().setCustomId('modal_edit_title').setTitle('일기 제목 설정');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('input_title').setLabel("일기 제목").setStyle(TextInputStyle.Short).setRequired(true)));
            await interaction.showModal(modal);
        } else if (interaction.customId === 'btn_write_review') {
            const games = Object.keys(session.gameLogs);
            if (games.length === 0) return interaction.reply({ content: "❌ 기록된 게임 없음.", flags: [MessageFlags.Ephemeral] });
            await interaction.reply({ content: '📝 **한줄평 작성할 게임 선택**', components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('select_game_for_review').addOptions(games.map(g => ({ label: g, value: g }))))], flags: [MessageFlags.Ephemeral] });
        }
    }
    if (interaction.isModalSubmit() && session) {
        if (interaction.customId === 'modal_edit_title') { session.sessionTitle = interaction.fields.getTextInputValue('input_title'); if (session.controlMessage) await session.controlMessage.edit({ content: `🎮 **오늘의 게임일기 작성을 시작합니다!**\n현재 제목: **${session.sessionTitle}**` }); await interaction.reply({ content: `✅ 제목 변경 완료.`, flags: [MessageFlags.Ephemeral] }); }
        else if (interaction.customId.startsWith('modal_review_')) { const gameName = interaction.customId.replace('modal_review_', ''); if (session.gameLogs[gameName]) { session.gameLogs[gameName].comments.push({ userId: interaction.user.id, user: interaction.user.username, text: interaction.fields.getTextInputValue('input_review_text') }); await interaction.reply({ content: `✅ 한줄평 기록 완료!`, flags: [MessageFlags.Ephemeral] }); } }
    }
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_game_for_review') {
        const modal = new ModalBuilder().setCustomId(`modal_review_${interaction.values[0]}`).setTitle(`${interaction.values[0]} 한줄평`);
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('input_review_text').setLabel("소감").setStyle(TextInputStyle.Paragraph).setRequired(true)));
        await interaction.showModal(modal);
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    const session = activeSessions.get(message.member?.voice?.channelId);
    if (!session || message.attachments.size === 0) return;
    for (const attachment of message.attachments.values()) {
        if (attachment.contentType?.startsWith('image/')) {
            try {
                const file = bucket.file(`screenshots/${Date.now()}_${attachment.name}`);
                const response = await fetch(attachment.url);
                await file.save(Buffer.from(await response.arrayBuffer()), { contentType: attachment.contentType });
                await file.makePublic();
                session.pendingScreenshots.push({ url: file.publicUrl(), user: message.member.displayName, comment: message.content || "", gameTitle: "미지정" });
                message.react('✅');
            } catch (e) {}
        }
    }
    const games = Object.keys(session.gameLogs);
    if (games.length > 0) {
        const response = await message.reply({ content: '📸 **스크린샷 분류**', components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`select_game_${Date.now()}`).setPlaceholder('게임 선택').addOptions(games.map(g => ({ label: g, value: g }))))] });
        const collector = response.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 60000 });
        collector.on('collect', async (i) => { if (i.user.id === message.author.id) { const selected = i.values[0]; session.pendingScreenshots.forEach(s => { if (s.gameTitle === "미지정") s.gameTitle = selected; }); await i.update({ content: `✅ 분류 완료!`, components: [] }); } });
    }
});

client.on('presenceUpdate', async (o, n) => {
    const session = activeSessions.get(n.member?.voice?.channelId);
    if (!session || n.user.bot) return;
    const userId = n.member.user.id;
    const oldG = o?.activities.find(a => a.type === 0);
    const newG = n.activities.find(a => a.type === 0);
    if (oldG && (!newG || oldG.name !== newG.name)) stopGameTracking(session, userId, oldG.name);
    if (newG) await updateGameLog(session, userId, newG);
});

client.login(process.env.DISCORD_TOKEN);