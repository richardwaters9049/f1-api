import WebSocket from "ws";

import {
  LIVE_TIMING_NEGOTIATE_URL,
  LIVE_TIMING_WEBSOCKET_URL,
  UPSTREAM_TIMEOUT_MS,
} from "../config.ts";

const RECORD_SEPARATOR = "\u001e";
const SESSION_STALE_GRACE_MS = 30 * 60 * 1_000;

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
] as const;

export interface F1FeedUpdate {
  topic: string;
  data: unknown;
  receivedAt: string;
}

export interface F1LiveState {
  connected: boolean;
  subscribed: boolean;
  handshakeCompleted: boolean;
  lastMessageAt: string | null;
  lastUpdateAt: string | null;
  sessionInfo: Record<string, unknown> | null;
  sessionStatus: Record<string, unknown> | null;
  driverList: Record<string, unknown> | null;
  timingData: unknown;
  timingAppData: unknown;
  timingStats: unknown;
  trackStatus: unknown;
  weatherData: unknown;
  raceControlMessages: unknown;
  topThree: unknown;
  lapCount: unknown;
  latestFeeds: Record<string, unknown>;
  updateCounts: Record<string, number>;
}

export interface LiveTimingReader {
  getState(): F1LiveState;
  isRunning(): boolean;
}

interface SignalRConnection {
  negotiateVersion?: number;
  connectionToken?: string;
  connectionId?: string;
}

interface SignalRMessage {
  type?: number;
  target?: string;
  arguments?: unknown[];
  invocationId?: string;
  result?: unknown;
  error?: string;
  allowReconnect?: boolean;
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getRecordString(
  record: JsonRecord | null,
  ...keys: string[]
): string | null {
  if (!record) {
    return null;
  }

  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }

  return null;
}

function getNestedRecord(
  record: JsonRecord | null,
  ...keys: string[]
): JsonRecord | null {
  if (!record) {
    return null;
  }

  for (const key of keys) {
    const value = record[key];

    if (isRecord(value)) {
      return value;
    }
  }

  return null;
}

function getSessionEndTimestamp(sessionInfo: JsonRecord | null): number | null {
  if (!sessionInfo) {
    return null;
  }

  const nestedSession = getNestedRecord(sessionInfo, "Session");

  const dateValue =
    getRecordString(sessionInfo, "EndDate", "DateEnd") ??
    getRecordString(nestedSession, "EndDate", "DateEnd");

  if (!dateValue) {
    return null;
  }

  const timestamp = Date.parse(dateValue);

  return Number.isFinite(timestamp) ? timestamp : null;
}

function isActiveSessionStatus(sessionStatus: JsonRecord | null): boolean {
  const status = getRecordString(
    sessionStatus,
    "Status",
    "Name",
  )?.toLowerCase();

  return status === "started" || status === "active" || status === "live";
}

function isStaleSessionSnapshot(state: F1LiveState, now = Date.now()): boolean {
  if (isActiveSessionStatus(state.sessionStatus)) {
    return false;
  }

  const sessionEndTimestamp = getSessionEndTimestamp(state.sessionInfo);

  if (sessionEndTimestamp === null) {
    return false;
  }

  return now > sessionEndTimestamp + SESSION_STALE_GRACE_MS;
}

function clearSessionSnapshot(state: F1LiveState): void {
  state.sessionInfo = null;
  state.sessionStatus = null;
  state.driverList = null;
  state.timingData = null;
  state.timingAppData = null;
  state.timingStats = null;
  state.trackStatus = null;
  state.weatherData = null;
  state.raceControlMessages = null;
  state.topThree = null;
  state.lapCount = null;
  state.latestFeeds = {};
  state.lastUpdateAt = null;
}

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function mergeFeedData(current: unknown, incoming: unknown): unknown {
  if (!isRecord(current) || !isRecord(incoming)) {
    return structuredClone(incoming);
  }

  const merged: JsonRecord = structuredClone(current);

  for (const [key, value] of Object.entries(incoming)) {
    merged[key] = mergeFeedData(merged[key], value);
  }

  return merged;
}

function getLoadBalancerCookie(response: Response): string | null {
  const setCookie = response.headers.get("set-cookie");

  if (!setCookie) {
    return null;
  }

  const match = setCookie.match(/AWSALBCORS=([^;]+)/);

  if (!match) {
    return null;
  }

  return match[1] ?? null;
}

function createInitialState(): F1LiveState {
  return {
    connected: false,
    subscribed: false,
    handshakeCompleted: false,
    lastMessageAt: null,
    lastUpdateAt: null,
    sessionInfo: null,
    sessionStatus: null,
    driverList: null,
    timingData: null,
    timingAppData: null,
    timingStats: null,
    trackStatus: null,
    weatherData: null,
    raceControlMessages: null,
    topThree: null,
    lapCount: null,
    latestFeeds: {},
    updateCounts: {},
  };
}

function extractFeedEntries(
  value: unknown,
): Array<{ topic: string; data: unknown }> {
  const entries: Array<{
    topic: string;
    data: unknown;
  }> = [];

  const visit = (current: unknown): void => {
    if (Array.isArray(current)) {
      if (
        current.length >= 2 &&
        typeof current[0] === "string" &&
        typeof current[1] !== "undefined"
      ) {
        const topic = current[0].trim();

        if (TOPICS.includes(topic as (typeof TOPICS)[number])) {
          entries.push({
            topic,
            data: parseJson(current[1]),
          });

          return;
        }
      }

      for (const item of current) {
        visit(item);
      }

      return;
    }

    if (isRecord(current)) {
      for (const [key, nestedValue] of Object.entries(current)) {
        if (TOPICS.includes(key as (typeof TOPICS)[number])) {
          entries.push({
            topic: key,
            data: parseJson(nestedValue),
          });
        } else {
          visit(nestedValue);
        }
      }

      return;
    }

    if (typeof current === "string") {
      const parsed = parseJson(current);

      if (parsed !== current) {
        visit(parsed);
      }
    }
  };

  visit(value);

  return entries;
}

function applyFeed(
  state: F1LiveState,
  topic: string,
  data: unknown,
  merge: boolean,
): void {
  const nextData = merge
    ? mergeFeedData(state.latestFeeds[topic], data)
    : structuredClone(data);

  state.latestFeeds[topic] = nextData;
  state.lastUpdateAt = new Date().toISOString();
  state.updateCounts[topic] = (state.updateCounts[topic] ?? 0) + 1;

  switch (topic) {
    case "SessionInfo":
      state.sessionInfo = isRecord(nextData) ? nextData : null;
      break;

    case "SessionStatus":
      state.sessionStatus = isRecord(nextData) ? nextData : null;
      break;

    case "DriverList":
      state.driverList = isRecord(nextData) ? nextData : null;
      break;

    case "TimingData":
      state.timingData = nextData;
      break;

    case "TimingAppData":
      state.timingAppData = nextData;
      break;

    case "TimingStats":
      state.timingStats = nextData;
      break;

    case "TrackStatus":
      state.trackStatus = nextData;
      break;

    case "WeatherData":
      state.weatherData = nextData;
      break;

    case "RaceControlMessages":
      state.raceControlMessages = nextData;
      break;

    case "TopThree":
      state.topThree = nextData;
      break;

    case "LapCount":
      state.lapCount = nextData;
      break;

    default:
      break;
  }
}

export class F1LiveTimingService {
  private socket: WebSocket | null = null;

  private cookie: string | null = null;

  private state: F1LiveState = createInitialState();

  private started = false;

  private stopping = false;

  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private reconnectAttempts = 0;

  private readonly reconnectDelayMs = 5_000;

  private readonly maxReconnectDelayMs = 60_000;

  private readonly listeners = new Set<(update: F1FeedUpdate) => void>();

  public getState(): F1LiveState {
    const snapshot = structuredClone(this.state);

    if (isStaleSessionSnapshot(snapshot)) {
      clearSessionSnapshot(snapshot);
    }

    return snapshot;
  }

  public isRunning(): boolean {
    return this.started && !this.stopping;
  }

  public onUpdate(listener: (update: F1FeedUpdate) => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  public async start(): Promise<void> {
    if (this.started) {
      return;
    }

    this.started = true;
    this.stopping = false;
    this.reconnectAttempts = 0;

    await this.connect();
  }

  public async stop(): Promise<void> {
    this.stopping = true;
    this.started = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.close();
      this.socket = null;
    }

    this.state.connected = false;
    this.state.subscribed = false;
    this.state.handshakeCompleted = false;
  }

  private async getLoadBalancerCookie(): Promise<string | null> {
    const response = await fetch(LIVE_TIMING_NEGOTIATE_URL, {
      method: "OPTIONS",
      headers: {
        Accept: "*/*",
        Origin: "https://www.formula1.com",
        Referer: "https://www.formula1.com/",
        "User-Agent": "f1-api-live-timing-service/1.0",
      },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.warn(
        `[F1 Live] OPTIONS request returned HTTP ${response.status}`,
      );
    }

    const cookie = getLoadBalancerCookie(response);

    if (!cookie) {
      console.warn("[F1 Live] No AWSALBCORS cookie received");
    } else {
      console.log("[F1 Live] AWSALBCORS cookie received");
    }

    return cookie;
  }

  private async negotiate(cookie: string | null): Promise<SignalRConnection> {
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

    const response = await fetch(LIVE_TIMING_NEGOTIATE_URL, {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    const body = await response.text();

    if (!response.ok) {
      throw new Error(
        `Negotiation failed with HTTP ${response.status}: ${body}`,
      );
    }

    let connection: unknown;

    try {
      connection = JSON.parse(body);
    } catch {
      throw new Error("Negotiation returned invalid JSON");
    }

    if (!isRecord(connection)) {
      throw new Error("Negotiation returned an invalid response");
    }

    return connection as SignalRConnection;
  }

  private async connect(): Promise<void> {
    if (this.stopping) {
      return;
    }

    try {
      console.log("[F1 Live] Requesting F1 timing load-balancer cookie");

      this.cookie = await this.getLoadBalancerCookie();

      console.log("[F1 Live] Negotiating SignalR connection");

      const connection = await this.negotiate(this.cookie);

      const connectionToken =
        connection.connectionToken ?? connection.connectionId;

      if (!connectionToken) {
        throw new Error(
          "Negotiation did not provide a connection token or connection ID",
        );
      }

      const websocketUrl = `${LIVE_TIMING_WEBSOCKET_URL}?id=${encodeURIComponent(
        connectionToken,
      )}`;

      const headers: Record<string, string> = {
        Origin: "https://www.formula1.com",
        Referer: "https://www.formula1.com/",
        "User-Agent": "f1-api-live-timing-service/1.0",
      };

      if (this.cookie) {
        headers.Cookie = `AWSALBCORS=${this.cookie}`;
      }

      console.log("[F1 Live] Connecting to SignalR WebSocket");

      const socket = new WebSocket(websocketUrl, {
        headers,
        handshakeTimeout: 15_000,
      });

      this.socket = socket;

      socket.on("open", () => {
        this.state.connected = true;

        console.log("[F1 Live] WebSocket connected");

        const handshake = {
          protocol: "json",
          version: 1,
        };

        socket.send(`${JSON.stringify(handshake)}${RECORD_SEPARATOR}`);

        console.log("[F1 Live] Handshake sent");
      });

      socket.on("message", (rawMessage: Buffer) => {
        this.handleMessage(rawMessage.toString());
      });

      socket.on("error", (error) => {
        console.error("[F1 Live] WebSocket error:", error.message);
      });

      socket.on("close", (code, reason) => {
        console.warn(
          `[F1 Live] WebSocket closed. Code: ${code}. ` +
            `Reason: ${reason.toString() || "none"}`,
        );

        this.state.connected = false;
        this.state.subscribed = false;
        this.state.handshakeCompleted = false;

        if (this.socket === socket) {
          this.socket = null;
        }

        if (!this.stopping) {
          this.scheduleReconnect();
        }
      });
    } catch (error) {
      console.error(
        "[F1 Live] Connection error:",
        error instanceof Error ? error.message : error,
      );

      if (!this.stopping) {
        this.scheduleReconnect();
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.stopping || this.reconnectTimer) {
      return;
    }

    this.reconnectAttempts += 1;

    const delay = Math.min(
      this.reconnectDelayMs * 2 ** Math.min(this.reconnectAttempts - 1, 4),
      this.maxReconnectDelayMs,
    );

    console.log(
      `[F1 Live] Reconnecting in ${delay / 1_000}s ` +
        `(attempt ${this.reconnectAttempts})`,
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delay);
  }

  private handleMessage(rawMessage: string): void {
    const messages = rawMessage
      .split(RECORD_SEPARATOR)
      .map((message) => message.trim())
      .filter(Boolean);

    for (const raw of messages) {
      let message: SignalRMessage;

      try {
        message = JSON.parse(raw) as SignalRMessage;
      } catch {
        console.warn("[F1 Live] Invalid JSON message received");

        continue;
      }

      this.state.lastMessageAt = new Date().toISOString();

      if (!this.state.handshakeCompleted && Object.keys(message).length === 0) {
        this.state.handshakeCompleted = true;

        console.log("[F1 Live] SignalR handshake completed");

        this.sendSubscription();

        continue;
      }

      if (message.type === 3) {
        this.handleCompletion(message);

        continue;
      }

      if (message.type === 6) {
        continue;
      }

      if (message.type === 7) {
        console.error(
          "[F1 Live] SignalR close message:",
          JSON.stringify(message, null, 2),
        );

        this.socket?.close();

        continue;
      }

      if (message.type === 1) {
        this.handleInvocation(message);

        continue;
      }

      if (message.type === 2) {
        console.log("[F1 Live] Stream item received");

        continue;
      }

      console.log(
        "[F1 Live] SignalR message:",
        JSON.stringify(message, null, 2).slice(0, 4_000),
      );
    }
  }

  private handleCompletion(message: SignalRMessage): void {
    if (message.error) {
      console.error("[F1 Live] Completion error:", message.error);

      return;
    }

    this.state.subscribed = true;
    this.reconnectAttempts = 0;

    if (message.result !== undefined) {
      const entries = extractFeedEntries(message.result);

      for (const entry of entries) {
        applyFeed(this.state, entry.topic, entry.data, false);
      }

      console.log(
        `[F1 Live] Initial feed snapshot received: ${entries.length} entries`,
      );

      return;
    }

    console.log("[F1 Live] Subscription completed");
  }

  private sendSubscription(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn("[F1 Live] Cannot subscribe because WebSocket is not open");

      return;
    }

    const subscription = {
      arguments: [TOPICS],
      invocationId: "1",
      target: "Subscribe",
      type: 1,
    };

    this.socket.send(`${JSON.stringify(subscription)}${RECORD_SEPARATOR}`);

    console.log(`[F1 Live] Subscription sent for ${TOPICS.length} topics`);
  }

  private handleInvocation(message: SignalRMessage): void {
    const entries = extractFeedEntries(message.arguments ?? []);

    if (entries.length === 0) {
      return;
    }

    for (const entry of entries) {
      applyFeed(this.state, entry.topic, entry.data, true);

      const update: F1FeedUpdate = {
        topic: entry.topic,
        data: entry.data,
        receivedAt: new Date().toISOString(),
      };

      for (const listener of this.listeners) {
        listener(update);
      }
    }
  }
}

export const f1LiveTiming = new F1LiveTimingService();
