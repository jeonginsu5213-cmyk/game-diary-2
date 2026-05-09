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
        
        session.gameLogs[gameName].totalPlayTime += duration;
        
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

// 헬퍼 함수: 게임 로그 업데이트 (시작)
async function updateGameLog(session, userId, activity) {
    if (activity && activity.type === 0) {
        const gameName = activity.name;
        let iconURL = activity.assets ? activity.assets.largeImageURL({ format: 'png', size: 512 }) : null;

        // 🌟 공식 앱 아이콘 수집 보강
        if (!iconURL && activity.applicationId) {
            try {
                const app = await client.applications.fetch(activity.applicationId);
                if (app && app.icon) {
                    iconURL = `https://cdn.discordapp.com/app-icons/${activity.applicationId}/${app.icon}.png?size=512`;
                }
            } catch (e) {
                console.error(`아이콘 가져오기 실패 (${gameName}):`, e.message);
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

client.on('voiceStateUpdate', async (oldState, newState) => {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    const userId = member.user.id;
    const nickname = member.displayName;
    const avatarURL = member.user.displayAvatarURL({ format: 'png', size: 256 });
    
    const oldChannel = oldState.channel;
    const newChannel = newState.channel;

    if (newChannel) {
        const channelId = newChannel.id;
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
                    new ButtonBuilder().setCustomId('btn_edit_title').setLabel('일기 제목 수정').setStyle(ButtonStyle.Primary).setEmoji('✏️'),
                    new ButtonBuilder().setCustomId('btn_write_review').setLabel('게임 한줄평 작성').setStyle(ButtonStyle.Success).setEmoji('📝')
                );
                const msg = await logChannel.send({
                    content: `🎮 **오늘의 게임일기 작성을 시작합니다!**\n현재 제목: **${session.sessionTitle}**`,
                    components: [row]
                });
                try { await msg.pin(); session.controlMessage = msg; } catch (e) {}
            }
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

    if (oldChannel && oldChannel.id !== newChannel?.id) {
        const channelId = oldChannel.id;
        if (activeSessions.has(channelId)) {
            const session = activeSessions.get(channelId);
            for (const gameName of Object.keys(session.gameLogs)) {
                stopGameTracking(session, userId, gameName);
            }

            const remainingHumans = oldChannel.members.filter(m => !m.user.bot).size;
            if (remainingHumans === 0) {
                const endTime = Date.now();
                for (const [gameName, data] of Object.entries(session.gameLogs)) {
                    for (const [pId, startTime] of Object.entries(data.activeStartTime)) {
                        if (startTime) stopGameTracking(session, pId, gameName);
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
                        playerPlayTimes: Object.fromEntries(Object.entries(data.playerPlayTimes || {}).map(([id, ms]) => [id, Math.floor(ms / 1000 / 60)])),
                        players: Array.from(data.players),
                        iconURL: data.iconURL,
                        comments: data.comments || [] 
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
                        const embed = new EmbedBuilder()
                            .setColor(0x1A1D1F)
                            .setTitle(`📖 [${session.sessionTitle}] 일기가 발행되었습니다!`)
                            .setDescription(`오늘의 추억이 성공적으로 기록되었습니다. 아래 버튼을 눌러 일기장에서 확인해보세요!`)
                            .addFields(
                                { name: '🎮 플레이한 게임', value: Object.keys(session.gameLogs).join(', ') || '대화', inline: true },
                                { name: '⏱️ 총 시간', value: formatDuration(diaryData.totalDurationMin), inline: true },
                                { name: '👥 참여 인원', value: `${session.participants.size}명`, inline: true }
                            )
                            .setTimestamp();
                        const row = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setLabel('웹에서 일기 확인하기').setStyle(ButtonStyle.Link).setURL(webURL),
                            new ButtonBuilder().setCustomId(`delete_session_${docRef.id}`).setLabel('기록 삭제').setStyle(ButtonStyle.Danger)
                        );
                        await logChannel.send({ embeds: [embed], components: [row] });
                    }
                } catch (e) { console.error('❌ 저장 실패:', e); }
                activeSessions.delete(channelId);
            }
        }
    }
});

client.on('interactionCreate', async (interaction) => {
    const channelId = interaction.member?.voice?.channelId;
    const session = activeSessions.get(channelId);

    if (interaction.isButton()) {
        if (interaction.customId.startsWith('delete_session_')) {
            const sessionId = interaction.customId.replace('delete_session_', '');
            try {
                await db.collection('sessions').doc(sessionId).delete();
                await interaction.reply({ content: '✅ 일기 기록이 삭제되었습니다.', ephemeral: true });
                await interaction.message.delete().catch(() => {});
            } catch (e) { await interaction.reply({ content: '❌ 삭제에 실패했습니다.', ephemeral: true }); }
            return;
        }
        
        if (!session) return interaction.reply({ content: "❌ 현재 음성 채널에 참여 중인 상태에서만 버튼을 사용할 수 있습니다.", ephemeral: true });

        if (interaction.customId === 'btn_edit_title') {
            const modal = new ModalBuilder().setCustomId('modal_edit_title').setTitle('일기 제목 설정');
            const titleInput = new TextInputBuilder().setCustomId('input_title').setLabel("오늘의 일기 제목을 입력해 주세요").setStyle(TextInputStyle.Short).setPlaceholder('예: 새벽 발헤임 대탐험').setMaxLength(50).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(titleInput));
            await interaction.showModal(modal);
        }
        else if (interaction.customId === 'btn_write_review') {
            const games = Object.keys(session.gameLogs);
            if (games.length === 0) return interaction.reply({ content: "❌ 아직 기록된 게임이 없습니다!", ephemeral: true });
            const selectMenu = new StringSelectMenuBuilder().setCustomId('select_game_for_review').setPlaceholder('한줄평을 남길 게임을 선택하세요').addOptions(games.map(game => ({ label: game, value: game })));
            await interaction.reply({ content: '📝 **어떤 게임의 한줄평을 작성할까요?**', components: [new ActionRowBuilder().addComponents(selectMenu)], ephemeral: true });
        }
    }

    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'modal_edit_title' && session) {
            const newTitle = interaction.fields.getTextInputValue('input_title');
            session.sessionTitle = newTitle;
            if (session.controlMessage) await session.controlMessage.edit({ content: `🎮 **오늘의 게임일기 작성을 시작합니다!**\n현재 제목: **${newTitle}**` }).catch(() => {});
            await interaction.reply({ content: `✅ 일기 제목이 **"${newTitle}"**(으)로 변경되었습니다.`, ephemeral: true });
        } 
        else if (interaction.customId.startsWith('modal_review_') && session) {
            const gameName = interaction.customId.replace('modal_review_', '');
            const reviewText = interaction.fields.getTextInputValue('input_review_text');
            if (session.gameLogs[gameName]) {
                session.gameLogs[gameName].comments.push({ userId: interaction.user.id, user: interaction.user.username, text: reviewText });
                await interaction.reply({ content: `✅ **${gameName}**에 대한 한줄평이 기록되었습니다!`, ephemeral: true });
            }
        }
    }

    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'select_game_for_review') {
            const selectedGame = interaction.values[0];
            const modal = new ModalBuilder().setCustomId(`modal_review_${selectedGame}`).setTitle(`${selectedGame} 한줄평 작성`);
            const reviewInput = new TextInputBuilder().setCustomId('input_review_text').setLabel("이 게임은 어떠셨나요?").setStyle(TextInputStyle.Paragraph).setPlaceholder('오늘 플레이한 소감을 짧게 남겨주세요!').setMaxLength(200).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(reviewInput));
            await interaction.showModal(modal);
        }
    }
});

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
                    session.pendingScreenshots.push({ url: file.publicUrl(), user: uploaderNickname, comment: comment, gameTitle: "미지정" });
                    uploadedIndices.push(session.pendingScreenshots.length - 1);
                    message.react('✅');
                } catch (error) { console.error('❌ 사진 업로드 오류:', error); }
            }
        }

        const games = Object.keys(session.gameLogs);
        if (games.length > 0 && uploadedIndices.length > 0) {
            const selectMenu = new StringSelectMenuBuilder().setCustomId(`select_game_${Date.now()}`).setPlaceholder('이 사진들은 어떤 게임인가요?').addOptions(games.map(game => ({ label: game, value: game })));
            const response = await message.reply({ content: '📸 **스크린샷 분류**: 게임을 선택해 주세요!', components: [new ActionRowBuilder().addComponents(selectMenu)] });
            const collector = response.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 60000 });
            collector.on('collect', async (i) => {
                if (i.user.id !== message.author.id) return i.reply({ content: '직접 올린 사진만 분류할 수 있어요!', ephemeral: true });
                const selectedGame = i.values[0];
                uploadedIndices.forEach(idx => { if (session.pendingScreenshots[idx]) session.pendingScreenshots[idx].gameTitle = selectedGame; });
                await i.update({ content: `✅ 사진이 **${selectedGame}**으로 분류되었습니다!`, components: [] });
            });
        }
    }
});

client.on('presenceUpdate', async (oldPresence, newPresence) => {
    if (!newPresence || newPresence.user.bot) return;
    const member = newPresence.member;
    const channelId = member?.voice?.channelId;
    if (!channelId || !activeSessions.has(channelId)) return;
    
    const session = activeSessions.get(channelId);
    const userId = member.user.id;
    const oldGame = oldPresence?.activities.find(a => a.type === 0);
    const newGame = newPresence.activities.find(a => a.type === 0);

    if (oldGame && (!newGame || oldGame.name !== newGame.name)) stopGameTracking(session, userId, oldGame.name);
    if (newGame) await updateGameLog(session, userId, newGame);
});

client.login(process.env.DISCORD_TOKEN);