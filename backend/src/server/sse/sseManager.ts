import { getDedicatedPgClient } from "../../db/client.js";
import { logger } from "../../utils/logger.js";
import { FastifyReply } from "fastify";

class SseManager {
  // Map of normalized user address -> Set of active client responses
  private clients = new Map<string, Set<FastifyReply>>();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private pgClient: any = null;

  constructor() {
    this.startHeartbeat();
  }

  /**
   * Registers a Fastify connection for SSE.
   */
  public register(userAddress: string, reply: FastifyReply) {
    const normalized = userAddress.toLowerCase();
    
    const origin = (reply.request.headers.origin as string) || "*";

    // Set headers required for Server-Sent Events and proxy bypasses
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "X-Accel-Buffering": "no" // Bypass Nginx/CDN buffering
    });

    if (!this.clients.has(normalized)) {
      this.clients.set(normalized, new Set());
    }
    
    this.clients.get(normalized)!.add(reply);
    logger.info(`🔌 SSE: Client connected for user ${normalized}. Total clients: ${this.clients.get(normalized)!.size}`);

    // Send initial connection verification
    this.sendEventToReply(reply, "CONNECT_SUCCESS", { message: "Miiso Sentinel Live Stream Connected" });

    // Handle client disconnect
    reply.raw.on("close", () => {
      this.unregister(normalized, reply);
    });
  }

  /**
   * Unregisters a client on disconnection.
   */
  public unregister(userAddress: string, reply: FastifyReply) {
    const normalized = userAddress.toLowerCase();
    const userClients = this.clients.get(normalized);
    
    if (userClients) {
      userClients.delete(reply);
      logger.info(`🔌 SSE: Client disconnected for user ${normalized}. Remaining: ${userClients.size}`);
      
      if (userClients.size === 0) {
        this.clients.delete(normalized);
      }
    }
  }

  /**
   * Sends a structured event to a single client connection.
   */
  private sendEventToReply(reply: FastifyReply, eventName: string, data: any) {
    try {
      reply.raw.write(`event: ${eventName}\n`);
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      logger.error("⚠️ SSE: Failed to write to client connection:", error);
    }
  }

  public sendEventToUser(userAddress: string, eventName: string, data: any) {
    if (userAddress === "*") {
      logger.debug(`⚡ SSE: Broadcasting event ${eventName} to all clients`);
      for (const replySet of this.clients.values()) {
        for (const reply of replySet) {
          this.sendEventToReply(reply, eventName, data);
        }
      }
      return;
    }

    const normalized = userAddress.toLowerCase();
    const userClients = this.clients.get(normalized);

    if (userClients && userClients.size > 0) {
      logger.debug(`⚡ SSE: Dispatching event ${eventName} to user ${normalized} (${userClients.size} connections)`);
      for (const reply of userClients) {
        this.sendEventToReply(reply, eventName, data);
      }
    }
  }

  /**
   * Starts periodic heartbeat stream to maintain idle TCP connections.
   */
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      let totalConnections = 0;
      
      for (const [user, replySet] of this.clients.entries()) {
        for (const reply of replySet) {
          try {
            reply.raw.write(":heartbeat\n\n");
            totalConnections++;
          } catch (e) {
            // Error writing, connection probably dead. Will be cleaned up by close listener
          }
        }
      }
      
      if (totalConnections > 0) {
        logger.debug(`💓 SSE Heartbeat sent to ${totalConnections} open connections.`);
      }
    }, 15000); // 15s heartbeats
  }

  /**
   * Starts the PG LISTEN loop to capture database NOTIFY events and route them to users.
   */
  public async startListening() {
    logger.info("⚡ SSE Listener: Initializing PG LISTEN bridge...");
    try {
      this.pgClient = await getDedicatedPgClient();
      await this.pgClient.query("LISTEN miiso_events");
      
      this.pgClient.on("notification", (msg: any) => {
        if (msg.channel !== "miiso_events") return;
        
        try {
          const payload = JSON.parse(msg.payload);
          const { type, userAddress, data } = payload;
          
          if (!type || !userAddress) {
            logger.warn("⚠️ SSE Listener: Received invalid payload format from NOTIFY:", payload);
            return;
          }

          // Route the database alert to the connected client
          this.sendEventToUser(userAddress, type, data);
        } catch (e) {
          logger.error("❌ SSE Listener: Error parsing NOTIFY payload:", e, { payload: msg.payload });
        }
      });
      
      logger.info("✅ SSE Listener: Database LISTEN bridge active on channel 'miiso_events'.");
    } catch (error) {
      logger.error("❌ SSE Listener: Failed to start database LISTEN bridge:", error);
      // Attempt reconnect after delay
      setTimeout(() => this.startListening(), 5000);
    }
  }

  public shutdown() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.pgClient) {
      this.pgClient.end().catch((err: any) => logger.error("Error closing listener client:", err));
    }
  }
}

export const sseManager = new SseManager();
