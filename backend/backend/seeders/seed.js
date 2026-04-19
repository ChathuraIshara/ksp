/**
 * seed.js — ONE-TIME SYSTEM BOOTSTRAP
 *
 * Run once on a fresh database: node seeders/seed.js
 *
 * ── WHAT IS HERE AND WHY ────────────────────────────────────────────────────
 *
 * PRIMARY ADMIN (1 account)
 *   There is no other way to get the first admin into the system.
 *   Every other account — backup admins, officers, applicants — is created
 *   through the UI by this admin after first login.
 *
 * QUEUE TYPES (7 rows)
 *   The PSO verification service does Queue.findOne({ queue_type }) and
 *   throws if the row does not exist. There is no admin UI to create queue
 *   types. These are fixed system constants — they never change.
 *
 * PLAN TYPES (8 rows) + FEE CONFIGURATIONS (10 rows)
 *   Admin CAN manage these through the UI (full CRUD exists), but every
 *   application form and fee calculation breaks until they exist. These are
 *   gazette-mandated legal values that do not change between deployments.
 *   Seeding them saves the admin from manually re-entering 18 rows before
 *   the first applicant can submit anything.
 *
 * ── WHAT IS NOT HERE AND WHY ────────────────────────────────────────────────
 *
 * Backup admins
 *   Primary admin creates them through Admin → Officer Management → Create
 *   Officer. They use real email addresses and set their own passwords via
 *   the OTP flow. No placeholder accounts needed.
 *
 * Officers (PSO, SW, TO, PHI, HO, RDA, GJS, UDA, Chairman)
 *   Admin creates each one through the UI with their real name and real
 *   email. Admin approves them. Officer logs in, passes OTP, changes password.
 *   This is the correct onboarding path — no seeding needed.
 *
 * Applicants
 *   Anyone self-registers at /register or via Google Sign-In.
 *   No seeding needed.
 *
 * ── CONFIGURATION ───────────────────────────────────────────────────────────
 *
 * Override admin credentials via environment variables before running:
 *
 *   BOOTSTRAP_ADMIN_EMAIL=your.name@pradeshiyasabha.lk
 *   BOOTSTRAP_ADMIN_NAME=Your Full Name
 *   BOOTSTRAP_ADMIN_PASSWORD=YourStrongPassword@1234
 *
 * If not set, defaults are used — CHANGE THEM ON FIRST LOGIN.
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, User, Officer, Applicant, PlanType, FeeConfiguration, Queue } = require('../models');

const DEMO_PASSWORD = 'Demo@2024!';
const hash = (plain) => bcrypt.hash(plain, 12);

async function seed() {
  try {
    await sequelize.authenticate();
    await sequelize.sync();
    console.log('✅ Database connected\n');

    // ── PRIMARY ADMIN ─────────────────────────────────────────────────────────
    const adminEmail    = process.env.BOOTSTRAP_ADMIN_EMAIL    || 'tilarainsiluni2003@gmail.com';
    const adminName     = process.env.BOOTSTRAP_ADMIN_NAME     || 'System Administrator';
    const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD || 'ChangeMe@2024!';

    const [adminUser, adminCreated] = await User.findOrCreate({
      where:    { email: adminEmail },
      defaults: {
        password_hash: await bcrypt.hash(adminPassword, 12),
        role:          'ADMIN',
        status:        'ACTIVE',
        is_verified:   true,
        emailVerified: true,
        isBlocked:     false,
        auth_provider: 'LOCAL',
      },
    });

    await Officer.findOrCreate({
      where:    { user_id: adminUser.user_id },
      defaults: {
        full_name:   adminName,
        designation: 'System Administrator',
        department:  'Kelaniya Pradeshiya Sabha',
        is_active:   true,
      },
    });

    console.log(`${adminCreated ? '✅ Created' : '⏭  Exists'} ADMIN  ${adminEmail}`);

    console.log('── Creating officers ──');

    const officerDefs = [
      { email: 'pso@kps.lk',       name: 'Nimali Herath',            role: 'PSO',      designation: 'Subject Clerk' },
      { email: 'sw@kps.lk',        name: 'Kamala Fernando',           role: 'SW',       designation: 'Superintendent of Works' },
      { email: 'to1@kps.lk',       name: 'John Perera',               role: 'TO',       designation: 'Technical Officer' },
      { email: 'to2@kps.lk',       name: 'Mary Silva',                role: 'TO',       designation: 'Technical Officer' },
      { email: 'to3@kps.lk',       name: 'David Gunasekara',          role: 'TO',       designation: 'Technical Officer' },
      { email: 'phi@kps.lk',       name: 'Thilak Mendis',             role: 'PHI',      designation: 'Public Health Inspector' },
      { email: 'ho@kps.lk',        name: 'Dr. Chamari Weerasinghe',   role: 'HO',       designation: 'Health Officer' },
      { email: 'rda@kps.lk',       name: 'Prasad Kumarasinghe',       role: 'RDA',      designation: 'RDA Engineer' },
      { email: 'uda@kps.lk',       name: 'Sunethra Jayaratne',        role: 'UDA',      designation: 'UDA Planning Officer' },
      { email: 'skanthi066@gmail.com',  name: 'Hon. Asela Rodrigo',        role: 'CHAIRMAN', designation: 'Chairman' },
    ];

    const officers = {};
    for (const o of officerDefs) {
      const [user, uc] = await User.findOrCreate({
        where: { email: o.email },
        defaults: {
          password_hash: await hash(DEMO_PASSWORD),
          role:          o.role,
          status:        'ACTIVE',
          is_verified:   true,
          emailVerified: true,
          auth_provider: 'LOCAL',
        },
      });
      const [off, oc] = await Officer.findOrCreate({
        where: { user_id: user.user_id },
        defaults: {
          full_name:   o.name,
          designation: o.designation,
          department:  'Kelaniya Pradeshiya Sabha',
          is_active:   true,
        },
      });
      officers[o.role] = officers[o.role] || [];
      officers[o.role].push({ user, off });
      console.log(`  ${uc ? '✅' : '⏭ '} ${o.role.padEnd(8)} ${o.email}`);
    }

    const psoUser      = officers['PSO'][0].user;
    const swUser       = officers['SW'][0].user;
    const to1User      = officers['TO'][0].user;
    const to2User      = officers['TO'][1].user;
    const to3User      = officers['TO'][2].user;
    const chairUser    = officers['CHAIRMAN'][0].user;
    const hoUser       = officers['HO'][0].user;
    const to1Off       = officers['TO'][0].off;
    const to2Off       = officers['TO'][1].off;
    const to3Off       = officers['TO'][2].off;

console.log('\n── Creating applicant users ──');

    const applicantDefs = [
      { email: 'kamal.j@gmail.com',    name: 'Kamal Jayawardena',      nic: '199012345678', phone: '0711234567' },
      { email: 'samanthi.p@gmail.com', name: 'Samanthi P. Perera',      nic: '198756789012', phone: '0722345678' },  // name mismatch — registered as "Samanthi P. Perera" but tax record says "Samanthi Perera"
      { email: 'ranjith.d@gmail.com',  name: 'Ranjith Dissanayake',    nic: '197834567890', phone: '0733456789' },
      { email: 'sunanda.e@gmail.com',  name: 'Sunanda Enterprises Ltd', nic: '198912300001', phone: '0112456789' },  // complaint app — name matches tax record, complaint is the issue
      { email: 'nimal.f@gmail.com',    name: 'Nimal Fernando',         nic: '198901234567', phone: '0744567890' },  // doc issue
      { email: 'priyanka.w@gmail.com', name: 'Priyanka Wijesekara',    nic: '199234567890', phone: '0755678901' },  // approved, cert pending
      { email: 'chaminda.r@gmail.com', name: 'Chaminda Rathnayake',    nic: '198645678901', phone: '0766789012' },  // COR pending
      { email: 'thilanka.h@gmail.com', name: 'Thilanka Holdings',      nic: '198712300002', phone: '0112678901' },  // PC review
      { email: 'anura.b@gmail.com',    name: 'Anura Bandara',          nic: '197756789012', phone: '0777890123' },  // rejected + appeal
      { email: 'malini.s@gmail.com',   name: 'Malini Seneviratne',     nic: '198867890123', phone: '0788901234' },  // further review
      { email: 'roshan.g@gmail.com',   name: 'Roshan Gunawardena',     nic: '199378901234', phone: '0799012345' },  // extension used
      { email: 'buddhika.j@gmail.com', name: 'Buddhika Jayasena',      nic: '199090123456', phone: '0721234567' },  // walk-in
      { email: 'lanka.steel@gmail.com',name: 'Lanka Steel Pvt Ltd Rep', nic: '198534500003', phone: '0112567890' }, // industrial HO
      { email: 'sithara.w@gmail.com',  name: 'Sithara Wickramasinghe', nic: '198489012345', phone: '0710123456' },  // TO3 workload
    ];

    const appUsers = {};
    for (const a of applicantDefs) {
      const [user, uc] = await User.findOrCreate({
        where: { email: a.email },
        defaults: {
          password_hash: await hash(DEMO_PASSWORD),
          role:          'APPLICANT',
          status:        'ACTIVE',
          is_verified:   true,
          emailVerified: true,
          auth_provider: 'LOCAL',
        },
      });
      const [appl, ac] = await Applicant.findOrCreate({
        where: { nic_number: a.nic },
        defaults: {
          user_id:   user.user_id,
          full_name: a.name,
          nic_number:a.nic,
          phone:     a.phone,
        },
      });
      appUsers[a.email] = { user, appl };
      console.log(`  ${uc ? '✅' : '⏭ '} ${a.email}`);
    }

    // ── QUEUE TYPES ───────────────────────────────────────────────────────────
    console.log('\nQueue types...');
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
      const [, c] = await Queue.findOrCreate({
        where:    { queue_type: q.queue_type },
        defaults: { ...q, is_active: true },
      });
      console.log(`  ${c ? '✅' : '⏭ '} ${q.queue_name}`);
    }

    // ── PLAN TYPES ────────────────────────────────────────────────────────────
    console.log('\nPlan types...');
    const planTypes = [
      { name: 'Residential Building',           category: 'BUILDING_PLAN', subtype: 'RESIDENTIAL',             requires_ho_approval: false, requires_rda_approval: false, requires_gjs_approval: false },
      { name: 'Residential & Commercial',       category: 'BUILDING_PLAN', subtype: 'RESIDENTIAL_COMMERCIAL',  requires_ho_approval: false, requires_rda_approval: false, requires_gjs_approval: false },
      { name: 'Commercial Building',            category: 'BUILDING_PLAN', subtype: 'COMMERCIAL',              requires_ho_approval: false, requires_rda_approval: false, requires_gjs_approval: false },
      { name: 'Industrial / Warehouse',         category: 'BUILDING_PLAN', subtype: 'INDUSTRIAL',              requires_ho_approval: true,  requires_rda_approval: false, requires_gjs_approval: false },
      { name: 'Whole Land Approval',            category: 'PLOT_OF_LAND',  subtype: 'WHOLE_LAND',              requires_ho_approval: false, requires_rda_approval: false, requires_gjs_approval: false },
      { name: 'Subdivided Land Approval',       category: 'PLOT_OF_LAND',  subtype: 'SUBDIVIDED',              requires_ho_approval: false, requires_rda_approval: false, requires_gjs_approval: false },
      { name: 'Boundary Wall (Outside Limits)', category: 'BOUNDARY_WALL', subtype: 'OUTSIDE_BUILDING_LIMITS', requires_ho_approval: false, requires_rda_approval: true,  requires_gjs_approval: false },
      { name: 'Boundary Wall (Inside Limits)',  category: 'BOUNDARY_WALL', subtype: 'INSIDE_BUILDING_LIMITS',  requires_ho_approval: false, requires_rda_approval: true,  requires_gjs_approval: false },
    ];
    const ptMap = {};
    for (const pt of planTypes) {
      const [row, c] = await PlanType.findOrCreate({
        where:    { display_name: pt.name },
        defaults: {
          display_name:          pt.name,
          category:              pt.category,
          subtype:               pt.subtype,
          requires_ho_approval:  pt.requires_ho_approval,
          requires_rda_approval: pt.requires_rda_approval,
          requires_gjs_approval: pt.requires_gjs_approval,
        },
      });
      ptMap[pt.subtype] = row.plan_type_id;
      console.log(`  ${c ? '✅' : '⏭ '} ${pt.name}`);
    }

    // ── FEE CONFIGURATIONS (Gazette No. 1597/8) ───────────────────────────────
    console.log('\nFee configurations (Gazette 1597/8)...');
    const fees = [
      { subtype: 'OUTSIDE_BUILDING_LIMITS', fee_type: 'APPROVAL',  notes: 'Boundary wall outside limits: Rs.300 (Res) / Rs.400 (Comm) per linear metre' },
      { subtype: 'INSIDE_BUILDING_LIMITS',  fee_type: 'APPROVAL',  notes: 'Boundary wall inside limits: Rs.500 (Res) / Rs.600 (Comm) per linear metre' },
      { subtype: 'RESIDENTIAL',             fee_type: 'COR',       flat_fee: 3000, rate_per_sqft: 1,   notes: 'COC Residential: Rs.3000 base + Rs.1/sqft over 3225' },
      { subtype: 'COMMERCIAL',              fee_type: 'COR',       flat_fee: 3000, rate_per_sqft: 2,   notes: 'COC Commercial: Rs.3000 base + Rs.2/sqft over 1075' },
      { subtype: 'RESIDENTIAL',             fee_type: 'EXTENSION', flat_fee: 200,  notes: 'Extension fee — Residential' },
      { subtype: 'COMMERCIAL',              fee_type: 'EXTENSION', flat_fee: 400,  notes: 'Extension fee — Commercial' },
      { subtype: 'INDUSTRIAL',              fee_type: 'EXTENSION', flat_fee: 400,  notes: 'Extension fee — Industrial' },
      { subtype: 'RESIDENTIAL',             fee_type: 'FINE',      penalty_rate_per_sqft: 50,  notes: 'Unauthorised construction — Residential' },
      { subtype: 'COMMERCIAL',              fee_type: 'FINE',      penalty_rate_per_sqft: 100, notes: 'Unauthorised construction — Commercial' },
      { subtype: 'INDUSTRIAL',             fee_type: 'FINE',      penalty_rate_per_sqft: 150, notes: 'Unauthorised construction — Industrial' },
    ];
    for (const fc of fees) {
      const plan_type_id = ptMap[fc.subtype];
      if (!plan_type_id) continue;
      const { subtype, ...data } = fc;
      const [, c] = await FeeConfiguration.findOrCreate({
        where:    { plan_type_id, fee_type: fc.fee_type },
        defaults: {
          ...data,
          plan_type_id,
          is_active:      true,
          effective_from: new Date('2009-04-17'),
          min_fee:        fc.flat_fee || 0,
        },
      });
      console.log(`  ${c ? '✅' : '⏭ '} ${fc.fee_type} / ${fc.subtype}`);
    }


    // ── LATE_COR global fee (no plan_type_id — applies to all COR requests > 5 years) ──
    const [, lateCORCreated] = await FeeConfiguration.findOrCreate({
      where:    { fee_type: "LATE_COR", plan_type_id: null },
      defaults: {
        fee_type:       "LATE_COR",
        plan_type_id:   null,
        flat_fee:       50,
        rate_per_sqft:  50,
        is_active:      true,
        effective_from: new Date("2009-04-17"),
        notes:          "Late COR fine: Rs. 50 per day past 5-year approval expiry",
      },
    });
    console.log(`  ${lateCORCreated ? "✅" : "⏭ "} LATE_COR / global`);
    // ── DONE ──────────────────────────────────────────────────────────────────
    console.log('\n══════════════════════════════════════════════════════');
    console.log('✅  BOOTSTRAP COMPLETE');
    console.log('══════════════════════════════════════════════════════');
    console.log(`\n  Email:    ${adminEmail}`);
    console.log(`  Password: ${adminPassword}`);
    console.log('\n  Next steps:');
    console.log('  1. Sign in and change your password immediately');
    console.log('  2. Admin → Officer Management → Create Officer');
    console.log('     (add PSO, SW, TO, PHI, HO, RDA, GJS, UDA, Chairman)');
    console.log('  3. Approve each officer in Pending Verifications');
    console.log('  4. Create a second Admin account for backup recovery');
    console.log('     (Admin → Create Officer → role: ADMIN → Approve)');
    console.log('\n  Applicants self-register — no seeding needed.');
    console.log('══════════════════════════════════════════════════════\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Bootstrap failed:', err.message, '\n', err.stack);
    process.exit(1);
  }
}

seed();