import { ensureDb } from '../src/lib/db';

ensureDb()
  .then(() => {
    console.log('Database initialized successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
