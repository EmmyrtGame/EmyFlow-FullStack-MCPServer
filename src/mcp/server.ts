import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// Create an MCP server
const server = new Server({
  name: "DentalClinicMCP",
  version: "1.0.0"
}, {
  capabilities: {
    tools: {}
  }
});

export const startMcpServer = async () => {
  // List Tools Handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "calendar_check_availability",
          description: "Check availability in Google Calendar",
          inputSchema: {
            type: "object",
            properties: {
              client_id: { type: "string" },
              start_time: { type: "string" },
              end_time: { type: "string" }
            },
            required: ["client_id", "start_time", "end_time"]
          }
        },
        {
          name: "calendar_create_appointment",
          description: "Create an appointment in Google Calendar",
          inputSchema: {
            type: "object",
            properties: {
              client_id: { type: "string" },
              patient_data: {
                type: "object",
                properties: {
                  nombre: { type: "string" },
                  telefono: { type: "string" },
                  email: { type: "string" },
                  motivo: { type: "string" }
                },
                required: ["nombre", "telefono", "email", "motivo"]
              },
              start_time: { type: "string" },
              end_time: { type: "string" }
            },
            required: ["client_id", "patient_data", "start_time", "end_time"]
          }
        },
        {
          name: "capi_send_event",
          description: "Send event to Meta CAPI",
          inputSchema: {
            type: "object",
            properties: {
              client_id: { type: "string" },
              event_name: { type: "string", enum: ["Lead", "Purchase", "Schedule"] },
              user_data: {
                type: "object",
                properties: {
                  phone: { type: "string" },
                  email: { type: "string" },
                  fbp: { type: "string" },
                  fbc: { type: "string" },
                  client_user_agent: { type: "string" },
                  client_ip_address: { type: "string" }
                }
              },
              event_source_url: { type: "string" },
              event_id: { type: "string" },
              action_source: { type: "string" }
            },
            required: ["client_id", "event_name", "user_data"]
          }
        },
        {
          name: "crm_handoff_human",
          description: "Handoff to human agent",
          inputSchema: {
            type: "object",
            properties: {
              client_id: { type: "string" },
              phone_number: { type: "string" }
            },
            required: ["client_id", "phone_number"]
          }
        }
      ]
    };
  });

  // Call Tool Handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (!args) {
      throw new McpError(ErrorCode.InvalidParams, "Missing arguments");
    }

    switch (name) {
      case "calendar_check_availability": {
        const { calendarCheckAvailability } = await import("../tools/calendar");
        return calendarCheckAvailability(args as any);
      }
      case "calendar_create_appointment": {
        const { calendarCreateAppointment } = await import("../tools/calendar");
        return calendarCreateAppointment(args as any);
      }
      case "capi_send_event": {
        const { capiSendEvent } = await import("../tools/marketing");
        return capiSendEvent(args as any);
      }
      case "crm_handoff_human": {
        const { crmHandoffHuman } = await import("../tools/crm");
        return crmHandoffHuman(args as any);
      }
      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  });

  // Connect via Stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
};
