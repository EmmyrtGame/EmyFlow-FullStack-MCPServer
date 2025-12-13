
<a id="readme-top"></a>

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/EmmyrtGame/mcp_emyweb_dental">
    <img src="frontend/public/emyweblogo.png" alt="Logo" height="80">
  </a>

  <h3 align="center">EmyFlow MCP</h3>

  <p align="center">
    A comprehensive <strong>Business Automation Platform</strong> orchestrating appointments, communications, and marketing events via the **Model Context Protocol (MCP)**.
    <br />
    <small>Developed by <strong>EmyWeb Studio</strong>, software development company in Colima, Mexico.</small>
    <br />
    <br />
    <a href="#about-the-project"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="#demo">View Demo</a>
    ·
    <a href="#issues">Report Bug</a>
    ·
    <a href="#request-feature">Request Feature</a>
  </p>
</div>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li>
      <a href="#configuration--credentials-guide">Configuration & Credentials Guide</a>
      <ul>
        <li><a href="#why-google-service-accounts">Why Google Service Accounts?</a></li>
        <li><a href="#tutorial-how-to-get-your-service-account-json">Tutorial: Get Service Account JSON</a></li>
        <li><a href="#other-keys-meta--wassenger">Other Keys (Meta & Wassenger)</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#features">Features</a></li>
    <li><a href="#license">License</a></li>
  </ol>
</details>

<!-- ABOUT THE PROJECT -->
## About The Project

**EmyFlow MCP** is a multi-tenant business orchestration platform designed to centralize and automate client interactions. It serves as a unified bridge between AI agents, communication channels (WhatsApp), and operational tools (Google Calendar).

Unlike simple CRM solutions, **EmyFlow** is built around the **Model Context Protocol (MCP)**, allowing AI agents to "use" your business tools directly—checking availability, scheduling appointments, and sending reminders without manual intervention.

**Proudly developed by EmyWeb Studio** in Colima, Mexico. We specialize in custom software solutions that drive business efficiency.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Built With

*   [![React][React.js]][React-url]
*   [![Vite][Vitejs]][Vite-url]
*   [![TailwindCSS][TailwindCSS]][Tailwind-url]
*   [![Node.js][Node.js]][Node-url]
*   [![Express][Express.js]][Express-url]
*   [![Prisma][Prisma]][Prisma-url]
*   **MCP (Model Context Protocol)**

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONFIGURATION GUIDE -->
## Configuration & Credentials Guide

To run EmyFlow, you need access to specific external APIs. This section explains **why** and **how** to get them.

### Why Google Service Accounts?
For **EmyFlow** to manage Google Calendars (checking slots, creating events) on behalf of a business *autonomously* (without a human logging in every time), we use **Service Accounts**.

A **Service Account** is a special type of Google account intended to represent a non-human user (the software itself).
*   **Benefits**: Secure, server-to-server authentication, no manual login required, specific permission scopes.
*   **Security**: Authentication is done via a JSON key file, which EmyFlow stores securely on your database.

### Tutorial: How to get your Service Account JSON

1.  **Go to Google Cloud Console**:
    Visit [console.cloud.google.com](https://console.cloud.google.com/).

2.  **Create a New Project**:
    *   Click on the project dropdown (top left).
    *   Click **"New Project"**. Name it (e.g., "EmyFlow Automations") and create.

3.  **Enable Google Calendar API**:
    *   Go to **"APIs & Services"** > **"Library"**.
    *   Search for **"Google Calendar API"**.
    *   Click **"Enable"**.

4.  **Create Credentials**:
    *   Go to **"APIs & Services"** > **"Credentials"**.
    *   Click **"+ CREATE CREDENTIALS"** > **"Service Account"**.
    *   **Name**: `emyflow-bot` (or similar). Click "Create and Continue".
    *   **Role**: Select **"Owner"** or "Editor" (for simplicity, or refine scopes as needed). Click "Done".

5.  **Generate Key (JSON)**:
    *   Click on the newly created Service Account email (`emyflow-bot@...`).
    *   Go to the **"Keys"**.
    *   Click **"Add Key"** > **"Create new key"**.
    *   Select **"JSON"** and click **"Create"**.
    *   **SAVE THIS FILE!** This is the file you will upload to the EmyFlow Admin Panel.

6.  **Important**: Share Calendar Access (your client's calendar)
    *   Open your specific Google Calendar (calendar.google.com).
    *   Go to **"Settings and sharing"** for the calendar you want to automate.
    *   Under **"Share with specific people"**, add the **Service Account Email** (the one ending in `.iam.gserviceaccount.com`).
    *   Permission: **"Make changes to events"**.

### Other Keys (Meta & Wassenger)
*   **Wassenger (WhatsApp)**: Get your (or your client's) API Key from [Wassenger Developer Console](https://app.wassenger.com/developers). Required for sending automated messages.
*   **Meta (Facebook/Instagram)**: Required for CAPI events. Get your (or your client's) `Pixel ID` and `Access Token` from [Facebook Events Manager](https://business.facebook.com/events_manager).
*   **Webhook URL (Mandatory)**: Each client requires a specific **Webhook URL** (e.g., Make.com, n8n, Zapier) to receive incoming messages and handoff events. This is now configured per-client in the Admin Panel.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- GETTING STARTED -->
## Getting Started

### Installation

1.  **Clone the repo**
    ```sh
    git clone https://github.com/EmmyrtGame/mcp_emyweb_dental.git
    cd mcp_emyweb_dental
    ```

2.  **Install Dependencies**
    ```sh
    npm install
    ```

3.  **Env Setup**
    ```sh
    cp .env.example .env
    # Fill in your DATABASE_URL and JWT_SECRET
    ```

4.  **Database**
    ```sh
    npx prisma db push
    npx ts-node src/db/seed.ts
    ```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- USAGE -->
## Usage

### Development
```sh
npm run dev
```
*   **Admin Panel**: http://localhost:5173
*   **API**: http://localhost:3000

### Production
```sh
npm run build
npm start
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- FEATURES -->
## Features

### 🧠 Backend & Automation
*   **Wassenger Stack Integration**: Automated WhatsApp messaging.
*   **Auto-Reminders**: Cron jobs for 24h, 3h, 1h appointment notifications.
*   **Multi-Calendar Optimization**: Logic to check "Availability" calendars vs "Booking" calendars.

### 🤖 AI Agent Tools (MCP)
*   `check_availability`: Real-time slots query.
*   `schedule_appointment`: Direct booking booking via Service Account.
*   `human_handoff`: Escalate to human agents via webhook.

### 🖥️ EmyFlow Admin Panel
*   **Centralized Management**: Manage unlimited tenants.
*   **Secure Credential Storage**: Encrypted JSON keys.
*   **Role-Based Access**: Secure Admin JWT auth.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- LICENSE -->
## License

Distributed under the MIT License. See `LICENSE` for more information.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->
[React.js]: https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB
[React-url]: https://reactjs.org/
[Vitejs]: https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white
[Vite-url]: https://vitejs.dev/
[TailwindCSS]: https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white
[Tailwind-url]: https://tailwindcss.com/
[Node.js]: https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white
[Node-url]: https://nodejs.org/
[Express.js]: https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white
[Express-url]: https://expressjs.com/
[Prisma]: https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white
[Prisma-url]: https://prisma.io/
