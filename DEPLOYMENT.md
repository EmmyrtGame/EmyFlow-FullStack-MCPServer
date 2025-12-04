# Guía de Despliegue en Hostinger

## Requisitos Previos
- Acceso a Hostinger Panel (hPanel).
- Plan que soporte Node.js (Cloud Startup o VPS recomendado).
- Credenciales de Google Service Account (JSON).
- Tokens de Meta y Wassenger.

## Pasos de Despliegue

### 1. Preparación del Entorno
1.  Accede al **Administrador de Archivos** o conecta por **SSH**.
2.  Navega a la carpeta raíz de tu dominio (ej. `public_html` o una subcarpeta si es un subdominio).

### 2. Subida de Archivos
Sube los siguientes archivos/carpetas:
- `dist/` (Carpeta compilada)
- `package.json`
- `creds/` (Crea esta carpeta y sube tus archivos JSON de Google Service Account)

### 3. Configuración de Variables de Entorno
Crea un archivo `.env` en la raíz con el siguiente contenido:

```env
PORT=3000
WHITE_DENTAL_META_TOKEN=tu_token_meta
WHITE_DENTAL_WASSENGER_TOKEN=tu_token_wassenger
MAKE_AGENT_WEBHOOK_URL=tu_webhook_make
```

### 4. Instalación de Dependencias
Si tienes acceso SSH:
```bash
npm install --production
```
Si usas la interfaz de Node.js en hPanel:
- Asegúrate de que `package.json` esté en la raíz de la aplicación.
- Haz clic en "Install" o "NPM Install".

### 5. Configuración del Servidor Node.js (hPanel)
1.  Ve a la sección **Node.js** en hPanel.
2.  **Application Root:** La ruta donde subiste los archivos.
3.  **Application Startup File:** `dist/index.js`
4.  **Package.json File:** `package.json`
5.  Haz clic en **Start Application**.

### 6. Verificación
- Visita `https://tu-dominio.com/` y deberías ver "MCP Server is running".
- Configura el Webhook de Wassenger para apuntar a `https://tu-dominio.com/webhooks/whatsapp`.

## Solución de Problemas
- **Error 500/502:** Revisa los logs de la aplicación en hPanel.
- **Permisos:** Asegúrate de que la carpeta `creds/` tenga permisos de lectura.
