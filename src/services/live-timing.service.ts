import WebSocket from "ws";

const NEGOTIATE_URL = "https://livetiming.formula1.com/signalrcore/negotiate";

const WEBSOCKET_URL = "wss://livetiming.formula1.com/signalrcore";

const TOPICS = [
  "Heartbeat",
  "AudioStreams",
  "DriverList",
  "ExtrapolatedClock",
  "RaceControlMessages",
  "SessionInfo",
  "SessionStatus",
  "TeamRadio",
  "TimingAppData",
  "TimingStats",
  "TrackStatus",
  "WeatherData",
  "Position.z",
  "CarData.z",
  "ContentStreams",
  "SessionData",
  "TimingData",
  "TopThree",
  "RcmSeries",
  "LapCount",
];

interface NegotiateResponse {
  negotiateVersion?: number;
  connectionId?: string;
  connectionToken?: string;
  availableTransports?: Array<{
    transport: string;
    transferFormats: string[];
  }>;
}

interface SignalRMessage {
  type?: number;
  target?: string;
  arguments?: unknown[];
  error?: string;
  result?: unknown;
}

type FeedRecord = Record<string, unknown>;

export interface LiveTimingState {
  connected: boolean;
  subscribed: boolean;
  lastMessageAt: string | null;
  lastUpdateAt: string | null;
  sessionInfo: FeedRecord | null;
  sessionStatus: FeedRecord | null;
  latestFeeds: Record<string, unknown>;
  updateCount: number;
}

type FeedUpdateListener = (target: string, argumentsList: unknown[]) => void;

function isRecord(value: unknown): value is FeedRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createInvocation(
  invocationId: string,
  target: string,
  args: unknown[],
): string {
  return (
    JSON.stringify({
      arguments: args,
      invocationId,
      target,
      type: 1,
    }) + "\u001e"
  );
}

export class LiveTimingService {
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private reconnectAttempts = 0;
  private handshakeCompleted = false;
  private subscriptionSent = false;

  private readonly maxReconnectAttempts = 5;
  private readonly reconnectDelayMs = 5_000;

  private state: LiveTimingState = {
    connected: false,
    subscribed: false,
    lastMessageAt: null,
    lastUpdateAt: null,
    sessionInfo: null,
    sessionStatus: null,
    latestFeeds: {},
    updateCount: 0,
  };

  private listeners = new Set<FeedUpdateListener>();

  public getState(): LiveTimingState {
    return {
      ...this.state,
      latestFeeds: { ...this.state.latestFeeds },
    };
  }

  public onFeedUpdate(listener: FeedUpdateListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  public async start(): Promise<void> {
    if (this.socket || (this.stopped === false && this.reconnectAttempts > 0)) {
      return;
    }

    this.stopped = false;
    this.reconnectAttempts = 0;

    await this.connect();
  }

  public stop(): void {
    this.stopped = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.close();
      this.socket = null;
    }

    this.handshakeCompleted = false;
    this.subscriptionSent = false;

    this.state = {
      ...this.state,
      connected: false,
      subscribed: false,
    };

    console.log("[F1 Live] Service stopped");
  }

  private async getLoadBalancerCookie(): Promise<string | null> {
    const response = await fetch(NEGOTIATE_URL, {
      method: "OPTIONS",
      headers: {
        Accept: "*/*",
        Origin: "https://www.formula1.com",
        Referer: "https://www.formula1.com/",
        "User-Agent": "f1-api-live-timing-service/1.0",
      },
    });

    const setCookie = response.headers.get("set-cookie");

    if (!setCookie) {
      console.warn("[F1 Live] No AWSALBCORS cookie returned");
      return null;
    }

    const match = setCookie.match(/AWSALBCORS=([^;]+)/);

    if (!match) {
      console.warn("[F1 Live] AWSALBCORS cookie not found");
      return null;
    }

    return match[1] ?? null;
  }

  private async negotiate(cookie: string | null): Promise<NegotiateResponse> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
      Origin: "https://www.formula1.com",
      Referer: "https://www.formula1.com/",
      "User-Agent": "f1-api-live-timing-service/1.0",
    };

    if (cookie) {
      headers.Cookie = `AWSALBCORS=${cookie}`;
    }

    const response = await fetch(NEGOTIATE_URL, {
      method: "POST",
      headers,
    });

    const body = await response.text();

    if (!response.ok) {
      throw new Error(
        `F1 SignalR negotiation failed with HTTP ${response.status}: ${body}`,
      );
    }

    return JSON.parse(body) as NegotiateResponse;
  }

  private async connect(): Promise<void> {
    if (this.stopped) {
      return;
    }

    try {
      console.log("[F1 Live] Negotiating SignalR connection");

      const cookie = await this.getLoadBalancerCookie();
      const negotiation = await this.negotiate(cookie);

      const connectionToken =
        negotiation.connectionToken ?? negotiation.connectionId;

      if (!connectionToken) {
        throw new Error(
          "F1 SignalR negotiation did not provide a connection token",
        );
      }

      const websocketUrl = `${WEBSOCKET_URL}?id=${encodeURIComponent(connectionToken)}`;

      const websocketHeaders: Record<string, string> = {
        Origin: "https://www.formula1.com",
        Referer: "https://www.formula1.com/",
        "User-Agent": "f1-api-live-timing-service/1.0",
      };

      if (cookie) {
        websocketHeaders.Cookie = `AWSALBCORS=${cookie}`;
      }

      this.handshakeCompleted = false;
      this.subscriptionSent = false;

      const socket = new WebSocket(websocketUrl, {
        headers: websocketHeaders,
      });

      this.socket = socket;

      socket.on("open", () => {
        console.log("[F1 Live] WebSocket connected");

        this.state = {
          ...this.state,
          connected: true,
        };

        socket.send(
          JSON.stringify({
            protocol: "json",
            version: 1,
          }) + "\u001e",
        );

        console.log("[F1 Live] SignalR handshake sent");
      });

      socket.on("message", (rawMessage: Buffer) => {
        this.handleRawMessage(rawMessage.toString());
      });

      socket.on("error", (error) => {
        console.error("[F1 Live] WebSocket error:", error.message);
      });

      socket.on("close", (code, reason) => {
        console.warn(
          `[F1 Live] WebSocket closed. Code: ${code}. Reason: ${
            reason.toString() || "none"
          }`,
        );

        if (this.socket === socket) {
          this.socket = null;
        }

        this.state = {
          ...this.state,
          connected: false,
          subscribed: false,
        };

        this.handshakeCompleted = false;
        this.subscriptionSent = false;

        this.scheduleReconnect();
      });
    } catch (error) {
      console.error("[F1 Live] Connection failed:", error);
      this.scheduleReconnect();
    }
  }

  private handleRawMessage(raw: string): void {
    this.state = {
      ...this.state,
      lastMessageAt: new Date().toISOString(),
    };

    for (const part of raw.split("\u001e")) {
      if (!part.trim()) {
        continue;
      }

      let message: SignalRMessage;

      try {
        message = JSON.parse(part) as SignalRMessage;
      } catch {
        console.warn("[F1 Live] Received non-JSON SignalR message");
        continue;
      }

      /*
       * SignalR completes the initial handshake with an empty JSON object.
       * It does not use a type 3 message for this.
       */
      if (!this.handshakeCompleted && Object.keys(message).length === 0) {
        this.handshakeCompleted = true;

        console.log("[F1 Live] SignalR handshake completed");

        this.sendSubscription();
        continue;
      }

      if (message.error) {
        console.error("[F1 Live] SignalR server error:", message.error);
        continue;
      }

      if (message.type === 3) {
        if (message.result !== undefined) {
          this.processSubscriptionResult(message.result);
        } else {
          this.state = {
            ...this.state,
            subscribed: true,
          };

          console.log(
            "[F1 Live] Subscription completed without an initial result",
          );
        }

        continue;
      }

      if (message.type === 6) {
        this.socket?.send("{}\u001e");
        continue;
      }

      if (message.type === 1 && message.target) {
        this.processFeedUpdate(message.target, message.arguments ?? []);

        continue;
      }

      console.log("[F1 Live] Unhandled SignalR message:", message);
    }
  }

  private sendSubscription(): void {
    if (!this.socket || this.subscriptionSent || !this.handshakeCompleted) {
      return;
    }

    this.subscriptionSent = true;

    console.log(`[F1 Live] Subscribing to ${TOPICS.length} timing topics`);

    this.socket.send(createInvocation("1", "Subscribe", [TOPICS]));

    console.log("[F1 Live] Subscribe invocation sent");
  }

  private processSubscriptionResult(result: unknown): void {
    if (!isRecord(result)) {
      console.warn("[F1 Live] Subscription result was not an object");

      this.state = {
        ...this.state,
        subscribed: true,
      };

      return;
    }

    const latestFeeds = {
      ...this.state.latestFeeds,
      ...result,
    };

    const sessionInfo = isRecord(result.SessionInfo)
      ? result.SessionInfo
      : this.state.sessionInfo;

    const sessionStatus = isRecord(result.SessionStatus)
      ? result.SessionStatus
      : this.state.sessionStatus;

    this.state = {
      ...this.state,
      subscribed: true,
      lastUpdateAt: new Date().toISOString(),
      latestFeeds,
      sessionInfo,
      sessionStatus,
      updateCount: this.state.updateCount + 1,
    };

    console.log(
      `[F1 Live] Initial feed data received: ${
        Object.keys(result).length
      } feeds`,
    );
  }

  private processFeedUpdate(target: string, argumentsList: unknown[]): void {
    const firstArgument = argumentsList[0];

    if (isRecord(firstArgument)) {
      this.state = {
        ...this.state,
        latestFeeds: {
          ...this.state.latestFeeds,
          ...firstArgument,
        },
      };
    }

    this.state = {
      ...this.state,
      lastUpdateAt: new Date().toISOString(),
      updateCount: this.state.updateCount + 1,
    };

    for (const listener of this.listeners) {
      listener(target, argumentsList);
    }
  }

  private scheduleReconnect(): void {
    if (
      this.stopped ||
      this.reconnectTimer ||
      this.reconnectAttempts >= this.maxReconnectAttempts
    ) {
      return;
    }

    this.reconnectAttempts += 1;

    console.log(
      `[F1 Live] Reconnecting in ${
        this.reconnectDelayMs / 1_000
      }s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, this.reconnectDelayMs);
  }
}

export const liveTimingService = new LiveTimingService();
