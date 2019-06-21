const Chat = require('twilio-chat');

export class TwilioClient {
  constructor() {
    this.status = 'disconnected';
    this.username = null;
    this.clientChat = null;
    this.channel = null;
    this.statusCallback = null;
    this.updateCallback = null;
  }

  async connect(username) {
    if (this.status === 'connected') return;

    try {
      this.setStatus('connecting', null);

      const response = await fetch('http://localhost:5000/token/' + username);
      const { token } = await response.json();

      this.chatClient = await Chat.Client.create(token);

      await this.chatClient.getSubscribedChannels();

      const channelName = 'whiteboard-poc';

      try {
        this.channel = await this.chatClient.getChannelByUniqueName(channelName);
      } catch (err) {
        this.channel = await this.chatClient.createChannel({
          uniqueName: channelName,
          friendlyName: 'Whiteboard Channel'
        });
      }

      const members = await this.channel.getMembers();

      if (!members.some(m => m.identity === username)) {
        await this.channel.join();
      }

      this.setStatus('connected', username);

      this.channel.on('messageAdded', message => {
        if (!this.updateCallback) return;

        const payload = JSON.parse(message.body);

        console.log('receiving message', payload);

        if (payload.sender !== this.username) {
          this.updateCallback(payload);
        }
      });
    } catch (err) {
      console.log('error connecting to Twilio', err);
      this.setStatus('error', null);
    }
  }

  async disconnect() {
    await this.chatClient.shutdown();
    this.setStatus('disconnected', null);
  }

  setStatus(status, username) {
    console.log('changing twilio status to:', status, username);
    this.status = status;
    this.username = username;
    if (this.statusCallback) {
      this.statusCallback(status, username);
    }
  }

  onStatusChanged(handler) {
    this.statusCallback = handler;
  }

  onUpdateReceived(handler) {
    this.updateCallback = handler;
  }

  async sendUpdate(payload) {
    if (this.status !== 'connected') return;
    if (payload.sender !== this.username) return;

    console.log('sending message', payload);
    return this.channel.sendMessage(JSON.stringify(payload));
  }
}
