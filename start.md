# NETRA - Quick Start Guide

Welcome to NETRA! This guide is designed to get your intelligence dashboard up and running in under 2 minutes, even if you are brand new to setting up projects like this.

## Prerequisites

Before running anything, make sure you have these two things set up:

1. **Databases**: MongoDB and Neo4j must be running on your computer.
* *If using Docker*: Open Docker Desktop and make sure both database containers show a green/running status.
* *If installed locally*: Ensure the database services are started in your system settings.


2. **Tools**: Make sure you have Python and Node.js installed on your computer.

---

## Method 1: The Automated Start (Recommended)

This is the easiest way to get started. It automatically adds sample data, builds the network graph, and starts everything up for you.

1. Open **PowerShell** and navigate to your project folder:
```powershell
cd D:\NETRA-Platform\

```


2. Run the start script by typing:
```powershell
.\start_demo.bat

```


*(You can also just double-click the `start_demo.bat` file inside the `D:\NETRA-Platform\` folder).*
3. Wait a few seconds until you see a message saying the app is fully live.
4. Open your web browser and go to: **`http://localhost:5173`**

---

## Method 2: Manual Start (Step-by-Step)

If something goes wrong with the automatic start, or you want to see how the pieces fit together, follow these exact steps in order.

### Step 1: Clear Old Background Processes

Sometimes, hidden Python processes from past attempts get stuck and block your ports. Clear them out by running this in PowerShell:

```powershell
taskkill /F /IM python.exe

```

*(Don't worry if it says "no processes found"—that just means your system is clean!)*

### Step 2: Install Dependencies & Set Up Code

Since this is a fresh setup, you need to install the required programming packages for both the backend and frontend.

**For the Backend:**

1. Open PowerShell and go to the backend folder:
```powershell
cd D:\NETRA-Platform\backend

```


2. Install the required Python packages:
```powershell
pip install fastapi uvicorn pymongo neo4j pydantic python-dotenv requests

```



**For the Frontend:**

1. Open a **new, separate** PowerShell window and go to the frontend folder:
```powershell
cd D:\NETRA-Platform\frontend

```


2. Install the required Node packages:
```powershell
npm install

```



### Step 3: Seed Data & Build Graph (First Time Only)

If your dashboard opens up completely blank, it means your database doesn't have any data yet. Populate it by running these commands:

```powershell
cd D:\NETRA-Platform\backend\app
python seed_diverse_data.py
python pipeline.py

```

*(Wait until you see the success message confirming the pipeline is complete).*

### Step 4: Start the Backend Server

⚠️ **Important**: You must be inside the `backend` folder, **NOT** the `backend/app` folder.

```powershell
cd D:\NETRA-Platform\backend
python -m uvicorn main:app --reload

```

*Success check*: Look at the screen. You should see a message saying application startup is complete and it is watching your backend folder. Leave this PowerShell window open!

### Step 5: Start the Frontend Interface

Open a **brand new, separate** PowerShell window and run:

```powershell
cd D:\NETRA-Platform\frontend
npm run dev

```

*Success check*: It will give you a local web link (usually `http://localhost:5173`). Click or copy that link into your browser.

---

## How to Verify Everything Works

Before opening your dashboard, let's make sure the backend is working properly:

1. Open your web browser and go to: **`http://localhost:5173`**
2. Scroll down the page. You should see these API routes listed:
* `/api/v1/analytics/mutation`
* `/api/v1/analytics/correlation`
* `/api/v1/analytics/alerts`


3. If you see them, your backend is set up correctly! Now open your frontend URL (`http://localhost:5173`) and press **`Ctrl + Shift + R`** on your keyboard to do a hard refresh.

---

## Troubleshooting Common Issues

| Problem | Solution |
| --- | --- |
| **`[WinError 10048] Port 8000 is in use`** | Another program is using port 8000. Run `netstat -ano | findstr :8000`, note the PID number at the end, and run `taskkill /PID <PID_NUMBER> /F`. Then restart the backend. |
| **Tabs display "404 Not Found"** | You are likely in the wrong folder. Make sure you ran `cd D:\NETRA-Platform\backend` (and not `backend/app`) before starting Uvicorn. |
| **The graph looks like a giant cloud of dots** | Use the dashboard's search bar. Type something like "cisco" or "ai" and press Enter to filter and zoom into relevant nodes. |
| **The page looks old or frozen** | Your browser has saved an old version of the site. Press **`Ctrl + Shift + R`** (Windows) or **`Cmd + Shift + R`** (Mac) to force a hard refresh. |
| **"No messages available" error** | Your database is empty. Run `python seed_diverse_data.py` inside your `backend/app` folder, then refresh the page. |

---

## Quick Tips for Presenting or Demoing

* Always do a **Hard Refresh** (`Ctrl + Shift + R`) right before you start showing the app to anyone.
* If a button in the UI seems stuck, give it 1–2 seconds—it is actively talking to your local database.
* The **Alerts** tab creates real-time warnings based on whatever data is currently saved in MongoDB. If you add new data, the alerts will update automatically!
