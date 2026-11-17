#!/usr/bin/env node
/**
 * Zero-dependency stdio MCP bridge for Affinity by Canva.
 *
 * Key features:
 * 1. Direct Node fetch SSE client (defaults to http://[::1]:6767 with fallback to
 *    http://localhost:6767) — avoids spawning npx/mcp-remote per session.
 * 2. Normalizes MCP protocolVersion: Affinity enforces "2025-11-25", while clients
 *    may request "2024-11-05" or "2025-03-26". We rewrite outgoing initialize requests
 *    to "2025-11-25" and map the response version back to the client's requested version.
 * 3. Automatically runs read_sdk_documentation_topic({ filename: "preamble" }) after
 *    initialize/notifications/initialized so every SSE session satisfies Affinity's gate.
 * 4. Idle pool release: disconnects the SSE stream after IDLE_MS (default 60s) when
 *    no requests are in flight so idle IDE sessions do not exhaust Affinity's ~13-slot
 *    SSE connection cap, transparently reconnecting + re-reading preamble on demand.
 */

import readline from 'node:readline';

const CANDIDATE_URLS = process.env.AFFINITY_MCP_URL
  ? [process.env.AFFINITY_MCP_URL.replace(/\/+$/, '')]
  : ['http://[::1]:6767', 'http://localhost:6767'];
const AFFINITY_PROTOCOL_VERSION = '2025-11-25';
const IDLE_MS = Number(process.env.AFFINITY_IDLE_MS ?? 60_000);
const PREAMBLE_RPC_ID = '__affinity_bridge_preamble__';
const REINIT_RPC_ID = '__affinity_bridge_reinit__';

class AffinitySseTransport {
  constructor() {
    this.baseUrl = '';
    this.postPath = '';
    this.abort = null;
    this.pending = new Map();
    this.connected = false;
    this.connectingPromise = null;
    this.idleTimer = null;
    this.inFlight = 0;
    this.clientProtocolVersion = AFFINITY_PROTOCOL_VERSION;
    this.clientInitParams = {
      protocolVersion: AFFINITY_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'affinity-mcp-bridge', version: '1.0' },
    };
  }

  touchIdleTimer() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (!this.connected || this.inFlight > 0 || IDLE_MS <= 0) return;
    this.idleTimer = setTimeout(() => {
      if (this.inFlight === 0) {
        this.disconnect();
      }
    }, IDLE_MS);
  }

  disconnect() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    this.connected = false;
    this.postPath = '';
    if (this.abort) {
      this.abort.abort();
      this.abort = null;
    }
    for (const [id, entry] of this.pending.entries()) {
      this.pending.delete(id);
      entry.reject(new Error('Affinity SSE connection closed'));
    }
  }

  async openSse() {
    let res = null;
    let chosenBase = '';
    let lastErr = null;
    this.abort = new AbortController();

    for (const base of CANDIDATE_URLS) {
      try {
        const candidate = await fetch(base + '/sse', {
          headers: { accept: 'text/event-stream' },
          signal: this.abort.signal,
        });
        if (candidate.ok && candidate.body) {
          res = candidate;
          chosenBase = base;
          break;
        }
        lastErr = new Error(`SSE connect failed (${base}): HTTP ${candidate.status}`);
      } catch (err) {
        lastErr = err;
      }
    }

    if (!res || !res.body) {
      this.disconnect();
      throw new Error(
        `Affinity MCP unreachable at ${CANDIDATE_URLS.join(', ')}: ${lastErr?.message ?? lastErr}`
      );
    }

    this.baseUrl = chosenBase;
    this.postPath = '';
    this.pump(res.body.getReader());

    const deadline = Date.now() + 10_000;
    while (!this.postPath) {
      if (Date.now() > deadline) {
        this.disconnect();
        throw new Error('Timed out waiting for Affinity MCP endpoint event');
      }
      await new Promise((r) => setTimeout(r, 20));
    }
  }

  async pump(reader) {
    const dec = new TextDecoder();
    let buf = '';
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true }).replace(/\r\n/g, '\n');
        let idx;
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const eventMatch = /^event:\s*(.*)$/m.exec(chunk);
          const eventName = eventMatch ? eventMatch[1].trim() : '';
          const data = chunk
            .split('\n')
            .filter((l) => l.startsWith('data: '))
            .map((l) => l.slice(6))
            .join('\n');

          if (eventName === 'endpoint') {
            this.postPath = data.trim();
          } else if (eventName === 'message' && data) {
            let msg;
            try {
              msg = JSON.parse(data);
            } catch {
              continue;
            }
            if (msg.id !== undefined && msg.id !== null) {
              const key = String(msg.id);
              const waiter = this.pending.get(key);
              if (waiter) {
                this.pending.delete(key);
                waiter.resolve(msg);
              }
            } else {
              process.stdout.write(JSON.stringify(msg) + '\n');
            }
          }
        }
      }
    } catch {
      // Expected on abort or server shutdown
    } finally {
      if (this.connected) {
        this.disconnect();
      }
    }
  }

  async postMessage(msg) {
    const res = await fetch(this.baseUrl + this.postPath, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(msg),
    });
    if (!res.ok && res.status !== 202) {
      throw new Error(`POST ${this.postPath} failed: HTTP ${res.status}`);
    }
  }

  sendRpc(msg, timeoutMs = 240_000) {
    const key = String(msg.id);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(key);
        reject(new Error(`Affinity MCP request ${msg.method} timed out after ${timeoutMs} ms`));
      }, timeoutMs);
      this.pending.set(key, {
        resolve: (resp) => {
          clearTimeout(timer);
          resolve(resp);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });
      this.postMessage(msg).catch((err) => {
        clearTimeout(timer);
        this.pending.delete(key);
        reject(err);
      });
    });
  }

  async ensureConnected(isInitialHandshake = false) {
    if (this.connected) return;
    if (this.connectingPromise) {
      await this.connectingPromise;
      return;
    }
    this.connectingPromise = (async () => {
      await this.openSse();
      if (!isInitialHandshake) {
        const reinit = {
          jsonrpc: '2.0',
          id: REINIT_RPC_ID,
          method: 'initialize',
          params: Object.assign({}, this.clientInitParams, {
            protocolVersion: AFFINITY_PROTOCOL_VERSION,
          }),
        };
        const initResp = await this.sendRpc(reinit, 20_000);
        if (initResp.error) {
          throw new Error('Reconnect initialize failed: ' + JSON.stringify(initResp.error));
        }
        await this.postMessage({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });
        const preambleResp = await this.sendRpc(
          {
            jsonrpc: '2.0',
            id: PREAMBLE_RPC_ID,
            method: 'tools/call',
            params: {
              name: 'read_sdk_documentation_topic',
              arguments: { filename: 'preamble' },
            },
          },
          20_000
        );
        if (preambleResp.error || preambleResp.result?.isError) {
          throw new Error('Preamble reload failed: ' + JSON.stringify(preambleResp));
        }
      }
      this.connected = true;
      this.touchIdleTimer();
    })();

    try {
      await this.connectingPromise;
    } finally {
      this.connectingPromise = null;
    }
  }
}

const transport = new AffinitySseTransport();
let queue = Promise.resolve();
let initialPreamblePromise = null;

async function handleIncomingMessage(msg) {
  if (msg.method === 'initialize' && msg.id !== undefined) {
    transport.clientProtocolVersion = msg.params?.protocolVersion || AFFINITY_PROTOCOL_VERSION;
    transport.clientInitParams = Object.assign({}, msg.params || {}, {
      protocolVersion: AFFINITY_PROTOCOL_VERSION,
    });

    if (transport.connected) {
      transport.disconnect();
    }
    await transport.ensureConnected(true);

    const outMsg = Object.assign({}, msg, {
      params: Object.assign({}, msg.params || {}, {
        protocolVersion: AFFINITY_PROTOCOL_VERSION,
      }),
    });

    transport.inFlight++;
    try {
      const resp = await transport.sendRpc(outMsg, 20_000);
      if (resp.result && typeof resp.result === 'object') {
        resp.result.protocolVersion = transport.clientProtocolVersion;
      }
      process.stdout.write(JSON.stringify(resp) + '\n');
    } finally {
      transport.inFlight--;
      transport.touchIdleTimer();
    }
    return;
  }

  if (msg.method === 'notifications/initialized') {
    await transport.ensureConnected(true);
    await transport.postMessage(msg);
    initialPreamblePromise = transport
      .sendRpc(
        {
          jsonrpc: '2.0',
          id: PREAMBLE_RPC_ID,
          method: 'tools/call',
          params: {
            name: 'read_sdk_documentation_topic',
            arguments: { filename: 'preamble' },
          },
        },
        20_000
      )
      .then(() => {
        transport.touchIdleTimer();
      });
    await initialPreamblePromise;
    return;
  }

  if (initialPreamblePromise) {
    await initialPreamblePromise;
    initialPreamblePromise = null;
  }

  await transport.ensureConnected(false);

  if (msg.id === undefined || msg.id === null) {
    await transport.postMessage(msg);
    transport.touchIdleTimer();
    return;
  }

  transport.inFlight++;
  transport.touchIdleTimer();
  try {
    const resp = await transport.sendRpc(msg, 240_000);
    process.stdout.write(JSON.stringify(resp) + '\n');
  } catch (err) {
    process.stdout.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: msg.id,
        error: { code: -32603, message: String(err?.message ?? err) },
      }) + '\n'
    );
  } finally {
    transport.inFlight--;
    transport.touchIdleTimer();
  }
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let msg;
  try {
    msg = JSON.parse(trimmed);
  } catch {
    return;
  }
  queue = queue
    .then(() => handleIncomingMessage(msg))
    .catch((err) => {
      if (msg.id !== undefined && msg.id !== null) {
        process.stdout.write(
          JSON.stringify({
            jsonrpc: '2.0',
            id: msg.id,
            error: { code: -32603, message: String(err?.message ?? err) },
          }) + '\n'
        );
      }
    });
});

rl.on('close', () => {
  transport.disconnect();
  process.exit(0);
});
