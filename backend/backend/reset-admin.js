/**
 * reset-admin.js
 * 
 * Run this ONCE to fix the admin password:
 *   node reset-admin.js
 * 
 * It will:
 *  1. Connect to DB using your .env credentials
 *  2. Find the admin user by email
 *  3. Hash the password from BOOTSTRAP_ADMIN_PASSWORD (or default)
 *  4. Update the user row directly
 *  5. Clear jwt_token so a fresh token is issued on next login
 *  6. Set emailVerified=true and status=ACTIVE so login works immediately
 */

require('dotenv').config();
const bcrypt    = require('bcryptjs');
const sequelize = require('./config/database');
const { DataTypes } = require('sequelize');

const email    = process.env.BOOTSTRAP_ADMIN_EMAIL    || 'tilarainsiluni2003@gmail.com';
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || 'KPS_Admin@2024!';

(async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ DB connected\n');

    const hash = await bcrypt.hash(password, 12);

    const [rows] = await sequelize.query(
      `UPDATE users
         SET password_hash   = :hash,
             jwt_token        = NULL,
             emailVerified    = 1,
             status           = 'ACTIVE',
             isBlocked        = 0,
             auth_provider    = 'LOCAL',
             updated_at       = NOW()
       WHERE email = :email`,
      { replacements: { hash, email } }
    );

    if (rows === 0) {
      console.log('⚠️  User not found — inserting fresh admin...');

      // Insert if doesn't exist
      await sequelize.query(
        `INSERT INTO users
           (user_id, email, password_hash, role, status, is_verified,
            isBlocked, emailVerified, auth_provider, created_at, updated_at)
         VALUES
           (UUID(), :email, :hash, 'ADMIN', 'ACTIVE', 1, 0, 1, 'LOCAL', NOW(), NOW())`,
        { replacements: { email, hash } }
      );
      console.log(`✅ Admin user created: ${email}`);
    } else {
      console.log(`✅ Password updated for: ${email}`);
    }

    console.log(`\n📧  Email:    ${email}`);
    console.log(`🔑  Password: ${password}`);
    console.log('\nYou can now log in at http://localhost:5173/login\n');

    await sequelize.close();
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
