🛡️ NETRA Intelligence Platform - Setup & Prerequisites Guide
This document provides step-by-step instructions for setting up the NETRA Intelligence Platform locally. The architecture relies on a unified Cloud MongoDB Atlas database for data persistence, while leveraging local Docker containers for real-time streaming (Kafka), graph analytics (Neo4j), and automation (n8n).
💻 1. System Requirements
To run this platform smoothly, your machine should meet the following minimum specifications:
OS: Windows 10/11, macOS, or Linux (Windows recommended for this guide).
RAM: 8 GB minimum (16 GB recommended for running Docker + Python + Node.js simultaneously).
Storage: 10 GB of free disk space (for Docker volumes and dependencies).
Network: Stable internet connection (required for MongoDB Atlas and n8n Cloud communication).
📦 2. Global Prerequisites (Install First)
Before cloning or running the project, ensure the following software is installed on your system:
Docker Desktop: Download here. Ensure WSL 2 backend is enabled on Windows.
Python 3.10+: Download here. Ensure "Add Python to PATH" is checked during installation.
Node.js 18+ & npm: Download here.
Git: Download here.
⚙️ 3. Environment Configuration (.env)
The backend requires environment variables to connect to the database securely.
In the root directory (D:\NETRA-Platform), create a file named .env.
Paste the following configuration into it, replacing the placeholder values with your actual credentials: