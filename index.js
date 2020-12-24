const { Client } = require("discord-rpc");
const PlexAPI = require("plex-api");
const { plex, discord } = require("./env.json");
const moment = require("moment");

class DiscordRichPresence {

  plexClient = null;
  discordClient = null;

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
    this.activityPid = this.discordClient.setActivity({
      state: state.charAt(0).toUpperCase() + state.slice(1),
      details,
      endTimestamp: Math.round(endTimestamp),
      largeImageKey: 'plex_512',
      smallImageKey: `${state === "playing" ? 'play' : 'pause'}_512`,
      instance: true,
    });
  }

  start = () => {
    this.discordClient.on('ready', () => {
      setInterval(this.checkActivity, 10000);
    });

    this.discordClient.login({ clientId: discord.clientId });
  }
}

new DiscordRichPresence().start();

