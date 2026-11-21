# Anime Adventures Ice Blue Dashboard V4

White and ice-blue responsive dashboard. Uses the same Express, Discord, PostgreSQL and Socket.IO backend as V3.

## Upgrade
1. Extract the ZIP. Upload all project files and the complete `public/` folder to your existing GitHub repository, replacing existing files.
2. Do not upload `.env` or secrets. Keep the existing Render environment variables.
3. Commit to `main`, then wait for Render auto-deploy (or choose Manual Deploy > Deploy latest commit).
4. Open the same Render URL and sign in.

## Accuracy and image rights
- The included SVG icons are fan-made illustrations, **not** actual in-game Anime Adventures item icons. No unverified game assets are represented as official. Replace `public/assets/*.svg` with authorized images of the corresponding item if you have them.
- Item counts are accumulated rewards, not current inventory.
- Graph displays recent 40 runs, not 7-day aggregates.
- Socket connected does not prove Roblox is running. Render Free may sleep.
- Rotate any previously shared Discord tokens, webhook secrets, database passwords, and dashboard passwords.


## Clean V4 hotfix
Frontend JavaScript is in `public/app.js`; HTML in `public/index.html`; styles in `public/style.css`. Removed the missing `clock` element access. API fetch runs independently of Socket.IO and retries every 60 seconds. Upload the entire `public/` folder to GitHub and wait for Render to redeploy.
