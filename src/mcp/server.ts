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
    name: "EmyFlowMCP",
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
              query_date: { type: "string", description: "Optional. Date to check the full day's agenda (YYYY-MM-DD or ISO string)." },
              sede: { type: "string", description: "Optional. The specific location ID (e.g., 'satellite_office') to check availability for. If omitted, checks the default location." }
            },
            required: ["client_id"]
          }
        },
        {
          name: "calendar_create_appointment",
          description: "Schedule and confirm a new appointment. REQUIRES collecting patient data (name, phone) first. Optionally collect email for better attribution. Will fail if the slot is no longer available.",
          inputSchema: {
            type: "object",
            properties: {
              client_id: { type: "string", description: "The unique identifier for the dental clinic (e.x., 'dental_clinic_a'). MUST use the ID provided in the current context. DO NOT GUESS or hallucinate." },
              patient_data: {
                type: "object",
                properties: {
                  nombre: { type: "string", description: "Patient's full name" },
                  telefono: { type: "string", description: "Patient's phone number" },
                  email: { type: "string", description: "Optional. Patient's email address. Highly recommended for marketing attribution." },
                  country: { 
                    type: "string", 
                    description: "Optional. ISO 3166-1 alpha-2 country code (2 lowercase letters). Infer from phone country code. Examples: '+52' -> 'mx' (Mexico), '+1' -> 'us' (USA), '+34' -> 'es' (Spain), '+57' -> 'co' (Colombia), '+54' -> 'ar' (Argentina), '+56' -> 'cl' (Chile)." 
                  }
                },
                required: ["nombre", "telefono"]
              },
              start_time: { type: "string", description: "Start time of the appointment (ISO string)" },
              end_time: { type: "string", description: "End time of the appointment (ISO string)" },
              description: { type: "string", description: "Description for the calendar event. Should include patient contact info (phone) and any other notes." },
              sede: { type: "string", description: "Optional. The specific location ID to book the appointment at. If omitted, uses the default location." }
            },
            required: ["client_id", "patient_data", "start_time", "end_time", "description"]
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

