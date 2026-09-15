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

function isRecord(value: unknown): value is FeedRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getResultKeys(result: unknown): string[] {
  if (!isRecord(result)) {
    return [];
  }

  return Object.keys(result);
}

function printFeedSummary(result: unknown): void {
  if (!isRecord(result)) {
    console.log("Subscription result was not an object.");
    return;
  }

  const feedNames = Object.keys(result);

  console.log("");
  console.log("Initial feed data received.");
  console.log(`Feeds returned: ${feedNames.length}`);

  for (const feedName of feedNames) {
    const feed = result[feedName];

    if (isRecord(feed)) {
      const keys = Object.keys(feed);

      console.log(`- ${feedName}: object with ${keys.length} properties`);

      if (keys.length > 0) {
        console.log(`  Properties: ${keys.slice(0, 20).join(", ")}`);
      }
    } else if (Array.isArray(feed)) {
      console.log(`- ${feedName}: array with ${feed.length} items`);
    } else {
      console.log(`- ${feedName}: ${typeof feed}`);
    }
  }

  console.log("");
  console.log("Raw subscription result:");
  console.log(JSON.stringify(result, null, 2).slice(0, 20_000));
}

function recordFeedNames(result: unknown, receivedFeeds: Set<string>): void {
  for (const key of getResultKeys(result)) {
    receivedFeeds.add(key);
  }
}

async function getLoadBalancerCookie(): Promise<string | null> {
  console.log("Requesting F1 timing load-balancer cookie...");

  const response = await fetch(NEGOTIATE_URL, {
    method: "OPTIONS",
    headers: {
      Accept: "*/*",
      Origin: "https://www.formula1.com",
      Referer: "https://www.formula1.com/",
      "User-Agent": "f1-api-live-timing-probe/1.0",
    },
  });

  console.log(`OPTIONS status: ${response.status}`);

  const setCookie = response.headers.get("set-cookie");

  if (!setCookie) {
    console.log("No AWSALBCORS cookie returned.");
    return null;
  }

  const match = setCookie.match(/AWSALBCORS=([^;]+)/);

  if (!match) {
    console.log("AWSALBCORS cookie not found.");
    return null;
  }

  console.log("AWSALBCORS cookie received.");

  return match[1];
}

async function negotiate(cookie: string | null): Promise<NegotiateResponse> {
  console.log("");
  console.log("Negotiating with official F1 timing service...");
  console.log(`POST ${NEGOTIATE_URL}`);

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Origin: "https://www.formula1.com",
    Referer: "https://www.formula1.com/",
    "User-Agent": "f1-api-live-timing-probe/1.0",
  };

  if (cookie) {
    headers.Cookie = `AWSALBCORS=${cookie}`;
  }

  const response = await fetch(NEGOTIATE_URL, {
    method: "POST",
    headers,
  });

  const body = await response.text();

  console.log(`Negotiation status: ${response.status}`);

  if (!response.ok) {
    throw new Error(`Negotiation failed with HTTP ${response.status}: ${body}`);
  }

  return JSON.parse(body) as NegotiateResponse;
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

async function runProbe(): Promise<void> {
  const cookie = await getLoadBalancerCookie();
  const negotiation = await negotiate(cookie);

  console.log("");
  console.log("Negotiation response:");
  console.log(JSON.stringify(negotiation, null, 2));

  const connectionToken =
    negotiation.connectionToken ?? negotiation.connectionId;

  if (!connectionToken) {
    throw new Error(
      "Negotiation did not provide a connection token or connection ID.",
    );
  }

  const websocketUrl = `${WEBSOCKET_URL}?id=${encodeURIComponent(connectionToken)}`;

  console.log("");
  console.log("Connecting to official F1 SignalR Core WebSocket...");
  console.log(websocketUrl.replace(/id=.*/, "id=<redacted>"));

  const websocketHeaders: Record<string, string> = {
    Origin: "https://www.formula1.com",
    Referer: "https://www.formula1.com/",
    "User-Agent": "f1-api-live-timing-probe/1.0",
  };

  if (cookie) {
    websocketHeaders.Cookie = `AWSALBCORS=${cookie}`;
  }

  const socket = new WebSocket(websocketUrl, {
    headers: websocketHeaders,
  });

  let messageCount = 0;
  let connectedAt: number | null = null;
  let handshakeCompleted = false;
  let subscriptionSent = false;
  let subscriptionCompleted = false;

  const receivedFeeds = new Set<string>();
  const receivedTargets = new Set<string>();

  const timeout = setTimeout(() => {
    console.log("");
    console.log("Probe timeout reached.");
    console.log(`Messages received: ${messageCount}`);

    if (receivedFeeds.size > 0) {
      console.log("");
      console.log("Feeds received:");

      for (const feed of receivedFeeds) {
        console.log(`- ${feed}`);
      }
    }

    if (receivedTargets.size > 0) {
      console.log("");
      console.log("Live targets received:");

      for (const target of receivedTargets) {
        console.log(`- ${target}`);
      }
    }

    if (receivedFeeds.size === 0 && receivedTargets.size === 0) {
      console.log("No F1 feed data was received.");
    }

    socket.close();
  }, 30_000);

  socket.on("open", () => {
    connectedAt = Date.now();

    console.log("WebSocket connected.");
    console.log("Sending SignalR handshake...");

    socket.send(
      JSON.stringify({
        protocol: "json",
        version: 1,
      }) + "\u001e",
    );
  });

  socket.on("message", (rawMessage: Buffer) => {
    const raw = rawMessage.toString();

    for (const part of raw.split("\u001e")) {
      if (!part.trim()) {
        continue;
      }

      messageCount += 1;

      let message: SignalRMessage;

      try {
        message = JSON.parse(part) as SignalRMessage;
      } catch {
        console.log("");
        console.log("Received non-JSON SignalR message:");
        console.log(part);
        continue;
      }

      if (!handshakeCompleted && Object.keys(message).length === 0) {
        handshakeCompleted = true;

        console.log("SignalR handshake completed.");

        if (!subscriptionSent) {
          subscriptionSent = true;

          console.log("");
          console.log(`Subscribing to ${TOPICS.length} F1 timing topics...`);

          socket.send(createInvocation("1", "Subscribe", [TOPICS]));

          console.log("Subscribe invocation sent.");
        }

        continue;
      }

      if (message.error) {
        console.error("");
        console.error("SignalR server error:");
        console.error(message.error);
        continue;
      }

      if (message.type === 3) {
        subscriptionCompleted = true;

        console.log("");
        console.log("SignalR invocation completed.");

        if (message.result !== undefined) {
          recordFeedNames(message.result, receivedFeeds);

          printFeedSummary(message.result);
        } else {
          console.log("Subscription completed without a result.");
        }

        continue;
      }

      if (message.type === 6) {
        console.log("SignalR ping received.");
        continue;
      }

      if (message.type === 1 && message.target) {
        receivedTargets.add(message.target);

        console.log("");
        console.log(`LIVE TARGET: ${message.target}`);

        if (message.arguments !== undefined) {
          console.log(
            JSON.stringify(message.arguments, null, 2).slice(0, 4_000),
          );
        }

        continue;
      }

      console.log("");
      console.log("SignalR message:");
      console.log(JSON.stringify(message, null, 2).slice(0, 4_000));
    }
  });

  socket.on("error", (error) => {
    console.error("");
    console.error("WebSocket error:");
    console.error(error);
  });

  socket.on("close", (code, reason) => {
    clearTimeout(timeout);

    const duration = connectedAt
      ? `${((Date.now() - connectedAt) / 1_000).toFixed(1)}s`
      : "not connected";

    console.log("");
    console.log("WebSocket closed.");
    console.log(`Close code: ${code}`);
    console.log(`Close reason: ${reason.toString() || "(none)"}`);
    console.log(`Connection duration: ${duration}`);
    console.log(`Messages received: ${messageCount}`);
    console.log(
      `Subscription completed: ${subscriptionCompleted ? "yes" : "no"}`,
    );

    if (receivedFeeds.size > 0) {
      console.log("");
      console.log("F1 feeds received:");

      for (const feed of receivedFeeds) {
        console.log(`- ${feed}`);
      }
    }

    if (receivedTargets.size > 0) {
      console.log("");
      console.log("F1 live targets received:");

      for (const target of receivedTargets) {
        console.log(`- ${target}`);
      }
    }

    if (receivedFeeds.size === 0 && receivedTargets.size === 0) {
      console.log("");
      console.log("No F1 feed data was received.");
    }
  });

  await new Promise<void>((resolve) => {
    socket.on("close", () => resolve());
    socket.on("error", () => resolve());
  });
}

try {
  await runProbe();
} catch (error) {
  console.error("");
  console.error("Live timing probe failed.");

  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }

  process.exitCode = 1;
}
