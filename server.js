require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
const { Client, GatewayIntentBits, Events } = require('discord.js');
const app = express();
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server);
const port = Number(process.env.PORT) || 3030;
const pool = new Pool({connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === 'false' ? false : {rejectUnauthorized: false}});
const password = process.env.DASHBOARD_PASSWORD;
if (!process.env.DATABASE_URL || !password || !process.env.DISCORD_BOT_TOKEN || !process.env.DISCORD_CHANNEL_ID) {
  console.error('Missing DATABASE_URL, DASHBOARD_PASSWORD, DISCORD_BOT_TOKEN or DISCORD_CHANNEL_ID');
  process.exit(1);
}
function authorized(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) return false;
  let credentials;
  try { credentials = Buffer.from(header.slice(6), 'base64').toString('utf8'); } catch { return false; }
  const pos = credentials.indexOf(':');
  if (pos < 0 || credentials.slice(0,pos) !== 'admin') return false;
  const supplied = Buffer.from(credentials.slice(pos+1));
  const expected = Buffer.from(password);
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}
app.get('/health', (_,res) => res.json({ok:true}));
app.use((req,res,next) => {
  if (authorized(req)) return next();
  res.set('WWW-Authenticate', 'Basic realm="Farm Dashboard"');
  res.status(401).send('Login required');
});
io.use((socket,next) => {
  const req = socket.request;
  if (authorized(req)) next(); else next(new Error('Unauthorized'));
});
const clean = value => String(value ?? '').replace(/<[^>]*>/g, '').replace(/\*\*/g, '').trim();
function parseMessage(msg) {
  const e = msg.embeds?.[0];
  const fields = (e?.fields || []).map(f => ({name:clean(f.name), value:clean(f.value)}));
  const field = key => fields.find(f => f.name.toLowerCase().includes(key))?.value || '';
  const text = [msg.content, e?.title, e?.description, ...fields.flatMap(f => [f.name,f.value])].filter(Boolean).join('\n');
  const match = re => clean(text.match(re)?.[1] || '');
  const result = /victory|ชนะ/i.test(text) ? 'Victory' : /defeat|loss|แพ้/i.test(text) ? 'Defeat' : 'Unknown';
  const rewardText = field('reward') || (text.match(/rewards?[^\n]*\n([\s\S]*?)(?=\n(?:balance|player)|$)/i)?.[1] || '');
  const rewards = [];
  for (const line of rewardText.split('\n')) {
    const m = line.match(/\+\s*([\d,]+)\s+(.+?)\s*(?:→|->)\s*([\d,]+)/);
    if (m) rewards.push({amount:Number(m[1].replace(/,/g,'')), item:clean(m[2]), total:Number(m[3].replace(/,/g,''))});
  }
  const title = clean(e?.title);
  const lines = text.split('\n').map(clean).filter(Boolean);
  const resultIndex = lines.findIndex(line => /^(?:🏆\s*)?(victory|defeat|loss)$/i.test(line));
  const map = match(/(?:map|stage)\s*[:：]\s*([^\n]+)/i) || (resultIndex >= 0 ? lines[resultIndex+1] : '') || (title && !/victory|defeat/i.test(title) ? title : '') || 'Unknown';
  const playerText = field('player');
  return {id:msg.id, created_at:msg.createdAt.toISOString(), player:clean(playerText.split('\n')[0]) || match(/player\s*[:：]\s*([^\n]+)/i), result, map,
    mode:match(/\b(Raid|Story|Infinite|Challenge)\b/i), wave:Number(match(/wave\s*[:：]?\s*(\d+)/i)) || null,
    duration:match(/time\s*[:：]?\s*([^\n]+)/i), difficulty:match(/difficulty\s*[:：]?\s*(Easy|Normal|Hard|Insane|Nightmare)/i),
    weather:match(/weather\s*[:：]?\s*([^\n]+)/i), rewards, balances:field('balance'), raw:text};
}
async function saveMessage(msg) {
  if (msg.channelId !== process.env.DISCORD_CHANNEL_ID || !msg.webhookId) return;
  if (process.env.DISCORD_WEBHOOK_ID && msg.webhookId !== process.env.DISCORD_WEBHOOK_ID) return;
  const r = parseMessage(msg);
  if (r.result === 'Unknown' && !r.rewards.length) return;
  const result = await pool.query(`INSERT INTO runs (id,created_at,player,result,map,mode,wave,duration,difficulty,weather,rewards,balances,raw)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (id) DO NOTHING`,
    [r.id,r.created_at,r.player,r.result,r.map,r.mode,r.wave,r.duration,r.difficulty,r.weather,JSON.stringify(r.rewards),r.balances,r.raw]);
  if (result.rowCount) io.emit('updated');
}
app.get('/api/dashboard', async (_,res) => {
  try {
    const [rows, stats, rewards] = await Promise.all([
      pool.query('SELECT * FROM runs ORDER BY created_at DESC LIMIT 100'),
      pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE result='Victory')::int AS wins, COUNT(*) FILTER (WHERE result='Defeat')::int AS losses FROM runs`),
      pool.query('SELECT rewards FROM runs')]);
    const totals = {};
    for (const row of rewards.rows) for (const reward of row.rewards || []) totals[reward.item] = (totals[reward.item] || 0) + reward.amount;
    res.json({stats:stats.rows[0], totals, runs:rows.rows, lastReport:rows.rows[0]?.created_at || null});
  } catch(e) { console.error(e); res.status(500).json({error:'Database unavailable'}); }
});
app.use(express.static(path.join(__dirname,'public')));
async function main() {
  await pool.query(`CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL, player TEXT, result TEXT, map TEXT, mode TEXT,
    wave INTEGER, duration TEXT, difficulty TEXT, weather TEXT, rewards JSONB NOT NULL DEFAULT '[]'::jsonb,
    balances TEXT, raw TEXT NOT NULL)`);
  const client = new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent]});
  client.on(Events.MessageCreate, msg => saveMessage(msg).catch(console.error));
  client.once(Events.ClientReady, async () => {
    console.log('Discord connected:',client.user.tag);
    try {
      const channel = await client.channels.fetch(process.env.DISCORD_CHANNEL_ID);
      if (!channel?.messages) throw new Error('Channel not readable');
      let before;
      for (let page=0; page<10; page++) {
        const batch = await channel.messages.fetch({limit:100,...(before?{before}:{})});
        if (!batch.size) break;
        for (const msg of batch.values()) await saveMessage(msg);
        before = batch.last().id;
        if (batch.size < 100) break;
      }
      io.emit('updated');
      console.log('Discord history sync complete');
    } catch(e) { console.error('History sync error:',e.message); }
  });
  await client.login(process.env.DISCORD_BOT_TOKEN);
  server.listen(port,'0.0.0.0',()=>console.log('Dashboard listening on port',port));
}
main().catch(e => {console.error('Startup failed:',e);process.exit(1);});
