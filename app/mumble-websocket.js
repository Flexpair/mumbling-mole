import Promise from "promise";
import websocketStream from "websocket-stream";
import MumbleClient from "mumble-client";

const RECONNECT_CONFIG = {
  MAX_ATTEMPTS: 5,
  BASE_DELAY: 1000,
  MAX_DELAY: 30000,
  BACKOFF_MULTIPLIER: 2
};

class WebSocketReconnector {
  constructor() {
    this.reconnectAttempts = 0;
    this.reconnectTimeout = null;
    this.isReconnecting = false;
    this.lastConnectionParams = null;
    this.currentClient = null;
    this.onReconnectCallbacks = [];
    this.onFailCallbacks = [];
  }

  storeConnectionParams(address, options) {
    this.lastConnectionParams = { address, options };
  }

  onReconnect(callback) {
    this.onReconnectCallbacks.push(callback);
  }

  onReconnectFail(callback) {
    this.onFailCallbacks.push(callback);
  }

  async attemptReconnect() {
    if (this.isReconnecting || !this.lastConnectionParams) {
      return null;
    }
    
    this.isReconnecting = true;
    console.log('Starting reconnection process...');
    
    while (this.reconnectAttempts < RECONNECT_CONFIG.MAX_ATTEMPTS) {
      this.reconnectAttempts++;
      const delay = Math.min(
        RECONNECT_CONFIG.BASE_DELAY * Math.pow(RECONNECT_CONFIG.BACKOFF_MULTIPLIER, this.reconnectAttempts - 1),
        RECONNECT_CONFIG.MAX_DELAY
      );
      
      console.log(`Reconnect attempt ${this.reconnectAttempts}/${RECONNECT_CONFIG.MAX_ATTEMPTS} in ${delay}ms...`);
      
      await new Promise(resolve => {
        this.reconnectTimeout = setTimeout(resolve, delay);
      });
      
      try {
        const newClient = await this._createConnection(
          this.lastConnectionParams.address,
          this.lastConnectionParams.options
        );
        
        this.reconnectAttempts = 0;
        this.isReconnecting = false;
        this.currentClient = newClient;
        
        console.log('Reconnection successful');
        
        // Notify all registered callbacks
        this.onReconnectCallbacks.forEach(callback => {
          try {
            callback(newClient);
          } catch (error) {
            console.error('Error in reconnect callback:', error);
          }
        });
        
        return newClient;
      } catch (error) {
        console.error(`Reconnect attempt ${this.reconnectAttempts} failed:`, error);
        
        if (this.reconnectAttempts >= RECONNECT_CONFIG.MAX_ATTEMPTS) {
          this.isReconnecting = false;
          console.error('Max reconnection attempts reached');
          
          // Notify failure callbacks
          this.onFailCallbacks.forEach(callback => {
            try {
              callback(error);
            } catch (callbackError) {
              console.error('Error in reconnect fail callback:', callbackError);
            }
          });
          
          return null;
        }
      }
    }
    
    return null;
  }

  async _createConnection(address, options) {
    const ws = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout after 10 seconds'));
      }, 10000);

      const ws = websocketStream(address, ["binary"])
        .on("error", (error) => {
          clearTimeout(timeout);
          reject(error);
        })
        .on("connect", () => {
          clearTimeout(timeout);
          resolve(ws);
        });
    });
    
    return new MumbleClient(options).connectDataStream(ws);
  }

  cleanup() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
    this.onReconnectCallbacks = [];
    this.onFailCallbacks = [];
  }
}

// Global reconnector instance
const reconnector = new WebSocketReconnector();

// Native async wrapper for establishing the websocket and wiring it to MumbleClient.
// With automatic reconnection support.
async function connect(address, options) {
  // Store connection params for potential reconnection
  reconnector.storeConnectionParams(address, options);

  const ws = await new Promise((resolve, reject) => {
    const ws = websocketStream(address, ["binary"])
      .on("error", reject)
      .on("connect", () => resolve(ws));
  });
  
  const client = await new MumbleClient(options).connectDataStream(ws);
  reconnector.currentClient = client;

  // Set up disconnect handler for automatic reconnection
  client.on('disconnected', () => {
    console.warn('WebSocket disconnected, attempting reconnection...');
    
    reconnector.attemptReconnect().then((newClient) => {
      if (newClient) {
        // Emit custom reconnected event
        client.emit('reconnected', newClient);
      } else {
        // Emit reconnection failed event
        client.emit('reconnectFailed');
      }
    });
  });

  // Handle connection errors that might not trigger disconnected
  client.connection.on('error', (error) => {
    console.error('Connection error:', error);
    if (!reconnector.isReconnecting) {
      reconnector.attemptReconnect();
    }
  });

  return client;
}

// Export both the connect function and reconnector for external control
export default connect;
export { reconnector };
