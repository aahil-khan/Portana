import { createApp, startServer } from './app.js';

async function main(): Promise<void> {
  try {
    const app = await createApp();
    await startServer(app);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
