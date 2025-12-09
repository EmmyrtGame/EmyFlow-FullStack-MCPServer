import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createMcpServer } from './mcp/server';
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { clients } from './config/clients';

dotenv.config();

import webhookRoutes from './routes/webhooks';

import adminRoutes from './admin/routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
// app.use(express.json()); // Moved to specific routes to avoid conflict with MCP SDK

// ---------------- LOGGING SETUP ----------------
// IN-MEMORY LOGGING (Avoids file system permission issues)
const logs: string[] = [];
const MAX_LOGS = 500;

const logToMemory = (message: string) => {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}`;
  console.log(message); // Keep console log just in case
  
  logs.push(logLine);
  if (logs.length > MAX_LOGS) {
    logs.shift(); // Remove oldest
  }
};

// Global Request Logger
app.use((req, res, next) => {
  logToMemory(`${req.method} ${req.url} - IP: ${req.ip}`);
  next();
});

app.get('/', (req, res) => {
  res.send('MCP Server is running.');
});

app.use('/api/admin', express.json(), adminRoutes);
app.use('/webhooks', express.json(), webhookRoutes);

// --- MCP SSE Transport Setup ---
// Store active transports by sessionId
const transports = new Map<string, SSEServerTransport>();

app.get('/sse', async (req, res) => {
  logToMemory('New SSE connection attempt received');
  
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

  logToMemory(`Setting up transport with endpoint: ${endpointUrl}`);

  const server = createMcpServer();
  const transport = new SSEServerTransport(endpointUrl, res);
  
  // Connect the server to the transport
  logToMemory('Connecting server to transport...');
  await server.connect(transport);
  
  // 4. Send padding AFTER connection is established (headers sent) to bypass buffering
  // This is safe here because SSEServerTransport has already sent headers.
  res.write(': ' + ' '.repeat(2048) + '\n\n');

  const sessionId = (transport as any).sessionId;
  if (sessionId) {
    transports.set(sessionId, transport);
    logToMemory(`SSE Session created: ${sessionId}`);
  }

  // Cleanup on connection close
  res.on('close', () => {
    logToMemory(`SSE connection closed for session: ${sessionId}`);
    if (sessionId) {
      transports.delete(sessionId);
    }
  });
});

app.post('/messages', async (req, res) => {
  const sessionId = req.query.sessionId as string;
  logToMemory(`POST /messages received. SessionId: ${sessionId}`);
  logToMemory(`Request Readable: ${req.readable}, Complete: ${req.complete}`);
  
  if (!sessionId) {
    res.status(400).send('Missing sessionId parameter');
    return;
  }

  const transport = transports.get(sessionId);
  if (!transport) {
    logToMemory(`Session not found or expired: ${sessionId}`);
    res.status(404).send('Session not found or expired');
    return;
  }

  try {
    logToMemory('Handling POST message via transport...');
    await transport.handlePostMessage(req, res);
    logToMemory('POST message handled successfully');
  } catch (error: any) {
    logToMemory(`Error handling POST message: ${error.message}`);
    logToMemory(`Stack: ${error.stack}`);
    res.status(500).send(error.message);
  }
});
// -------------------------------

const startServer = async () => {
  try {
    // await startMcpServer(); // Removed: server is now created per connection
    logToMemory('MCP Server starting...');

    app.listen(PORT, () => {
      console.log(`Express server running on port ${PORT}`);
      logToMemory(`Express server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
