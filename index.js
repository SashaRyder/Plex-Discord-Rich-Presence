const { Client } = require("discord-rpc");
const PlexAPI = require("plex-api");
const { plex, discord } = require("./env.json");
const moment = require("moment");

class DiscordRichPresence {

  plexClient = null;
  discordClient = null;
  pausedSince = null;
  oldState = "";

  constructor() {
    this.discordClient = new Client({ transport: 'ipc' });
    this.plexClient = new PlexAPI({ hostname: plex.host, port: 443, https: true, username: plex.username, password: plex.password });
  }
  checkActivity = async () => {
    const metadata = (await this.plexClient.query("/status/sessions")).MediaContainer.Metadata;
    if (metadata && metadata.length > 0) {
      const myMetadata = metadata.find((data) => data.User.title === plex.username);
      if (myMetadata) {
        if (myMetadata.librarySectionTitle === "TV Shows") {
          const series = myMetadata.grandparentTitle;
          const seasonNum = myMetadata.parentIndex.padStart("2", "0");
          const episodeNum = myMetadata.index.padStart("2", "0");;
          this.setDiscordPresence({
            details: `${series} - S${seasonNum}E${episodeNum}`,
            state: myMetadata.Player.state,
            endTimestamp: moment().add({ milliseconds: myMetadata.duration - myMetadata.viewOffset }).valueOf()
          });
        }
        else {
          this.setDiscordPresence({
            details: `${myMetadata.title} (${myMetadata.year})`,
            state: myMetadata.Player.state,
            endTimestamp: moment().add({ milliseconds: myMetadata.duration - myMetadata.viewOffset }).valueOf()
          });
        }
      }
      else {
        this.discordClient.clearActivity();
      }
    }
    else {
      this.discordClient.clearActivity();
    }
  }

  setDiscordPresence = ({ state, details, endTimestamp }) => {
    if(!this.pausedSince) {
      this.pausedSince = moment().valueOf();
    }
    if(state === this.oldState) {
      return;
    }
    this.oldState = state;
    let activity = {
      state: state.charAt(0).toUpperCase() + state.slice(1),
      details,
      largeImageKey: 'plex_512',
      smallImageKey: `${state === "playing" ? 'play' : 'pause'}_512`,
      instance: true,
    };
    if(state === "playing") {
      activity = { ...activity, endTimestamp: Math.round(endTimestamp) };
      this.pausedSince = null;
    } else {
      activity = { ...activity, startTimestamp: Math.round(this.pausedSince) };
    }
    this.activityPid = this.discordClient.setActivity(activity);
  }

  start = () => {
    this.discordClient.on('ready', () => this.checkActivity().then(() => setInterval(this.checkActivity, 5000)));
    this.discordClient.login({ clientId: discord.clientId });
  }
}

new DiscordRichPresence().start();

