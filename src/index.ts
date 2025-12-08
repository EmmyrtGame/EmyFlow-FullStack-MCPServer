import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createMcpServer } from './mcp/server';
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { clients } from './config/clients';

dotenv.config();

import webhookRoutes from './routes/webhooks';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
// app.use(express.json()); // Moved to specific routes to avoid conflict with MCP SDK

// ---------------- LOGGING SETUP ----------------
import fs from 'fs';
import path from 'path';

const LOG_FILE = path.join(__dirname, '../server.log');

const logToFile = (message: string) => {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;
  console.log(message); // Still log to console
  try {
    fs.appendFileSync(LOG_FILE, logLine);
  } catch (err) {
    console.error('Failed to write to log file:', err);
  }
};

// Clear log on startup
try {
  fs.writeFileSync(LOG_FILE, '--- Server Restarted ---\n');
} catch (e) {}

// Global Request Logger
app.use((req, res, next) => {
  logToFile(`${req.method} ${req.url} - IP: ${req.ip}`);
  logToFile(`Headers: ${JSON.stringify(req.headers)}`);
  next();
});

// Log Viewer Endpoint (So you can see it in browser)
app.get('/logs', (req, res) => {
  try {
    const logs = fs.readFileSync(LOG_FILE, 'utf8');
    res.setHeader('Content-Type', 'text/plain');
    res.send(logs);
  } catch (err) {
    res.status(500).send('Could not read logs');
  }
});
// ----------------------------------------------

app.get('/', (req, res) => {
  res.send('MCP Server is running. Check /logs for debug info.');
});

app.use('/webhooks', express.json(), webhookRoutes);

// --- MCP SSE Transport Setup ---
// Store active transports by sessionId
const transports = new Map<string, SSEServerTransport>();

app.get('/sse', async (req, res) => {
  logToFile('New SSE connection attempt received');
  
  // 1. Set headers manually to ensure correct SSE setup and anti-buffering
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // For Nginx/Hostinger
  
  // if (res.flushHeaders) res.flushHeaders();
  // 2. Send padding to bypass buffering (some proxies need 2KB+ to start streaming)
  // const padding = ': ' + ' '.repeat(2048) + '\n\n';
  // res.write(padding);

  // 3. Construct Absolute URL for the endpoint
  // Use https by default for production, or req.protocol if trusted
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host;
  const endpointUrl = `https://slategray-baboon-146694.hostingersite.com/messages`;

  logToFile(`Setting up transport with endpoint: ${endpointUrl}`);

  const server = createMcpServer();
  const transport = new SSEServerTransport(endpointUrl, res);
  
  // Connect the server to the transport
  logToFile('Connecting server to transport...');
  await server.connect(transport);
  
  // 4. Send padding AFTER connection is established (headers sent) to bypass buffering
  // This is safe here because SSEServerTransport has already sent headers.
  res.write(': ' + ' '.repeat(2048) + '\n\n');

  const sessionId = (transport as any).sessionId;
  if (sessionId) {
    transports.set(sessionId, transport);
    logToFile(`SSE Session created: ${sessionId}`);
  }

  // Cleanup on connection close
  res.on('close', () => {
    logToFile(`SSE connection closed for session: ${sessionId}`);
    if (sessionId) {
      transports.delete(sessionId);
    }
  });
});

app.post('/messages', async (req, res) => {
  const sessionId = req.query.sessionId as string;
  logToFile(`POST /messages received. SessionId: ${sessionId}`);
  logToFile(`Request Readable: ${req.readable}, Complete: ${req.complete}`);
  
  if (!sessionId) {
    res.status(400).send('Missing sessionId parameter');
    return;
  }

  const transport = transports.get(sessionId);
  if (!transport) {
    logToFile(`Session not found or expired: ${sessionId}`);
    res.status(404).send('Session not found or expired');
    return;
  }

  try {
    logToFile('Handling POST message via transport...');
    await transport.handlePostMessage(req, res);
    logToFile('POST message handled successfully');
  } catch (error: any) {
    logToFile(`Error handling POST message: ${error.message}`);
    logToFile(`Stack: ${error.stack}`);
    res.status(500).send(error.message);
  }
});
// -------------------------------

const startServer = async () => {
  try {
    // await startMcpServer(); // Removed: server is now created per connection
    logToFile('MCP Server starting...');

    app.listen(PORT, () => {
      console.log(`Express server running on port ${PORT}`);
      logToFile(`Express server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
