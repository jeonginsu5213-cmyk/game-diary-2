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

// 헬퍼 함수: 게임 로그 업데이트
function updateGameLog(session, username, activity) {
    if (activity && activity.type === 0) {
        const gameName = activity.name;
        let iconURL = activity.assets ? activity.assets.largeImageURL({ format: 'png', size: 512 }) : null;

        if (!session.gameLogs[gameName]) {
            session.gameLogs[gameName] = { 
                totalPlayTime: 0, 
                players: new Set(), 
                activeStartTime: {}, 
                iconURL: iconURL,
                comments: [] 
            };
        } else if (!session.gameLogs[gameName].iconURL && iconURL) {
            session.gameLogs[gameName].iconURL = iconURL;
        }

        if (!session.gameLogs[gameName].activeStartTime[username]) {
            session.gameLogs[gameName].activeStartTime[username] = Date.now();
            session.gameLogs[gameName].players.add(username);
        }
    }
}

client.once('ready', () => {
    console.log('--------------------------------------');
    console.log('🤖 [Game Diary] 일기 공유 및 한줄평 시스템 가동 중...');
    console.log('--------------------------------------');
});

// 🎤 음성 채널 세션 관리
client.on('voiceStateUpdate', async (oldState, newState) => {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    const username = member.user.username;
    const nickname = member.displayName;
    const avatarURL = member.user.displayAvatarURL({ format: 'png', size: 256 });
    
    const oldChannel = oldState.channel;
    const newChannel = newState.channel;

    if (!oldChannel && newChannel) {
        const channelId = newChannel.id;
        if (!activeSessions.has(channelId)) {
            const session = {
                channelName: newChannel.name,
                sessionTitle: "오늘의 게임일기",
                startTime: Date.now(),
                participants: new Set([username]),
                displayNames: new Map([[username, nickname]]),
                profileImages: new Map([[username, avatarURL]]),
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
        session.participants.add(username);
        session.displayNames.set(username, nickname);
        session.profileImages.set(username, avatarURL);

        const currentActivity = member.presence?.activities.find(a => a.type === 0);
        if (currentActivity) {
            updateGameLog(session, username, currentActivity);
        }
    } 
    else if (oldChannel && !newChannel) {
        const channelId = oldChannel.id;
        if (activeSessions.has(channelId)) {
            const remainingHumans = oldChannel.members.filter(m => !m.user.bot).size;
            if (remainingHumans === 0) {
                const session = activeSessions.get(channelId);
                const endTime = Date.now();
                
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
                        // 사용자님의 웹사이트 주소에 맞게 수정하세요.[cite: 4]
                        const webURL = `https://game-diary-2.vercel.app?id=${docRef.id}`;
                        const gameList = Object.keys(session.gameLogs).join(', ') || '대화';
                        
                        const embed = new EmbedBuilder()
                            .setColor(0x1A1D1F)
                            .setTitle(`📖 [${session.sessionTitle}] 일기가 발행되었습니다!`)
                            .setDescription(`오늘의 추억이 성공적으로 기록되었습니다. 아래 버튼을 눌러 일기장에서 확인해보세요!`)
                            .addFields(
                                { name: '🎮 플레이한 게임', value: gameList, inline: true },
                                { name: '⏱️ 총 시간', value: `${diaryData.totalDurationMin}분`, inline: true },
                                { name: '👥 참여 인원', value: `${session.participants.size}명`, inline: true }
                            )
                            .setTimestamp();

                        const row = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setLabel('웹에서 일기 확인하기')
                                .setStyle(ButtonStyle.Link)
                                .setURL(webURL)
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

// 🖱️ 상호작용 처리 (기존 유지)[cite: 4]
client.on('interactionCreate', async (interaction) => {
    const channelId = interaction.member?.voice?.channelId;
    const session = activeSessions.get(channelId);

    if (interaction.isButton()) {
        if (interaction.customId === 'btn_edit_title') {
            const modal = new ModalBuilder()
                .setCustomId('modal_edit_title')
                .setTitle('일기 제목 설정');

            const titleInput = new TextInputBuilder()
                .setCustomId('input_title')
                .setLabel("오늘의 일기 제목을 입력해 주세요")
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('예: 새벽 발헤임 대탐험')
                .setMaxLength(50)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(titleInput));
            await interaction.showModal(modal);
        }
        else if (interaction.customId === 'btn_write_review') {
            if (!session || Object.keys(session.gameLogs).length === 0) {
                return interaction.reply({ content: "❌ 아직 기록된 게임이 없습니다!", ephemeral: true });
            }

            const games = Object.keys(session.gameLogs);
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select_game_for_review')
                .setPlaceholder('한줄평을 남길 게임을 선택하세요')
                .addOptions(games.map(game => ({ label: game, value: game })));

            await interaction.reply({
                content: '📝 **어떤 게임의 한줄평을 작성할까요?**',
                components: [new ActionRowBuilder().addComponents(selectMenu)],
                ephemeral: true
            });
        }
        return; 
    }

    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'modal_edit_title') {
            const newTitle = interaction.fields.getTextInputValue('input_title');
            if (session) {
                session.sessionTitle = newTitle;
                if (session.controlMessage) {
                    await session.controlMessage.edit({
                        content: `🎮 **오늘의 게임일기 작성을 시작합니다!**\n현재 제목: **${newTitle}**`
                    }).catch(() => {});
                }
                await interaction.reply({ content: `✅ 일기 제목이 **"${newTitle}"**(으)로 변경되었습니다.`, ephemeral: true });
            }
        } 
        else if (interaction.customId.startsWith('modal_review_')) {
            const gameName = interaction.customId.replace('modal_review_', '');
            const reviewText = interaction.fields.getTextInputValue('input_review_text');

            if (session && session.gameLogs[gameName]) {
                session.gameLogs[gameName].comments.push({
                    user: interaction.user.username,
                    text: reviewText
                });
                await interaction.reply({ content: `✅ **${gameName}**에 대한 한줄평이 기록되었습니다!`, ephemeral: true });
            }
        }
        return; 
    }

    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'select_game_for_review') {
            const selectedGame = interaction.values[0];
            const modal = new ModalBuilder()
                .setCustomId(`modal_review_${selectedGame}`)
                .setTitle(`${selectedGame} 한줄평 작성`);

            const reviewInput = new TextInputBuilder()
                .setCustomId('input_review_text')
                .setLabel("이 게임은 어떠셨나요?")
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('오늘 플레이한 소감을 짧게 남겨주세요!')
                .setMaxLength(200)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(reviewInput));
            await interaction.showModal(modal);
        }
        return; 
    }
});

// 📸 메시지 감지 및 스크릿샷 분류 (기존 유지)[cite: 4]
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

// 🎮 실시간 게임 감지 (기존 유지)[cite: 4]
client.on('presenceUpdate', (oldPresence, newPresence) => {
    if (!newPresence || newPresence.user.bot) return;
    const member = newPresence.member;
    const channelId = member?.voice?.channelId;
    if (!channelId || !activeSessions.has(channelId)) return;
    const session = activeSessions.get(channelId);
    const activity = newPresence.activities.find(a => a.type === 0);
    if (activity) updateGameLog(session, member.user.username, activity);
});

client.login(process.env.DISCORD_TOKEN);