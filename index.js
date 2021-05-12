const { Client } = require("discord-rpc");
const mqttjs = require('mqtt');
const { mqtt, discord, plex, settings } = require("./env.json");
const { default: axios } = require("axios");
const moment = require("moment");


/**
 * Main class for Discord Rich Presence
 * @class
 * @public
 */
class DiscordRichPresence {

  parseMessage = (_, payload) => {
    const jsonPayload = JSON.parse(Buffer.from(payload).toString()).body;
    const msg = jsonPayload.split("||");
    const parsedPayload = {
      state: msg[0],
      title: msg[1],
      season: msg[2],
      episode: msg[3],
      folder: msg[4],
    };
    if (parsedPayload.state === "stopped" || settings.excluded.includes(parsedPayload.folder)) {
      this.discordClient.clearActivity();
      return;
    }
    const details = parsedPayload.folder === "Movies" ?
      parsedPayload.title :
      `${parsedPayload.title.substring(0, parsedPayload.title.indexOf('-')).trim()} S${parsedPayload.season}E${parsedPayload.episode}`;
    this.setDiscordPresence({ state: parsedPayload.state, details });
  }

  setDiscordPresence = async ({ state, details }) => {
    let activity = {
      state: state.charAt(0).toUpperCase() + state.slice(1),
      details,
      largeImageKey: 'plex_512',
      smallImageKey: `${state === "playing" ? 'play' : 'pause'}_512`,
      instance: true,
    };
    if (state === "playing") {
      const {data: sessions} = await axios.get(`${plex.host}/status/sessions?X-Plex-Token=${plex.key}`, {
        headers: {
          "Accept": "application/json, text/plain, */*"
        }
      });
      const userSession = sessions.MediaContainer.Metadata.find((session) => session.User.title === plex.username);
      const endTimeMilliseconds = userSession.duration - userSession.viewOffset;
      const endTimestamp = moment().add(endTimeMilliseconds, "milliseconds").subtract("1","second").valueOf();
      activity = { ...activity, endTimestamp };
    } else {
      activity = { ...activity, startTimestamp: Math.round(moment().valueOf()) };
    }
    this.activityPid = this.discordClient.setActivity(activity);
  }

  start = () => {
    this.discordClient = new Client({ transport: 'ipc' });
    this.mqttClient = mqttjs.connect(mqtt.host, { username: mqtt.username, password: mqtt.password });
    this.mqttClient.on("connect", () => this.mqttClient.subscribe("discord"));
    this.mqttClient.on("error", (e) => console.log(e.message));
    this.mqttClient.on("message", this.parseMessage);
    this.discordClient.login({ clientId: discord.clientId });
  }
}

new DiscordRichPresence().start();

