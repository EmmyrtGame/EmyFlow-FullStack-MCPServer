import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createMcpServer } from './mcp/server';
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from 'crypto';
// import { clients } from './config/clients'; // Removed after refactor

dotenv.config();

import fs from 'fs';
import path from 'path';

// ============== CRASH LOGGING ==============
const CRASH_LOG_PATH = path.join(process.cwd(), 'crash.log');

const logCrash = (type: string, error: any) => {
  const timestamp = new Date().toISOString();
  const message = `
================== ${type} ==================
Time: ${timestamp}
Error: ${error?.message || error}
Stack: ${error?.stack || 'No stack trace'}
==============================================

`;
  console.error(`[CRASH] ${type}:`, error);
  
  try {
    fs.appendFileSync(CRASH_LOG_PATH, message);
  } catch (e) {
    console.error('Failed to write crash log:', e);
  }
};

// Catch uncaught exceptions
process.on('uncaughtException', (error) => {
  logCrash('UNCAUGHT_EXCEPTION', error);
  // Give time to write log before exit
  setTimeout(() => process.exit(1), 1000);
});

// Catch unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logCrash('UNHANDLED_REJECTION', reason);
});

// Log when process is about to exit
process.on('exit', (code) => {
  const msg = `[${new Date().toISOString()}] Process exiting with code: ${code}\n`;
  console.log(msg);
  try {
    fs.appendFileSync(CRASH_LOG_PATH, msg);
  } catch (e) {}
});

// Log SIGTERM/SIGINT
process.on('SIGTERM', () => {
  logCrash('SIGTERM', 'Process received SIGTERM signal');
});

process.on('SIGINT', () => {
  logCrash('SIGINT', 'Process received SIGINT signal');
});

console.log(`[${new Date().toISOString()}] Crash handlers initialized. Log file: ${CRASH_LOG_PATH}`);
// ============================================

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


// --- MCP Streamable HTTP Transport Setup ---
// Store active transports and servers by sessionId
const transports: Record<string, StreamableHTTPServerTransport> = {};
const mcpServers: Record<string, ReturnType<typeof createMcpServer>> = {};

// Helper to check if body looks like an initialize request
const handleMcpRequest = async (req: express.Request, res: express.Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  let transport: StreamableHTTPServerTransport;

  if (sessionId && transports[sessionId]) {
    // Existing session
    transport = transports[sessionId];
    logToMemory(`MCP request for existing session: ${sessionId}`);
  } else if (!sessionId && isInitializeRequest(req.body)) {
    // New session - create transport and server
    logToMemory('New MCP connection - initializing session');
    
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (newSessionId) => {
        transports[newSessionId] = transport;
        logToMemory(`MCP Session initialized: ${newSessionId}`);
      },
    });

    transport.onclose = () => {
      const sid = transport.sessionId;
      if (sid) {
        logToMemory(`MCP Session closed: ${sid}`);
        delete transports[sid];
        
        // Close the MCP server
        const mcpServer = mcpServers[sid];
        if (mcpServer) {
          mcpServer.close().catch((e) => {
            logToMemory(`Error closing MCP server: ${e}`);
          });
          delete mcpServers[sid];
        }
      }
    };

    const server = createMcpServer();
    await server.connect(transport);
    
    if (transport.sessionId) {
      mcpServers[transport.sessionId] = server;
    }
  } else {
    // Invalid request - no session and not an initialize request
    logToMemory(`Invalid MCP request: missing session ID or not an initialize request`);
    res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Bad Request: No valid session ID provided',
      },
      id: null,
    });
    return;
  }

  // Handle the request through the transport
  try {
    await transport.handleRequest(req, res, req.body);
  } catch (error: any) {
    logToMemory(`Error handling MCP request: ${error.message}`);
    logToMemory(`Stack: ${error.stack}`);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: error.message,
        },
        id: null,
      });
    }
  }
};

// Handle GET requests (for SSE streaming from server to client)
const handleMcpGet = async (req: express.Request, res: express.Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  
  if (!sessionId || !transports[sessionId]) {
    logToMemory(`Invalid MCP GET: missing or invalid session ID`);
    res.status(400).send('Invalid or missing session ID');
    return;
  }

  logToMemory(`MCP GET for session: ${sessionId}`);
  const transport = transports[sessionId];
  
  try {
    await transport.handleRequest(req, res);
  } catch (error: any) {
    logToMemory(`Error handling MCP GET: ${error.message}`);
    if (!res.headersSent) {
      res.status(500).send(error.message);
    }
  }
};

// Handle DELETE requests (to close sessions)
const handleMcpDelete = async (req: express.Request, res: express.Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  
  if (!sessionId || !transports[sessionId]) {
    logToMemory(`Invalid MCP DELETE: missing or invalid session ID`);
    res.status(400).send('Invalid or missing session ID');
    return;
  }

  logToMemory(`MCP DELETE for session: ${sessionId}`);
  const transport = transports[sessionId];
  
  try {
    await transport.handleRequest(req, res);
  } catch (error: any) {
    logToMemory(`Error handling MCP DELETE: ${error.message}`);
    if (!res.headersSent) {
      res.status(500).send(error.message);
    }
  }
};

// Single MCP endpoint - handles POST, GET, and DELETE
app.post('/mcp', express.json(), handleMcpRequest);
app.get('/mcp', handleMcpGet);
app.delete('/mcp', handleMcpDelete);

// Legacy endpoints for backwards compatibility (redirect to new endpoint)
app.get('/sse', (req, res) => {
  logToMemory('Legacy /sse endpoint called - redirecting info');
  res.status(410).json({
    error: 'SSE transport deprecated',
    message: 'Please use the new /mcp endpoint with Streamable HTTP transport',
    newEndpoint: '/mcp',
  });
});

app.post('/messages', (req, res) => {
  logToMemory('Legacy /messages endpoint called');
  res.status(410).json({
    error: 'SSE transport deprecated', 
    message: 'Please use the new /mcp endpoint with Streamable HTTP transport',
    newEndpoint: '/mcp',
  });
});
// -------------------------------

// Serve React App for any other route (SPA support)
app.get('*', (req, res) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/mcp') || req.path.startsWith('/webhooks')) {
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
        fs.appendFileSync('startup_error.log', `[${new Date().toISOString()}] Startup Error: ${error.stack || error}\n`);
    } catch (e) {
        console.error('Failed to write error log:', e);
    }
    process.exit(1);
  }
};

startServer();
