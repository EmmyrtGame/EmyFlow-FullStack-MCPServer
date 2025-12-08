import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from "@modelcontextprotocol/sdk/types.js";

/**
 * Creates and configures a new MCP server instance.
 */
export const createMcpServer = () => {
  // Create a new MCP server instance
  const server = new Server({
    name: "DentalClinicMCP",
    version: "1.0.0"
  }, {
    capabilities: {
      tools: {}
    }
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "calendar_check_availability",
          description: "Check availability in the clinic's calendar. Can check a specific time slot (start_time, end_time) OR a full day's agenda (query_date). Returns available slots or conflict details.",
          inputSchema: {
            type: "object",
            properties: {
              client_id: { type: "string", description: "The unique identifier for the dental clinic (e.g., 'dental_clinic_a'). MUST use the ID provided in the current context. DO NOT GUESS or hallucinate." },
              start_time: { type: "string", description: "Optional. Start time of the slot to check (ISO string)." },
              end_time: { type: "string", description: "Optional. End time of the slot to check (ISO string)." },
              query_date: { type: "string", description: "Optional. Date to check the full day's agenda (YYYY-MM-DD or ISO string)." }
            },
            required: ["client_id"]
          }
        },
        {
          name: "calendar_create_appointment",
          description: "Schedule and confirm a new appointment. REQUIRES collecting all patient data (name, phone, email, reason) first. Will fail if the slot is no longer available.",
          inputSchema: {
            type: "object",
            properties: {
              client_id: { type: "string", description: "The unique identifier for the dental clinic (e.g., 'dental_clinic_a'). MUST use the ID provided in the current context. DO NOT GUESS or hallucinate." },
              patient_data: {
                type: "object",
                properties: {
                  nombre: { type: "string", description: "Patient's full name" },
                  telefono: { type: "string", description: "Patient's phone number" },
                  email: { type: "string", description: "Patient's email address" },
                  motivo: { type: "string", description: "Reason for the appointment" }
                },
                required: ["nombre", "telefono", "email", "motivo"]
              },
              start_time: { type: "string", description: "Start time of the appointment (ISO string)" },
              end_time: { type: "string", description: "End time of the appointment (ISO string)" }
            },
            required: ["client_id", "patient_data", "start_time", "end_time"]
          }
        },
        {
          name: "crm_handoff_human",
          description: "Immediately transfer the conversation to a human agent.",
          inputSchema: {
            type: "object",
            properties: {
              client_id: { type: "string", description: "The unique identifier for the dental clinic (e.g., 'dental_clinic_a'). MUST use the ID provided in the current context. DO NOT GUESS or hallucinate." },
              phone_number: { type: "string", description: "The user's phone number to tag." }
            },
            required: ["client_id", "phone_number"]
          }
        }
      ]
    };
  });


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
      case "crm_handoff_human": {
        const { crmHandoffHuman } = await import("../tools/crm");
        return crmHandoffHuman(args as any);
      }
      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  });

  return server;
};

