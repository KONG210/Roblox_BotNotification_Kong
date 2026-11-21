# Roblox Farm Dashboard Cloud

Discord Webhook -> Discord Reader Bot -> PostgreSQL -> Express + Socket.IO Dashboard.

## Deploy to Render (free tier)
1. Create a **private** GitHub repository. Upload all files from this folder, including `.gitignore` and `render.yaml`, but **never** `.env` or `node_modules`.
2. Create a PostgreSQL database (for example Supabase). Obtain a connection URI from its dashboard. Use a connection URI reachable from Render; Supabase's session pooler connection may be necessary if direct IPv6 is unavailable. Do not share the URI publicly.
3. In Render choose **New > Blueprint** and connect the GitHub repository with `render.yaml`, or create a **Web Service** manually (`npm install`, `npm start`, Free plan).
4. Set `DISCORD_BOT_TOKEN`, `DISCORD_CHANNEL_ID`, `DISCORD_WEBHOOK_ID` (optional), `DATABASE_URL`, `DATABASE_SSL=true`, and a strong `DASHBOARD_PASSWORD` as private environment variables. Never put credentials in GitHub.
5. Ensure the Discord bot has Message Content Intent and View Channel / Read Message History permissions in the farm channel.
6. Open the Render URL and sign in using username `admin` and the dashboard password.

## Notes
- **Render Free sleeps after inactivity.** The Discord reader cannot stay connected while asleep. On restart it fetches up to the last 1000 messages to catch up; older messages may be missed. Free hosting is not guaranteed 24/7 monitoring.
- Bot status is connection to the dashboard service, not Roblox game status. A report only arrives when the farm webhook posts to Discord.
- Rewards parsing is best-effort and may require adjustments for your particular embed layout.
- The `/health` route is intentionally public; all dashboard data and Socket.IO connections require Basic authentication.
- Discord token and webhook URL previously posted in chat must be rotated before deployment.
- For local development: copy `.env.example` to `.env`, fill secrets, `npm install`, `npm start`, open `http://localhost:3030`.
