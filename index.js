const dotenv = require("dotenv");

const { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder, ActivityType  } = require("discord.js");
const { VoiceConnectionStatus, entersState  } = require('@discordjs/voice');
const { joinVoiceChannel, createAudioResource, NoSubscriberBehavior, StreamType, AudioPlayerStatus, createAudioPlayer } = require('@discordjs/voice');

const play = require('play-dl');

play.getFreeClientID().then((clientID) => {
    play.setToken({
      soundcloud: {
          client_id: process.env.SOUNDCLOUD_CLIENT_ID
      }
    })
})
// const YouTube = require('discord-youtube-api');
// const ytdl = require('ytdl-core');
// const ffmpeg = require('ffmpeg-static');
// const youtube = new YouTube('AIzaSyCmzBWi-pogHIb3SEdqixtaRIWKeAvKj4s');

const MAX_SEARCH = 8;
const emojiNumbers = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

dotenv.config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ]
})


client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);

    client.user.setPresence({
        activities: [{ name: `Commands ♨️`, type: ActivityType.Listening }],
      });
});

let player = createAudioPlayer({
    behaviors: {
        noSubscriber: NoSubscriberBehavior.Play
    }
})

let resource;
let searchInProgress = false;

client.on('messageCreate', async (message) => {
    if (message.content.startsWith('!play') || message.content.startsWith('!p')) {
        const voiceChannel = message.member?.voice.channel;
        if (!voiceChannel) {
            message.reply(`AYAYA: You (${message.member}) need to be in a voice channel to use this command 😠`);
            return;
        }

        if (searchInProgress) {
            message.reply(`AYAYA: A search is already in progress. Please wait for the current search to finish 💢💢`);
            return;
          }

        let args;
        if (message.content.startsWith('!play')) {
            args = message.content.split('!play')[1];
        } else {
            args = message.content.split('!p')[1];
        }

        if (args.includes('https://')) {
            let stream;
            try {
                stream = await play.stream(args);
            } catch {
                message.channel.send(`AYAYA: Did you make sure to send the full link? 💢💢`);
                return;
            }

            resource = createAudioResource(stream.stream, {
                inputType: stream.type,
            })
            message.channel.send(`AYAYA: Playing <${args.trim()}> 🔊`);

            sendConnection(voiceChannel, player, message);
        } else {
            let yt_info;

            try {
                yt_info = await play.search(args, { limit: MAX_SEARCH });
            } catch {
                message.channel.send(`AYAYA: Error getting youtube search. Try again 💢💢`);
                return;
            }

            const display = [];
            for (let i = 0; i < yt_info.length; i++){
                display.push({
                    name:`${emojiNumbers[i]} : ${ yt_info[i].title}`,
                    value: `${yt_info[i].views.toLocaleString()} views, ${yt_info[i].uploadedAt} [${yt_info[i].durationRaw}] `, 
                    link: yt_info[i].url
                });
            }

            let rollPic = Math.floor(Math.random() * 2) + 1;

            const file = new AttachmentBuilder(`./search-${rollPic}.png`);
            const fileTwo = new AttachmentBuilder('./dp.png');
            const embed = new EmbedBuilder()
                .setColor("#CD665D")
                .setAuthor({ name: 'AYAYA SEARCH', iconURL: 'attachment://dp.png' })
                .setTitle(`YT Results for '${args.trim()}'`)
                .setDescription("type a number to pick choice 🔢 \n type __!cancel__ / __!c__ to stop query")
                .setThumbnail(`attachment://search-${rollPic}.png`)
                .setFields([{
                    name: ' ',
                    value: '<>-<>-<>-<>-<>-<>-<>-<>-<>-<>-<>-<>-<>-<>-<>',
                    inline: true,
                }, ...display]);

            message.channel.send({ embeds: [embed], files: [file, fileTwo] }).then(sentMessage  => {
                const filter = m => {return ((1 <= m.content && m.content <= MAX_SEARCH) || m.content.startsWith('!c'))};
                searchInProgress = true;

                message.channel.awaitMessages({ filter, max: 1, time: 60_000, errors: ['time'] })
                    .then(async (mesg) => {
                        if (mesg.first().content.startsWith('!c')) {
                            message.channel.send(`AYAYA: Cancelled query 😭`);
                            return;
                        }

                        let url = mesg.first().content;

                        let stream;
                        try {
                            stream = await play.stream(yt_info[url - 1].url);
                        } catch {
                            message.channel.send(`AYAYA: An error has occured trying to play current audio 💢💢`);
                        }

                        resource = createAudioResource(stream.stream, {
                            inputType: stream.type,
                        })

                        message.channel.send(`AYAYA: Playing '${yt_info[url - 1].title}' **[${yt_info[url - 1].durationRaw}]** 🔊`);
                        sendConnection(voiceChannel, player, message)
                    })
                    .catch(err => {
                        message.channel.send(`AYAYA: Choice timed out 😭`);
                        console.error(err)
                    })
                    .finally(() => {
                        sentMessage.delete().catch(console.error);
                        searchInProgress = false;
                    })
            })
        }
    } else if (message.content.startsWith('!stop') || message.content.startsWith('!skip') || message.content.startsWith('!s')) {
        try {
            player.stop();
            message.reply('AYAYA: Stopped playing current audio 💦');
        } catch (error) {
            console.error(error);
            message.reply('AYAYA: Failed to stop playing audio 😭');
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
client.on('error', err => {
    console.error(err);
});

const sendConnection = async (voiceChannel, player, message) => {
    const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: voiceChannel.guild.id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    });

    try {
        player.play(resource);
        connection.subscribe(player);
    } catch (err) {
        message.reply(`AYAYA: An error has occured trying to play current audio 💢💢`);
    }

    connection.on(VoiceConnectionStatus.Disconnected, async (oldState, newState) => {
        try {
            await Promise.race([
                entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
            ]);
        } catch (error) {
            try {
                message.channel.send('AYAYA: Left the Voice Channel 😴');
                connection.destroy();
            } catch (err) {
                console.error(err)
            }
        }
    });
}