import { openDb } from './db.ts';
import { createApp } from './app.ts';
import { ensureSeeded } from './seed.ts';
import { aiEnabled } from './routes/ai.ts';

const db = openDb();
ensureSeeded(db);

const port = Number(process.env.PORT ?? 4000);
const app = createApp(db, { staticDir: process.env.NODE_ENV === 'production' ? 'dist' : undefined });
app.listen(port, () => {
  console.log(`BenchIQ API listening on http://localhost:${port}`);
  console.log(`AI Coach: ${aiEnabled() ? 'enabled' : 'disabled (set ANTHROPIC_API_KEY to enable)'}`);
});
