# Anime Adventures Farm Dashboard V3

A responsive, fan-made UI for the existing Discord webhook → Discord reader → PostgreSQL dashboard.

## Upgrade your existing Render deployment

1. Upload **all files** in this folder to the root of your existing GitHub repository, replacing the previous `server.js`, `package.json`, and `public/index.html` where applicable. Upload the **entire `public/assets/` folder**. Do not upload `.env`, passwords, or database files.
2. Commit changes to `main`. Render will redeploy automatically if auto-deploy is enabled. Otherwise use **Manual Deploy → Deploy latest commit**.
3. Keep your existing Render Environment Variables. Do not create a second Render service or Supabase project.
4. Open the existing `.onrender.com` URL and sign in with the same `admin` username and your configured `DASHBOARD_PASSWORD`.

## Notes

- Item icons are **original illustrative SVGs**, not extracted or official Anime Adventures icons. Replace `public/assets/*.svg` with your own licensed or permitted images while preserving filenames if you want exact game item art.
- Item totals represent **cumulative rewards**, not inventory balance.
- Recent activity graph shows the latest 40 reported wins/losses, not per-day totals.
- The UI does not change your database or bot credentials. Render Free can sleep, and socket connection does not mean the Roblox farming script is online.
- If your Discord webhook/bot/database/dashboard secrets were previously exposed, rotate them before using the service.
