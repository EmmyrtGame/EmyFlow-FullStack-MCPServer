# DOCUMENTO DE REQUERIMIENTOS - Admin Panel MCP Dental

## Versión 1.0 - Sistema de Gestión de Clientes Multitenant


***

## 1. RESUMEN EJECUTIVO

El sistema actualmente funciona como un servidor MCP multitenant para clínicas dentales con configuración hardcodeada en archivos TypeScript. Esta mejora agregará un **Admin Panel Web** que permitirá gestionar clientes mediante operaciones CRUD sin necesidad de modificar código, con autenticación segura y persistencia en base de datos.

***

## 2. OBJETIVOS DEL PROYECTO

### 2.1. Objetivo Principal

Crear una interfaz administrativa web profesional que centralice la gestión completa de configuraciones de clientes dentales, eliminando la dependencia de edición manual de código fuente.

### 2.2. Objetivos Específicos

- Implementar autenticación segura con JWT y gestión de sesiones
- Desarrollar CRUD completo para clientes con validaciones robustas
- Migrar configuraciones desde archivos TypeScript a base de datos
- Crear interfaz responsive y moderna con experiencia de usuario óptima
- Establecer arquitectura escalable para futuras funcionalidades
- Garantizar seguridad en almacenamiento de credenciales sensibles

***

## 3. ARQUITECTURA TÉCNICA

### 3.1. Stack Tecnológico

**Backend:**

- Node.js 20+ / TypeScript
- Express.js (servidor HTTP existente)
- Base de datos: **SQLite** (desarrollo/producción ligera) o **PostgreSQL** (producción robusta)
- ORM: **Prisma** (type-safe, migraciones automáticas)
- Autenticación: **JWT** + bcrypt
- Validación: **Zod** o **Joi**

**Frontend:**

- Framework: **React 18+** con Vite (build rápido)
- UI Library: **Shadcn/ui** + Tailwind CSS (componentes modernos)
- Estado: **Zustand** o **Context API** (ligero)
- Forms: **React Hook Form** + Zod (validación client-side)
- HTTP Client: **Axios** con interceptors

**Despliegue:**

- Backend: Hostinger Cloud (Node.js app existente)
- Frontend: Build estático servido por Express (`public/` folder)
- Almacenamiento de credenciales: Variables de entorno + cifrado AES-256


### 3.2. Estructura de Carpetas Propuesta

```
mpc_emyweb_dental/
├── src/
│   ├── admin/                    # Nuevo módulo admin
│   │   ├── controllers/          # Lógica de negocio
│   │   │   ├── auth.controller.ts
│   │   │   └── clients.controller.ts
│   │   ├── middleware/           # Auth guards
│   │   │   ├── auth.middleware.ts
│   │   │   └── validation.middleware.ts
│   │   ├── routes/               # Endpoints API REST
│   │   │   ├── auth.routes.ts
│   │   │   └── clients.routes.ts
│   │   └── services/             # Capa de acceso a datos
│   │       ├── auth.service.ts
│   │       └── clients.service.ts
│   ├── db/                       # Configuración base de datos
│   │   ├── prisma/
│   │   │   ├── schema.prisma     # Modelo de datos
│   │   │   └── migrations/
│   │   └── seed.ts               # Datos iniciales (admin user)
│   ├── utils/                    # Utilidades compartidas
│   │   ├── crypto.util.ts        # Cifrado de credenciales
│   │   ├── jwt.util.ts           # Generación/verificación tokens
│   │   └── validators.util.ts    # Esquemas de validación
│   └── index.ts                  # Actualizar para incluir rutas admin
├── frontend/                     # Nueva carpeta frontend
│   ├── public/
│   ├── src/
│   │   ├── components/           # Componentes reutilizables
│   │   │   ├── ui/               # Shadcn components
│   │   │   ├── Layout.tsx
│   │   │   ├── ClientForm.tsx
│   │   │   └── ClientList.tsx
│   │   ├── pages/                # Vistas principales
│   │   │   ├── Login.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   └── ClientEditor.tsx
│   │   ├── services/             # API calls
│   │   │   └── api.ts
│   │   ├── hooks/                # Custom hooks
│   │   │   └── useAuth.ts
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
└── package.json
```


***

## 4. MODELO DE DATOS

### 4.1. Esquema Prisma (src/db/prisma/schema.prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"  // Cambiar a "postgresql" en producción
  url      = env("DATABASE_URL")
}

model Admin {
  id        String   @id @default(cuid())
  username  String   @unique
  password  String   // Hash bcrypt
  email     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Client {
  id        String   @id @default(cuid())
  slug      String   @unique  // Ej: "white_dental"
  name      String              // Nombre visible
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  // Configuraciones anidadas (JSON)
  google          Json  // { serviceAccountPath, availabilityCalendars, bookingCalendarId }
  meta            Json  // { pixelId, accessToken }
  wassenger       Json  // { apiKey, deviceId }
  location        Json  // { address, mapUrl }
  locations       Json? // Múltiples sedes (opcional)
  reminderTemplates Json  // { "24h", "3h", "1h" }
  
  // Metadatos
  timezone              String  @default("America/Mexico_City")
  availabilityStrategy  String  @default("PER_LOCATION") // GLOBAL | PER_LOCATION
}

model ServiceAccount {
  id          String   @id @default(cuid())
  clientId    String   // FK a Client.id
  fileName    String   // Nombre del archivo (ej: "white_dental_gcal.json")
  encryptedContent String @db.Text // Contenido cifrado AES-256
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@unique([clientId, fileName])
}
```


### 4.2. Migración de Datos Inicial

Script `src/db/seed.ts` que:

1. Importa clientes desde `src/config/clients.ts`
2. Crea registros en la tabla `Client`
3. Mueve archivos de Service Account a `ServiceAccount` table cifrados
4. Crea usuario admin inicial con password temporal

***

## 5. API REST - ENDPOINTS

### 5.1. Autenticación

**POST /api/admin/auth/login**

- Request: `{ username: string, password: string }`
- Response: `{ token: string, expiresIn: number }`
- Status: 200 OK | 401 Unauthorized

**POST /api/admin/auth/logout**

- Headers: `Authorization: Bearer <token>`
- Response: `{ message: "Logged out successfully" }`

**GET /api/admin/auth/me**

- Headers: `Authorization: Bearer <token>`
- Response: `{ username: string, email: string }`


### 5.2. Gestión de Clientes

**GET /api/admin/clients**

- Params: `?page=1&limit=10&search=white&isActive=true`
- Response:

```json
{
  "data": [
    {
      "id": "cli_123abc",
      "slug": "white_dental",
      "name": "White Dental Clinic",
      "isActive": true,
      "timezone": "America/Mexico_City",
      "createdAt": "2025-12-01T00:00:00Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10
  }
}
```

**GET /api/admin/clients/:id**

- Response: Objeto `Client` completo con todas las configuraciones

**POST /api/admin/clients**

- Request: Objeto completo de configuración del cliente
- Validaciones:
    - `slug` único, alfanumérico con guiones bajos
    - `pixelId` numérico
    - Emails válidos en formato correcto
    - URLs de mapas válidas
- Response: Cliente creado con status 201

**PUT /api/admin/clients/:id**

- Request: Campos parciales o completos del cliente
- Response: Cliente actualizado

**DELETE /api/admin/clients/:id**

- Soft delete: Marca `isActive = false`
- Response: 204 No Content

**POST /api/admin/clients/:id/service-account**

- Request: `multipart/form-data` con archivo JSON de Service Account
- Proceso:

1. Valida formato JSON de Google Cloud
2. Cifra contenido con AES-256
3. Guarda en tabla `ServiceAccount`
- Response: `{ fileName: string, uploadedAt: string }`

***

## 6. FRONTEND - ESPECIFICACIONES UX/UI

### 6.1. Página de Login

- Centrado vertical/horizontal
- Campos: username, password
- Checkbox "Recordarme" (refresh token)
- Mensaje de error elegante
- Loading state en botón


### 6.2. Dashboard Principal

- Sidebar con navegación:
    - 📊 Dashboard
    - 👥 Clientes (activa por defecto)
    - ⚙️ Configuración
    - 🚪 Cerrar Sesión
- Header con breadcrumbs y usuario logueado
- Tabla de clientes con:
    - Columnas: Nombre, Slug, Estado (badge), Fecha creación, Acciones
    - Filtros: Búsqueda en tiempo real, Estado activo/inactivo
    - Paginación: 10/25/50 por página
    - Botón "+ Nuevo Cliente" (primario, esquina superior derecha)


### 6.3. Formulario de Cliente (Modal o Página)

**Estructura en pestañas/acordeón:**

**Tab 1: Información General**

- Nombre del cliente (text)
- Slug (text, auto-generado desde nombre, editable)
- Zona horaria (select con zonas de México)
- Estado activo (toggle)

**Tab 2: Google Calendar**

- Service Account (file upload con preview del nombre actual)
- Calendarios de disponibilidad (chips con input para agregar nuevos)
- Calendario de reservas (select de calendarios agregados)
- Estrategia de disponibilidad (radio: Global / Por Sede)

**Tab 3: Meta / Facebook Ads**

- Pixel ID (text, solo números)
- Access Token (text, tipo password con botón "Mostrar")

**Tab 4: Wassenger / WhatsApp**

- API Key (password field)
- Device ID (text)

**Tab 5: Ubicación(es)**

- Dirección principal (textarea)
- URL de Google Maps (text con validación de URL)
- Sedes adicionales (array de objetos, botón "+ Agregar Sede"):
    - Nombre de sede
    - Calendarios específicos
    - Dirección y mapa

**Tab 6: Plantillas de Recordatorios**

- Editor de texto para cada plantilla (24h, 3h, 1h)
- Variables disponibles mostradas como chips: `{{patient_name}}`, `{{time}}`, etc.
- Preview en tiempo real

**Botones de acción:**

- "Cancelar" (secundario)
- "Guardar" (primario, con loading state)
- Validación en tiempo real con mensajes de error contextuales


### 6.4. Estados de la UI

- **Loading:** Skeletons en tabla y formularios
- **Empty State:** Ilustración + mensaje "No hay clientes registrados"
- **Error:** Toast notifications (Sonner library)
- **Success:** Confirmación con ✅ y auto-cierre

***

## 7. SEGURIDAD

### 7.1. Autenticación y Autorización

- **Passwords:** Hash con bcrypt (salt rounds: 12)
- **JWT:**
    - Secret aleatorio de 64 caracteres en `.env`
    - Expiración: 24h (access token)
    - Refresh token: 7 días (opcional V1.1)
- **Middleware:** Verificar token en todas las rutas `/api/admin/*` excepto `/login`
- **Rate Limiting:** 5 intentos de login fallidos = bloqueo 15 minutos


### 7.2. Cifrado de Credenciales

- **Service Accounts y tokens:** Cifrado AES-256-GCM
- **Clave maestra:** Variable `ENCRYPTION_KEY` en `.env` (generar con `crypto.randomBytes(32)`)
- **Archivos sensibles:** Nunca almacenar en texto plano en DB o filesystem


### 7.3. Validaciones Backend

- Sanitización de inputs con `express-validator`
- Protección CSRF (considerar para V1.1)
- CORS configurado solo para dominios autorizados
- Headers de seguridad (Helmet.js)

***

## 8. MIGRACIÓN Y COMPATIBILIDAD

### 8.1. Estrategia de Migración

**Fase 1 (Transición):**

- Sistema actual lee de `src/config/clients.ts`
- Admin panel escribe en base de datos
- Función helper `getClientConfig(slug)` intenta DB primero, luego fallback a archivo

**Fase 2 (Producción):**

- Ejecutar script de migración completa
- Eliminar `clients.ts` del código
- Toda lectura desde base de datos


### 8.2. Script de Migración

```typescript
// src/db/migrate-clients.ts
import { clients } from '../config/clients';
import { prisma } from './prisma-client';
import { encryptServiceAccount } from '../utils/crypto.util';

export async function migrateClients() {
  for (const [slug, config] of Object.entries(clients)) {
    // Crear cliente en DB
    await prisma.client.create({
      data: {
        slug,
        name: slug.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        google: config.google,
        meta: config.meta,
        // ... resto de campos
      }
    });
    
    // Cifrar y guardar Service Account
    const accountContent = await fs.readFile(config.google.serviceAccountPath);
    await prisma.serviceAccount.create({
      data: {
        clientId: client.id,
        fileName: path.basename(config.google.serviceAccountPath),
        encryptedContent: encryptServiceAccount(accountContent)
      }
    });
  }
}
```


***

## 9. DESPLIEGUE EN HOSTINGER

### 9.1. Requisitos del Servidor

- Node.js 20+
- Espacio: ~200MB (build frontend + node_modules)
- Memoria: 512MB mínimo
- Puerto personalizado o 3000 (configurar proxy en Apache)


### 9.2. Proceso de Deploy

**1. Build del Frontend:**

```bash
cd frontend
npm run build
# Output: frontend/dist/
```

**2. Configurar Express para servir frontend:**

```typescript
// src/index.ts
import path from 'path';
app.use('/admin', express.static(path.join(__dirname, '../frontend/dist')));
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});
```

**3. Variables de Entorno (.env en servidor):**

```
NODE_ENV=production
PORT=3000
DATABASE_URL=file:./db/production.db  # SQLite o postgres://...
JWT_SECRET=<64-char-random-string>
ENCRYPTION_KEY=<32-byte-hex-string>

# Mantener las existentes:
WHITE_DENTAL_META_TOKEN=...
WHITE_DENTAL_WASSENGER_TOKEN=...
```

**4. Subir archivos:**

```bash
# Conectar vía SSH o FTP
rsync -avz --exclude node_modules dist/ usuario@hostinger:/ruta/app/
```

**5. Instalar dependencias y ejecutar:**

```bash
cd /ruta/app
npm install --production
npx prisma migrate deploy
npm start
```

**6. Configurar PM2 (process manager):**

```bash
npm install -g pm2
pm2 start dist/index.js --name mpc-dental
pm2 startup
pm2 save
```


### 9.3. Subdominios Sugeridos

- Backend MCP: `api.dentalapp.tudominio.com`
- Admin Panel: `admin.dentalapp.tudominio.com` (o `/admin` en el mismo dominio)

***

## 10. PLAN DE DESARROLLO - SPRINTS

### Sprint 1 (Semana 1): Fundación Backend

**Entregables:**

- Configurar Prisma y esquema de base de datos
- Implementar autenticación (login/logout/middleware)
- Script de seed para admin inicial
- Endpoint GET /api/admin/clients (listar)

**Criterios de aceptación:**

- Login funcional retorna JWT válido
- Lista de clientes desde DB (migrar 1 cliente de prueba)

***

### Sprint 2 (Semana 2): CRUD Completo + Cifrado

**Entregables:**

- Endpoints POST, PUT, DELETE de clientes
- Sistema de cifrado de Service Accounts
- Validaciones con Zod
- Script de migración completo

**Criterios de aceptación:**

- CRUD probado con Postman/Insomnia
- Service Account cifrado y descifrado correctamente

***

### Sprint 3 (Semana 3): Frontend Base

**Entregables:**

- Setup de Vite + React + Shadcn/ui
- Página de Login conectada al backend
- Layout base con sidebar y header
- Tabla de clientes con filtros

**Criterios de aceptación:**

- Login guarda token en localStorage
- Tabla renderiza clientes desde API

***

### Sprint 4 (Semana 4): Formulario y Finalización

**Entregables:**

- Formulario completo de cliente (6 tabs)
- Upload de Service Account
- Validaciones client-side
- Estados de loading/error/success

**Criterios de aceptación:**

- Crear y editar cliente funcional end-to-end
- UX responsive en móvil y desktop

***

### Sprint 5 (Semana 5): Despliegue y QA

**Entregables:**

- Build de producción optimizado
- Deploy en Hostinger con PM2
- Documentación de uso (README)
- Pruebas de seguridad básicas

**Criterios de aceptación:**

- Sistema accesible en producción
- Sin errores en consola
- Performance < 2s carga inicial

***

## 11. MÉTRICAS DE ÉXITO

### 11.1. KPIs Técnicos

- **Tiempo de respuesta API:** < 200ms promedio
- **Uptime:** > 99.5%
- **Lighthouse Score (frontend):** > 90 en Performance


### 11.2. KPIs de Negocio

- **Reducción de tiempo:** De 30min editando código a 3min en formulario
- **Adopción:** 100% de clientes migrados a DB en 2 semanas post-lanzamiento
- **Errores humanos:** 0 configuraciones rotas por typos en JSON manual

***

## 12. DOCUMENTACIÓN REQUERIDA

### 12.1. Para Desarrolladores

- README con setup de desarrollo
- Guía de arquitectura y convenciones
- Documentación de API (Swagger/OpenAPI opcional)


### 12.2. Para Usuarios Finales

- Manual de usuario del Admin Panel con capturas
- Video tutorial de 5min: "Cómo agregar un nuevo cliente"
- FAQ de errores comunes

***

## 13. RIESGOS Y MITIGACIONES

| Riesgo | Probabilidad | Impacto | Mitigación |
| :-- | :-- | :-- | :-- |
| Pérdida de credenciales cifradas | Baja | Crítico | Backup diario de DB + documentar clave maestra |
| Token JWT comprometido | Media | Alto | Rotación de secret cada 90 días + refresh tokens |
| Downtime en migración | Media | Medio | Probar en staging + rollback plan |
| Performance con 100+ clientes | Baja | Bajo | Índices en DB + paginación optimizada |


***

## 14. PRÓXIMOS PASOS (Post V1.0)

### V1.1 - Mejoras de UX

- Refresh tokens para sesiones persistentes
- Logs de auditoría (quién modificó qué)
- Dashboard con métricas de uso por cliente


### V1.2 - Multi-tenancy Admin

- Roles: Super Admin / Admin de Cliente
- Clientes pueden ver solo su configuración


### V2.0 - Gestión Avanzada

- Editor visual de flujos de automatización
- Testing de webhooks in-app
- Notificaciones en tiempo real (WebSockets)

***

## 15. ANEXOS

### A. Variables de Entorno Completas

```env
# Base de datos
DATABASE_URL="file:./db/dental.db"

# Seguridad
JWT_SECRET="tu-secret-ultra-seguro-64-caracteres-minimo"
ENCRYPTION_KEY="32-bytes-hex-generated-with-crypto-randomBytes"

# Admin inicial (seed)
ADMIN_USERNAME="admin"
ADMIN_EMAIL="admin@dentalapp.com"
ADMIN_PASSWORD="TempPassword123!" # Cambiar tras primer login

# Clientes existentes (mantener compatibilidad)
WHITE_DENTAL_META_TOKEN="..."
WHITE_DENTAL_WASSENGER_TOKEN="..."
```


### B. Comandos Útiles

```bash
# Desarrollo
npm run dev              # Backend con nodemon
cd frontend && npm run dev  # Frontend en modo dev

# Producción
npm run build            # Compila backend
cd frontend && npm run build
npm start                # Inicia en producción

# Base de datos
npx prisma migrate dev   # Crear migración
npx prisma studio        # UI para ver datos
npx prisma db seed       # Ejecutar seed
```


***

**Fin del Documento de Requerimientos**

***

Este documento proporciona una hoja de ruta completa para implementar un admin panel profesional, escalable y seguro que transformará la gestión manual de configuraciones en una experiencia moderna y eficiente. La arquitectura modular permite crecer con tu negocio sin sacrificar rendimiento ni seguridad.

