const crypto = require("crypto");
const { dispatch } = require("./handlers");

// Node port of services/audit-service/app/services/consumer.py's Redis
// Streams consumer pattern - same consumer-group / DLQ / XACK-only-on-success
// conventions documented in shared/EVENTS.md.
const STREAMS = ["lab.result.filed", "lab.result.critical", "patient.record.updated"];
const GROUP = "notification-consumers";
const CONSUMER_NAME = `notification-service-${crypto.randomBytes(4).toString("hex")}`;

async function ensureGroups(redis) {
  for (const stream of STREAMS) {
    const key = `stream:${stream}`;
    try {
      await redis.xgroup("CREATE", key, GROUP, "0", "MKSTREAM");
    } catch (err) {
      if (!String(err.message).includes("BUSYGROUP")) throw err;
    }
  }
}

function fieldsToObject(fields) {
  const obj = {};
  for (let i = 0; i < fields.length; i += 2) {
    obj[fields[i]] = fields[i + 1];
  }
  return obj;
}

async function processEntry(io, streamKey, eventType, fields) {
  try {
    const data = fieldsToObject(fields);
    const envelope = JSON.parse(data.data);
    dispatch(io, eventType, envelope);
    return true;
  } catch (err) {
    return false;
  }
}

async function runConsumer(redis, io, { signal } = {}) {
  await ensureGroups(redis);
  const streamKeys = STREAMS.map((s) => `stream:${s}`);

  while (!signal || !signal.aborted) {
    let response;
    try {
      response = await redis.xreadgroup(
        "GROUP",
        GROUP,
        CONSUMER_NAME,
        "COUNT",
        20,
        "BLOCK",
        5000,
        "STREAMS",
        ...streamKeys,
        ...streamKeys.map(() => ">")
      );
    } catch (err) {
      if (signal && signal.aborted) return;
      await new Promise((resolve) => setTimeout(resolve, 2000));
      continue;
    }

    if (!response) continue;

    for (const [streamKey, entries] of response) {
      const eventType = streamKey.replace(/^stream:/, "");
      for (const [entryId, fields] of entries) {
        const ok = await processEntry(io, streamKey, eventType, fields);
        if (!ok) {
          await redis.xadd(`${streamKey}.dlq`, "*", ...fields);
        }
        await redis.xack(streamKey, GROUP, entryId);
      }
    }
  }
}

module.exports = { runConsumer, ensureGroups, processEntry, STREAMS, GROUP };
