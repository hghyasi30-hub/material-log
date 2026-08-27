# Getting Material Log live (free tier)

This uses two free services: **Neon** (Postgres database) and **Render** (runs your backend).
The frontend is a single HTML file you can host almost anywhere, including Render as a static site.

## 1. Database (Neon - free)
1. Go to neon.tech, sign up, create a new project.
2. Copy the connection string it gives you (looks like `postgres://user:pass@host/dbname`).
3. Save it somewhere - you'll paste it into Render in step 3.

## 2. Push this code to GitHub
1. Create a free GitHub account if you don't have one.
2. Create a new repository, upload the `backend` and `frontend` folders to it.
   (GitHub's "upload files" button in the browser works fine - no command line needed.)

## 3. Backend (Render - free)
1. Go to render.com, sign up, connect your GitHub account.
2. Click "New +" -> "Web Service", pick your repository, set the root directory to `backend`.
3. Build command: `npm install`
4. Start command: `npm start`
5. Under "Environment", add these variables:
   - `DATABASE_URL` = the Neon connection string from step 1
   - `JWT_SECRET` = any long random string (e.g. mash your keyboard for 40 characters)
6. Deploy. Once it's live, Render gives you a URL like `https://material-log-backend.onrender.com`.
7. Run the migration once to create your tables: in Render's dashboard, open the "Shell" tab for your service and run:
   ```
   npm run migrate
   ```

## 4. Frontend
1. Open `frontend/index.html` and change this line near the top of the `<script>` tag:
   ```js
   const API_BASE = window.MATERIAL_LOG_API_BASE || "http://localhost:3001";
   ```
   Replace `http://localhost:3001` with your real Render URL from step 3.
2. Host this file anywhere: Render static sites (free), Netlify, or even just opening it locally once it points at your live backend.

## 5. Try it
Visit your frontend URL, create an account, create a project, add subs and materials.

---
**Note on the free tier:** Render's free web services "sleep" after inactivity and take
10-20 seconds to wake back up on the next visit. Fine for personal/internal use; if you
outgrow that, a paid tier (~$7/month) keeps it always-on.
