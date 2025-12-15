import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createMcpServer } from './mcp/server';
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
// import { clients } from './config/clients'; // Removed after refactor

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



app.use('/api/admin', express.json(), adminRoutes);
app.use('/webhooks', express.json(), webhookRoutes);

// --- Serve Frontend in Production ---
import path from 'path';
import fs from 'fs';

const frontendDist = path.join(__dirname, '../frontend/dist');
// In ts-node (src), __dirname is src/
// In build (dist), __dirname is dist/
// Standard Build struct: root/dist/index.js AND root/frontend/dist

// Let's assume standard structure relative to process.cwd() or safer checks.
// Actually, 'express.static' is robust.
// If running from root: 'frontend/dist'
app.use(express.static('frontend/dist'));

// For SPA routing, send index.html for unknown non-API routes
// Place this AFTER API routes
// app.get('*', ...) logic is below


// --- MCP SSE Transport Setup ---
// Store active transports and servers by sessionId
const transports = new Map<string, SSEServerTransport>();
const mcpServers = new Map<string, ReturnType<typeof createMcpServer>>();

app.get('/sse', async (req, res) => {
  logToMemory('New SSE connection attempt received');
  
  // 1. Set headers manually to ensure correct SSE setup and anti-buffering
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // For Nginx/Hostinger
  
  // 3. Construct Absolute URL for the endpoint
  const endpointUrl = `https://slategray-baboon-146694.hostingersite.com/messages`;

  logToMemory(`Setting up transport with endpoint: ${endpointUrl}`);

  const server = createMcpServer();
  const transport = new SSEServerTransport(endpointUrl, res);
  
  // Connect the server to the transport
  logToMemory('Connecting server to transport...');
  await server.connect(transport);
  
  // Send padding AFTER connection is established to bypass buffering
  res.write(': ' + ' '.repeat(2048) + '\n\n');

  const sessionId = (transport as any).sessionId;
  if (sessionId) {
    transports.set(sessionId, transport);
    mcpServers.set(sessionId, server);
    logToMemory(`SSE Session created: ${sessionId}`);
  }

  // Cleanup on connection close - PROPERLY close MCP server
  res.on('close', async () => {
    logToMemory(`SSE connection closed for session: ${sessionId}`);
    if (sessionId) {
      transports.delete(sessionId);
      
      // Close the MCP server to release resources
      const mcpServer = mcpServers.get(sessionId);
      if (mcpServer) {
        try {
          await mcpServer.close();
          logToMemory(`MCP Server closed for session: ${sessionId}`);
        } catch (e) {
          logToMemory(`Error closing MCP server: ${e}`);
        }
        mcpServers.delete(sessionId);
      }
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

// Serve React App for any other route (SPA support)
app.get('*', (req, res) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/sse') || req.path.startsWith('/webhooks')) {
      return res.status(404).send('Not Found');
  }
  const indexHtml = path.join(frontendDist, 'index.html');
  if (fs.existsSync(indexHtml)) {
      res.sendFile(indexHtml);
  } else {
      res.send('EmyFlow API Running. (Frontend build not found in dist)');
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
  } catch (error: any) {
    console.error('Failed to start server:', error);
    try {
        const fs = require('fs');
        fs.appendFileSync('startup_error.log', `[${new Date().toISOString()}] Startup Error: ${error.stack || error}\n`);
    } catch (e) {
        console.error('Failed to write error log:', e);
    }
    process.exit(1);
  }
};

startServer();
