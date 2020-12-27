const { Client } = require("discord-rpc");
const mqttjs = require('mqtt');
const { mqtt, discord, settings } = require("./env.json");
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
      remainingMins: msg[1] == 0 ? 1 : msg[1],
      title: msg[2],
      season: msg[3],
      episode: msg[4],
      folder: msg[5],
    };
    if (parsedPayload.state === "stopped" || settings.excluded.includes(parsedPayload.folder)) {
      this.discordClient.clearActivity();
      return;
    }
    const details = parsedPayload.folder === "Movies" ?
      parsedPayload.title :
      `${parsedPayload.title.substring(0, parsedPayload.title.indexOf('-')).trim()} S${parsedPayload.season}E${parsedPayload.episode}`;
    const endTimestamp = moment().add({ minutes: parsedPayload.remainingMins }).valueOf();
    this.setDiscordPresence({ state: parsedPayload.state, details, endTimestamp });
  }

  setDiscordPresence = ({ state, details, endTimestamp }) => {
    let activity = {
      state: state.charAt(0).toUpperCase() + state.slice(1),
      details,
      largeImageKey: 'plex_512',
      smallImageKey: `${state === "playing" ? 'play' : 'pause'}_512`,
      instance: true,
    };
    if (state === "playing") {
      activity = { ...activity, endTimestamp: Math.round(endTimestamp) };
    } else {
      activity = { ...activity, startTimestamp: Math.round(moment().valueOf()) };
    }
    this.activityPid = this.discordClient.setActivity(activity);
  }

  start = () => {
    this.discordClient = new Client({ transport: 'ipc' });
    this.mqttClient = mqttjs.connect(mqtt.host, { username: mqtt.username, password: mqtt.password });
    this.mqttClient.on("connect", () => this.mqttClient.subscribe("discord"));
    this.mqttClient.on("message", this.parseMessage);
    this.discordClient.login({ clientId: discord.clientId });
  }
}

new DiscordRichPresence().start();

