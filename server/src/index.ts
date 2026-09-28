import { env } from './env.js';
import './db/connection.js'; // führt schema.sql aus, bevor Anfragen bearbeitet werden
import { createApp } from './app.js';

const app = createApp();
app.listen(env.port, () => {
  console.log(`[math-learning-server] läuft auf :${env.port} (${env.nodeEnv}, Datenbank: ${env.databasePath})`);
});
