import * as dotenv from 'dotenv';
dotenv.config();
import { db } from '../core/database';

async function main() {
  await db.connect();
  const query = `
    INSERT INTO module_welcome (guild_id, welcome_channel_id, leave_channel_id, enabled)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (guild_id) DO UPDATE
    SET welcome_channel_id = $2,
        leave_channel_id = $3,
        enabled = $4;
  `;
  await db.query(query, ['1525065834572021851', '1559123338775896156', '1559123338775896156', true]);
  console.log('✅ module_welcome set to #🛡️・mod-and-audit-logs (1559123338775896156)');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
