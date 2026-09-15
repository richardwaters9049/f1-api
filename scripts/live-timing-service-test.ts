import { f1LiveTiming } from "../src/services/f1-live-timing";

const durationSeconds = Number(process.env.PROBE_DURATION_SECONDS ?? "120");

if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
  throw new Error("PROBE_DURATION_SECONDS must be greater than zero");
}

console.log("Starting F1 live timing service...");
console.log(`Listening for ${durationSeconds} seconds...\n`);

let liveUpdateCount = 0;

const unsubscribe = f1LiveTiming.onUpdate((update) => {
  liveUpdateCount += 1;

  console.log(
    `[LIVE UPDATE ${liveUpdateCount}] ${update.topic} at ${update.receivedAt}`,
  );

  if (process.env.PRINT_LIVE_DATA === "1") {
    console.dir(update.data, {
      depth: 4,
      maxArrayLength: 10,
    });
  }
});

await f1LiveTiming.start();

await new Promise((resolve) => {
  setTimeout(resolve, durationSeconds * 1000);
});

unsubscribe();

const state = f1LiveTiming.getState();

console.log("\n========== F1 LIVE TIMING SUMMARY ==========");
console.log(`Connected: ${state.connected}`);
console.log(`Subscribed: ${state.subscribed}`);
console.log(`Live updates received: ${liveUpdateCount}`);
console.log(`Last message: ${state.lastMessageAt ?? "none"}`);
console.log(`Last update: ${state.lastUpdateAt ?? "none"}`);

console.log("\nSession info:");
console.dir(state.sessionInfo, {
  depth: 3,
  maxArrayLength: 10,
});

console.log("\nSession status:");
console.dir(state.sessionStatus, {
  depth: 3,
  maxArrayLength: 10,
});

console.log("\nFeed update counts:");

if (Object.keys(state.updateCounts).length > 0) {
  console.table(state.updateCounts);
} else {
  console.log("No feed updates received.");
}

console.log("\nAvailable latest feeds:");

if (Object.keys(state.latestFeeds).length > 0) {
  console.log(Object.keys(state.latestFeeds));
} else {
  console.log("No feeds received.");
}

await f1LiveTiming.stop();

console.log("\nF1 live timing service stopped.");
