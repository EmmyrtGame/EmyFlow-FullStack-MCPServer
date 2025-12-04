# Requerimientos del Sistema MCP (Model Context Protocol) - V1.0

**Objetivo:** Centralizar la lógica de negocio de múltiples clientes (Clínicas Dentales) en un servidor MCP eficiente alojado en Hostinger (Node.js/TypeScript), reduciendo costos de operaciones en Make.com y eliminando la gestión manual de OAuth.

---

## 1. Arquitectura General
El sistema funcionará como un **Servidor MCP Multitenant**.
- **Entrada:** Peticiones via Protocolo MCP (desde Agentes de Make o Claude) o Webhooks HTTP (desde Wassenger).
- **Router Central:** Un middleware identificará al cliente (ej. `client_id="white-dental"`) y cargará dinámicamente la configuración y credenciales correspondientes.
- **Base de Datos:** (Opcional para V1, recomendado V2) SQLite/JSON local para configuraciones rápidas de clientes.

---

## 2. Herramientas MCP a Desarrollar (Tools)
Estas herramientas reemplazarán a los escenarios complejos de Make.

### 2.1. Tool: `calendar_check_availability`
**Reemplaza:** *Verificar-Disponibilidad-Google-Calendar-2.0*
*   **Descripción:** Verifica si un horario específico está libre en el calendario del doctor.
*   **Inputs:**
    *   `client_id` (string): Identificador del cliente (ej. "white_dental").
    *   `start_time` (string ISO8601): Fecha inicio deseada.
    *   `end_time` (string ISO8601): Fecha fin deseada.
*   **Lógica Interna:**
    1.  Carga el JSON de Service Account de Google asociado al `client_id`.
    2.  Obtiene el `calendar_id` de la configuración del cliente.
    3.  Ejecuta `events.list` en Google Calendar API buscando solapamientos.
*   **Output:** JSON simple `{ "available": true }` o `{ "available": false, "conflicts": [...] }`.
*   **Mejora vs Make:** Evita gastar operaciones en iteradores y agregadores de Make. Todo el cálculo de fechas se hace en milisegundos en Node.js.

### 2.2. Tool: `calendar_create_appointment`
**Reemplaza:** *Agendar-Google-Calendar*
*   **Descripción:** Crea la cita, pero ahora con lógica de validación interna más robusta.
*   **Inputs:**
    *   `client_id` (string)
    *   `patient_data` (object): { nombre, telefono, email, motivo }
    *   `start_time` (string)
    *   `end_time` (string)
*   **Lógica Interna:**
    1.  Re-verifica disponibilidad (doble check de seguridad).
    2.  Crea el evento usando la Service Account.
    3.  **(Optimización)** Dispara internamente el mensaje de confirmación de WhatsApp (Wassenger) vía API HTTP directa, ahorrando una llamada de regreso a Make.

### 2.3. Tool: `capi_send_event`
**Reemplaza:** *Eventos-CAPI*
*   **Descripción:** Envía eventos de conversión a Meta (Facebook Ads).
*   **Inputs:**
    *   `client_id` (string)
    *   `event_name` (enum: "Lead", "Purchase", "Schedule")
    *   `user_data` (object): { phone, email, fbp, fbc }
*   **Lógica Interna:**
    1.  Carga el `pixel_id` y `access_token` (System User Token) del cliente.
    2.  Hash de datos PII (emails/teléfonos) con SHA256 (requerido por Meta) automáticamente.
    3.  Envía POST a Graph API.

### 2.4. Tool: `crm_handoff_human`
**Reemplaza:** *Transferir-a-Humano*
*   **Descripción:** Etiqueta al usuario en Wassenger/CRM para detener al bot.
*   **Inputs:**
    *   `client_id` (string)
    *   `phone_number` (string)
*   **Lógica:**
    1.  Llama a API de Wassenger endpoint `/labels`.
    2.  Añade etiqueta "humano".

---

## 3. Endpoints HTTP (Para Webhooks de Entrada)
El servidor MCP también actuará como servidor web Express tradicional para recibir datos.

### 3.1. Endpoint: `POST /webhooks/whatsapp`
**Reemplaza:** *Receptor-de-Mensajes* y *Agente-de-Sonrisa (Lógica de buffer)*
*   **Funcionalidad:**
    *   Recibe el webhook de Wassenger.
    *   **Lógica de Buffer Inteligente (Node.js):**
        *   En lugar de usar Data Stores de Make (lentos/caros), usa una cola en memoria o Redis/SQLite simple.
        *   Agrupa mensajes seguidos del mismo usuario en una ventana de 2-3 segundos.
    *   **Disparador:** Una vez agrupado el mensaje completo, llama **una sola vez** al Agente de IA en Make (webhook de entrada del agente).
*   **Beneficio:** Si el usuario escribe "Hola" (enter) "Quiero cita" (enter), Make cobra 2 ejecuciones. Con este buffer en Node, Make solo recibe 1 ejecución con "Hola. Quiero cita". **Ahorro del 50% de costos.**

---

## 4. Estructura de Configuración (Modularidad)
Archivo `src/config/clients.ts`:
export const clients = {
"white_dental": {
google: {
serviceAccountPath: "./creds/white_dental_gcal.json",
calendarId: "whitedental262@gmail.com"
},
meta: {
pixelId: "123456789",
accessToken: process.env.WHITE_DENTAL_META_TOKEN
},
wassenger: {
apiKey: process.env.WHITE_DENTAL_WASSENGER_TOKEN,
deviceId: "68fd1067b488de07029fccc2"
}
},
"arte_dental": {
// Configuración análoga...
}
}

## 5. Tecnologías Requeridas
*   **Runtime:** Node.js 20+ (Compatible con Hostinger Cloud Startup).
*   **Lenguaje:** TypeScript.
*   **Librerías Clave:**
    *   `@modelcontextprotocol/sdk`: SDK oficial.
    *   `googleapis`: Para Calendar.
    *   `axios`: Para peticiones HTTP (Meta/Wassenger).
    *   `express`: Servidor web.
    *   `crypto`: Para hashear datos de CAPI.

## 6. Entregables
1.  Scripts de build (`npm run build`) configurados.
2.  Guía de despliegue en Hostinger (carpeta `public_html`).