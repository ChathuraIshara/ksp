/**
 * setup.js — Run this BEFORE starting the backend for the first time.
 * 
 *   cd backend
 *   node setup.js
 * 
 * This script:
 *   1. Creates all DB tables (sync)
 *   2. Seeds queue types, plan types, fee configurations
 *   3. Creates/resets the admin user with the correct password from .env
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');

const adminEmail    = process.env.BOOTSTRAP_ADMIN_EMAIL    || 'tilarainsiluni2003@gmail.com';
const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD || 'KPS_Admin@2024!';
const adminName     = process.env.BOOTSTRAP_ADMIN_NAME     || 'System Administrator';

(async () => {
  try {
    // Connect
    const sequelize = require('./config/database');
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    // Sync all models in safe mode (create tables if missing)
    await sequelize.sync();
    console.log('✅ Tables created/updated\n');

    const { User, Officer, Queue, PlanType, FeeConfiguration } = require('./models');

    // ── ADMIN USER ─────────────────────────────────────────────────────────────
    const hash = await bcrypt.hash(adminPassword, 12);
    const [adminUser, created] = await User.findOrCreate({
      where: { email: adminEmail },
      defaults: {
        password_hash: hash,
        role:          'ADMIN',
        status:        'ACTIVE',
        emailVerified: true,
        isBlocked:     false,
        auth_provider: 'LOCAL',
      },
    });

    if (!created) {
      // Reset password and clear stale jwt_token so fresh one is issued
      await adminUser.update({
        password_hash: hash,
        jwt_token:     null,
        emailVerified: true,
        status:        'ACTIVE',
        isBlocked:     false,
      });
      console.log(`✅ Admin password reset:  ${adminEmail}`);
    } else {
      console.log(`✅ Admin user created:    ${adminEmail}`);
    }

    await Officer.findOrCreate({
      where: { user_id: adminUser.user_id },
      defaults: { full_name: adminName, designation: 'System Administrator', department: 'KPS', is_active: true },
    });

    // ── QUEUE TYPES ────────────────────────────────────────────────────────────
    const queues = [
      { queue_type: 'VERIFIED',       queue_name: 'All Clear — Ready for SW',    color_code: '#B5D4F4' },
      { queue_type: 'DOCUMENT_ISSUE', queue_name: 'Document Issue',              color_code: '#F5C4B3' },
      { queue_type: 'NAME_MISMATCH',  queue_name: 'Assessment Name Mismatch',    color_code: '#9FE1CB' },
      { queue_type: 'COMPLAINT',      queue_name: 'Active Complaint',            color_code: '#F09595' },
      { queue_type: 'RESUBMISSION',   queue_name: 'Resubmission — Corrected',    color_code: '#C0DD97' },
      { queue_type: 'ONLINE_ONLY',    queue_name: 'Online Submissions',          color_code: '#E6F1FB' },
      { queue_type: 'WALK_IN',        queue_name: 'Online + Manual Submissions', color_code: '#D3D1C7' },
    ];
    for (const q of queues) {
      const [, c] = await Queue.findOrCreate({ where: { queue_type: q.queue_type }, defaults: { ...q, is_active: true } });
      if (c) console.log(`  ✅ Queue: ${q.queue_name}`);
    }

    // ── PLAN TYPES ─────────────────────────────────────────────────────────────
    const planTypes = [
      { name: 'Residential Building',           category: 'BUILDING_PLAN', subtype: 'RESIDENTIAL',             display_name: 'Residential Building',           requires_ho_approval: false, requires_rda_approval: false, requires_gjs_approval: false, is_active: true },
      { name: 'Residential & Commercial',       category: 'BUILDING_PLAN', subtype: 'RESIDENTIAL_COMMERCIAL',  display_name: 'Residential & Commercial',       requires_ho_approval: false, requires_rda_approval: false, requires_gjs_approval: false, is_active: true },
      { name: 'Commercial Building',            category: 'BUILDING_PLAN', subtype: 'COMMERCIAL',              display_name: 'Commercial Building',            requires_ho_approval: false, requires_rda_approval: false, requires_gjs_approval: false, is_active: true },
      { name: 'Industrial / Warehouse',         category: 'BUILDING_PLAN', subtype: 'INDUSTRIAL',              display_name: 'Industrial / Warehouse',         requires_ho_approval: true,  requires_rda_approval: false, requires_gjs_approval: false, is_active: true },
      { name: 'Whole Land Approval',            category: 'PLOT_OF_LAND',  subtype: 'WHOLE_LAND',              display_name: 'Whole Land Approval',            requires_ho_approval: false, requires_rda_approval: false, requires_gjs_approval: false, is_active: true },
      { name: 'Subdivided Land Approval',       category: 'PLOT_OF_LAND',  subtype: 'SUBDIVIDED',              display_name: 'Subdivided Land',                requires_ho_approval: false, requires_rda_approval: false, requires_gjs_approval: false, is_active: true },
      { name: 'Boundary Wall (Road Side)',      category: 'BOUNDARY_WALL', subtype: 'OUTSIDE_BUILDING_LIMITS', display_name: 'Boundary Wall (Near RDA Road)',  requires_ho_approval: false, requires_rda_approval: true,  requires_gjs_approval: false, is_active: true },
      { name: 'Boundary Wall (Standard)',       category: 'BOUNDARY_WALL', subtype: 'WITHIN_BUILDING_LIMITS',  display_name: 'Boundary Wall (Standard)',       requires_ho_approval: false, requires_rda_approval: false, requires_gjs_approval: false, is_active: true },
    ];
    for (const pt of planTypes) {
      const [, c] = await PlanType.findOrCreate({ where: { subtype: pt.subtype }, defaults: pt });
      if (c) console.log(`  ✅ Plan Type: ${pt.display_name}`);
    }

    // ── FEE CONFIGURATIONS ─────────────────────────────────────────────────────
    const plans = await PlanType.findAll({ attributes: ['plan_type_id', 'subtype'] });
    const planMap = {};
    plans.forEach(p => { planMap[p.subtype] = p.plan_type_id; });

    const fees = [
      // Building Plan - per sqm tiered rates (gazette values)
      { subtype: 'RESIDENTIAL',            config_type: 'RATE_PER_SQM', rate_value: 20,  unit: 'PER_SQM', min_area: null,  max_area: 100  },
      { subtype: 'RESIDENTIAL',            config_type: 'RATE_PER_SQM', rate_value: 22,  unit: 'PER_SQM', min_area: 100,   max_area: 200  },
      { subtype: 'RESIDENTIAL',            config_type: 'RATE_PER_SQM', rate_value: 25,  unit: 'PER_SQM', min_area: 200,   max_area: null },
      { subtype: 'COMMERCIAL',             config_type: 'RATE_PER_SQM', rate_value: 30,  unit: 'PER_SQM', min_area: null,  max_area: null },
      { subtype: 'INDUSTRIAL',             config_type: 'RATE_PER_SQM', rate_value: 35,  unit: 'PER_SQM', min_area: null,  max_area: null },
      { subtype: 'WHOLE_LAND',             config_type: 'RATE_PER_PERCH', rate_value: 100, unit: 'PER_PERCH' },
      { subtype: 'SUBDIVIDED',             config_type: 'RATE_PER_PERCH', rate_value: 120, unit: 'PER_PERCH' },
      { subtype: 'OUTSIDE_BUILDING_LIMITS',config_type: 'RATE_PER_LINEAR_M', rate_value: 100, unit: 'PER_LINEAR_M' },
      { subtype: 'WITHIN_BUILDING_LIMITS', config_type: 'RATE_PER_LINEAR_M', rate_value: 80,  unit: 'PER_LINEAR_M' },
      // Extension fees
      { subtype: 'RESIDENTIAL',            config_type: 'EXTENSION_FEE', rate_value: 200, unit: 'FIXED' },
      { subtype: 'COMMERCIAL',             config_type: 'EXTENSION_FEE', rate_value: 400, unit: 'FIXED' },
    ];

    for (const fee of fees) {
      const planTypeId = planMap[fee.subtype];
      if (!planTypeId) continue;
      const existing = await FeeConfiguration.findOne({
        where: { plan_type_id: planTypeId, config_type: fee.config_type, min_area: fee.min_area ?? null }
      });
      if (!existing) {
        await FeeConfiguration.create({
          plan_type_id: planTypeId,
          config_type:  fee.config_type,
          rate_value:   fee.rate_value,
          unit:         fee.unit,
          min_area:     fee.min_area ?? null,
          max_area:     fee.max_area ?? null,
          is_active:    true,
        });
        console.log(`  ✅ Fee: ${fee.subtype} ${fee.config_type} Rs.${fee.rate_value}`);
      }
    }

    console.log('\n' + '═'.repeat(50));
    console.log('🎉  Setup complete!');
    console.log('═'.repeat(50));
    console.log(`\n  Email:    ${adminEmail}`);
    console.log(`  Password: ${adminPassword}`);
    console.log('\n  Start backend:  npm run dev');
    console.log('  Open frontend:  http://localhost:5173\n');

    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Setup failed:', err.message);
    if (err.parent) console.error('   DB error:', err.parent.message);
    process.exit(1);
  }
})();
