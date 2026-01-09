# Roadmap de Optimización Meta CAPI & Estrategia - EmyWeb Studio

> **Documento Vivo:** Este archivo sirve como contexto estratégico y técnico para futuras implementaciones de IA y como referencia para la toma de decisiones de marketing.

---

## 1. Contexto del Negocio y Arquitectura
**Negocio:** EmyWeb Studio (Agencia de Automatización IA para Clínicas Dentales/High-Ticket).
**Flujo de Venta:**
1.  **Lead Origin:** Facebook/Instagram Ads (Click-to-WhatsApp).
2.  **Recepción:** Servidor HTTP propio (recibe Webhooks de Wassenger).
3.  **Gestión:** Agente IA (impulsado por MCP Server) atiende al paciente en WhatsApp.
4.  **Conversión:** La IA agenda una cita en Google Calendar.
5.  **Cierre:** Venta presencial en consultorio ($$$ High Ticket).

**Infraestructura Técnica:**
*   **Wassenger:** Gateway de WhatsApp API no oficial.
*   **Servidor HTTP:** Endpoint de entrada de mensajes.
*   **MCP Server (Model Context Protocol):** Herramientas para la IA (Calendar, CRM, Marketing CAPI).
*   **Base de Datos:** (Implícito) Gestión de clientes y estados.

---

## 2. Diagnóstico Actual (El Problema)

### A. Baja Calidad de Coincidencia (EMQ ~2.5/10)
*   **Atribución Débil:** Al ser una conversión 100% nativa de WhatsApp (sin pasar por web), **NO existen cookies de navegador** (`fbp`, `fbc`).
*   **Datos Limitados:** Actualmente solo se envía el `teléfono` a Meta CAPI.
*   **Consecuencia:** Meta pierda el rastro de +60% de las conversiones reales. El algoritmo "aprende lento" porque está ciego ante la mayoría de los éxitos.

### B. Estrategia de Campaña Limitada
*   **Actual:** Objetivo "Interacción" > Optimización "Conversaciones".
*   **Resultado:** Alto volumen de curiosos, baja calidad de pacientes.
*   **Objetivo:** Migrar a Objetivo "Ventas" > Optimización "Schedule".
*   **Bloqueo:** Para que "Ventas" funcione con bajo volumen (15 citas/semana), el EMQ debe subir drásticamente para aprovechar cada dato al máximo.

---

## 3. Solución Estratégica: "High-Fidelity CAPI" (Sin Cookies)

Dado que no podemos obtener cookies (`fbp`/`fbc`) sin friccionar al usuario con una landing page, la única vía es **maximizar los datos "Zero-Party"** (datos que el usuario nos da voluntariamente en el chat).

### Plan de Acción Técnico (MCP Server)
Actualizar `marketing.ts` y la lógica del Agente IA para capturar y enviar estos "Match Keys":

| Dato | Prioridad | Obtención | Requisito Técnico (CAPI) |
| :--- | :--- | :--- | :--- |
| **Email** | ALTA (Game Changer) | IA lo pide proactivamente ("Para enviarte la confirmación...") | SHA-256 Hash, minúsculas. |
| **Nombre** | ALTA | IA lo pide ("¿Con quién tengo el gusto?") | SHA-256 Hash, minúsculas, sin acentos. |
| **Apellido** | MEDIA | Inferido del nombre completo | SHA-256 Hash. |
| **País** | MEDIA | Inferido del código de país (+52) | Código ISO 3166-1 (ej. 'mx'), SHA-256 Hash. |
| **Teléfono**| BASICA | Ya se tiene (Wassenger) | SHA-256 Hash, sin símbolos. |

> **Meta:** Subir el EMQ de ~2.5 a **~6.0-7.0**. Esto hará que 15 citas semanales tengan el peso algorítmico de 30-40 citas mal atribuidas.

---

## 4. Estrategia Operativa: "Anti No-Shows" (Retención)
*Problema:* Optimizar por `Schedule` trae volumen, pero riesgo de inasistencia.
*Solución:* No filtrar en el Anuncio (daña el algoritmo), filtrar en la **Confirmación**.

### Tácticas de "Micro-Compromisos" (Sin Depósito)
1.  **Regla de las 72 Horas:** La IA solo debe permitir agendar con máximo 3-4 días de anticipación.
    *   *Dato:* Citas a +7 días tienen 50% más tasa de caída.
2.  **El "Gancho" de Valor:**
    *   Al agendar, la IA envía un PDF/Video corto: "5 cosas que debes saber antes de tu implante".
    *   *Psicología:* Si el usuario consume contenido, siente que ya "invirtió" tiempo.
3.  **Confirmación Escalonada (AI Script):**
    *   **Inmediato:** Mensaje con ubicación + "Agendado".
    *   **24h antes:** "¿Sigues disponible? Tengo lista de espera." (Genera escasez).
    *   **Mañana de la cita:** "El Dr. ya preparó tu expediente".

---

## 5. Nueva Estrategia de Campaña (El "Golden Path")

Una vez implementada la mejora técnica, la estrategia de Meta Ads será:

1.  **Objetivo:** **Ventas** (Sales).
2.  **Destino:** Apps de Mensajería (WhatsApp).
3.  **Evento de Conversión:** **`Schedule`** (Programar).
4.  **Atribución:** 7 días click / 1 día view.
5.  **Seguridad de Calidad:**
    *   **Filtro Natural:** La IA actúa como barrera. Solo dispara `Schedule` cuando hay día/hora confirmada.
    *   **Filtro de Datos:** Al pedir Email/Nombre, se filtra a los usuarios con baja intención.
    *   **Timing:** **Tiempo Real (Booking).** No esperar a la confirmación 24h antes.
        *   *¿Por qué?* El algoritmo necesita feedback inmediato (<1h) para aprender. Retrasar el evento 24h+ rompe el ciclo de aprendizaje y puede impedir salir de la "Fase de Aprendizaje".

### ¿Por qué NO "Purchase"?
*   **Volumen:** Con 15 citas/semana, apenas llegamos al mínimo técnico. Las ventas reales (<10) son insuficientes para que el algoritmo optimice.
*   **Rol de 'Purchase':** Se seguirá enviando por CAPI solo para **reportes de ROAS** y creación de **Audiencias Lookalike** (LAL) de alto valor.

---

## 5. Próximos Pasos (Roadmap de Implementación)

- [ ] **Fase 1: Preparación del Agente** (Prompt Engineering)
    - Instruir a la IA para que sea **obligatorio** pedir Nombre y (muy recomendado) Email antes de confirmar la cita.

- [x] **Fase 2: Actualización de `marketing.ts`** ✅ COMPLETADO
    - [x] Modificar `trackScheduleEvent` para aceptar `email`, `firstName`, `lastName`, `country`.
    - [x] Implementar normalización (trim, lowercase) y Hashing SHA-256.
    - [x] Mapear estos datos al payload de Facebook.
    - [x] Actualizar MCP Server (`server.ts`) con schema de country codes (ISO 3166-1).
    - [x] Test exitoso: `events_received: 1` con test_event_code `TEST65570`.

- [ ] **Fase 3: Ejecución de Campaña**
    - Lanzar campaña "Ventas - Schedule" en Meta Ads.
    - Monitorear el "Event Match Quality" en el Administrador de Eventos (debe subir en 48h).
