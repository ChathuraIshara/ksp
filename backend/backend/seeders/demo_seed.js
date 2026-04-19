/**
 * demo_seed.js — KPS DEMO DATA SEEDER
 *
 * Creates a full demonstrable state of the system for testing/demo purposes.
 * Run AFTER seed.js (which creates admin, queues, plan types, fee configs).
 *
 * Usage:
 *   node seeders/demo_seed.js
 *
 * What this creates:
 *  ── OFFICERS (9 roles, pre-approved, with known passwords) ──────────────────
 *   1 PSO   — Nimali Herath          pso@kps.lk          / Demo@2024!
 *   1 SW    — Kamala Fernando        sw@kps.lk           / Demo@2024!
 *   3 TOs   — John Perera            to1@kps.lk          / Demo@2024!
 *             Mary Silva             to2@kps.lk          / Demo@2024!
 *             David Gunasekara       to3@kps.lk          / Demo@2024!
 *   1 PHI   — Thilak Mendis          phi@kps.lk          / Demo@2024!
 *   1 HO    — Dr. Chamari Weerasinghe ho@kps.lk          / Demo@2024!
 *   1 RDA   — Prasad Kumarasinghe    rda@kps.lk          / Demo@2024!
 *   1 UDA   — Sunethra Jayaratne     uda@kps.lk          / Demo@2024!
 *   1 CHAIR — Hon. Asela Rodrigo     chairman@kps.lk     / Demo@2024!
 *
 *  ── ASSESSMENT TAX RECORDS (15 properties) ──────────────────────────────────
 *
 *  ── APPLICANTS & THEIR APPLICATIONS ────────────────────────────────────────
 *
 *   PSO QUEUE DEMO (5 apps in PSO queue, various states):
 *   A1  KEL/RES/001 — Kamal Jayawardena  → SUBMITTED (All Clear, ready to escalate)
 *   A2  KEL/RES/002 — Name MISMATCH       → PSO_REVIEW (name in app ≠ tax record)
 *   A3  KEL/COM/004 — With COMPLAINT      → PSO_REVIEW (red dot, complaint exists)
 *   A4  KEL/RES/005 — Document ISSUE      → PSO_REVIEW (doc incomplete)
 *   A5  KEL/RES/015 — Walk-in             → SUBMITTED  (manual, bypassed PSO)
 *
 *   SW WORKLOAD DEMO (9 apps distributed across 3 TOs):
 *   TO1 John   — 4 tasks (2 pending inspection, 1 scheduled, 1 completed w/ minute)
 *   TO2 Mary   — 3 tasks (2 pending, 1 scheduled)
 *   TO3 David  — 2 tasks (1 pending COR, 1 pending inspection)
 *
 *   FULL LIFECYCLE DEMO:
 *   B1  KEL/RES/007 — APPROVED, cert generated, awaiting Chairman signature
 *   B2  KEL/RES/008 — COR requested, final inspection pending
 *   B3  KEL/COM/009 — PC_REVIEW (in planning committee agenda)
 *   B4  KEL/RES/010 — REJECTED, appeal submitted
 *   B5  KEL/IND/006 — EXTERNAL_APPROVAL (HO review pending, industrial)
 *   B6  KEL/RES/011 — FURTHER_REVIEW (sent back after PC meeting)
 *   B7  KEL/RES/012 — Extension requested (1 extension already used)
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const {
  sequelize, User, Officer, Applicant,
  AssessmentTaxRecord, TaxRecordOwner, Complaint,
  PlanType, Application, TrackingLine, TrackingNode,
  TaskAssignment, Inspection, InspectionMinute,
  Payment, QueueAssignment, Queue, PSOVerificationLog,
  ApprovalCertificate, CORApplication, TimeExtension,
  Minute, Decision, PlanningCommitteeMeeting, PCApplication,
  ExternalApproval
} = require('../models');

const DEMO_PASSWORD = 'Demo@2024!';
const hash = (pw) => bcrypt.hash(pw, 12);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const addTrackingNode = async (trackingLineId, referenceNumber, nodeType, label, metadata = {}, isVisible = true) => {
  return TrackingNode.create({
    node_id:                  uuidv4(),
    tracking_line_id:         trackingLineId,
    reference_number:         referenceNumber,
    node_type:                nodeType,
    label,
    status:                   'COMPLETED',
    is_visible_to_applicant:  isVisible,
    node_data:                metadata,
    completed_at:             new Date(),
  });
};

const makeTrackingLine = async (applicationId, referenceNumber) => {
  const line = await TrackingLine.create({
    tracking_line_id: uuidv4(),
    reference_number: referenceNumber,
    application_id:   applicationId,
    overall_status:   'ACTIVE',
  });
  return line;
};

const daysAgo = (n) => new Date(Date.now() - n * 86400000);
const daysFromNow = (n) => new Date(Date.now() + n * 86400000);

// ─── Main ─────────────────────────────────────────────────────────────────────
async function demoSeed() {
  try {
    await sequelize.authenticate();
    await sequelize.sync();
    console.log('✅ DB connected\n');

    // ══════════════════════════════════════════════════════════════════════════
    // 1. OFFICERS
    // ══════════════════════════════════════════════════════════════════════════
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

    // ══════════════════════════════════════════════════════════════════════════
    // 2. ASSESSMENT TAX RECORDS
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n── Creating assessment tax records ──');

    const taxData = [
      { tn: 'KEL/RES/001/2024', addr: 'No. 45 Jayawardena Mawatha, Kelaniya',         road: 'Jayawardena Mawatha',  perches: 12.50, owner: 'Kamal Jayawardena',      nic: '199012345678', phone: '0711234567', tax: 18500 },
      { tn: 'KEL/RES/002/2024', addr: 'No. 12 Sirimavo Bandaranayake Mw, Peliyagoda', road: 'Sirimavo Bndrnayake Mw',perches: 8.75,  owner: 'Samanthi Perera',        nic: '198756789012', phone: '0722345678', tax: 12000 },
      { tn: 'KEL/RES/003/2024', addr: 'No. 78 Temple Road, Kelaniya',                 road: 'Temple Road',           perches: 15.00, owner: 'Ranjith Dissanayake',    nic: '197834567890', phone: '0733456789', tax: 22000 },
      { tn: 'KEL/COM/004/2024', addr: 'No. 23 Baseline Road, Peliyagoda',             road: 'Baseline Road',         perches: 20.00, owner: 'Sunanda Enterprises Ltd', nic: null,           phone: '0112456789', tax: 45000 },
      { tn: 'KEL/RES/005/2024', addr: 'No. 56 Ragama Road, Kelaniya',                 road: 'Ragama Road',           perches: 10.25, owner: 'Nimal Fernando',          nic: '198901234567', phone: '0744567890', tax: 14500 },
      { tn: 'KEL/IND/006/2024', addr: 'Lot 7 Peliyagoda Industrial Zone',             road: 'Industrial Road',       perches: 45.00, owner: 'Lanka Steel Pvt Ltd',     nic: null,           phone: '0112567890', tax: 85000 },
      { tn: 'KEL/RES/007/2024', addr: 'No. 33 Kandy Road, Kelaniya',                  road: 'Kandy Road',            perches: 18.50, owner: 'Priyanka Wijesekara',     nic: '199234567890', phone: '0755678901', tax: 28000 },
      { tn: 'KEL/RES/008/2024', addr: 'No. 91 New Kandy Road, Kelaniya',              road: 'New Kandy Road',        perches: 9.00,  owner: 'Chaminda Rathnayake',    nic: '198645678901', phone: '0766789012', tax: 11000 },
      { tn: 'KEL/COM/009/2024', addr: 'No. 14 Colombo Road, Peliyagoda',              road: 'Colombo Road',          perches: 25.00, owner: 'Thilanka Holdings',       nic: null,           phone: '0112678901', tax: 55000 },
      { tn: 'KEL/RES/010/2024', addr: 'No. 67 Mahawatta Road, Kelaniya',              road: 'Mahawatta Road',        perches: 11.75, owner: 'Anura Bandara',           nic: '197756789012', phone: '0777890123', tax: 16000 },
      { tn: 'KEL/RES/011/2024', addr: 'No. 29 Kelani Road, Kelaniya',                 road: 'Kelani Road',           perches: 14.00, owner: 'Malini Seneviratne',      nic: '198867890123', phone: '0788901234', tax: 19500 },
      { tn: 'KEL/RES/012/2024', addr: 'No. 5 Sapugaskanda Road, Peliyagoda',          road: 'Sapugaskanda Road',     perches: 7.50,  owner: 'Roshan Gunawardena',     nic: '199378901234', phone: '0799012345', tax: 9500  },
      { tn: 'KEL/IND/013/2024', addr: 'Block B Peliyagoda Warehouse Zone',            road: 'Warehouse Road',        perches: 60.00, owner: 'Express Logistics Ltd',   nic: null,           phone: '0112789012', tax: 120000},
      { tn: 'KEL/RES/014/2024', addr: 'No. 88 Hospital Road, Kelaniya',               road: 'Hospital Road',         perches: 22.00, owner: 'Sithara Wickramasinghe', nic: '198489012345', phone: '0710123456', tax: 32000 },
      { tn: 'KEL/RES/015/2024', addr: 'No. 41 Katunayake Road, Kelaniya',             road: 'Katunayake Road',       perches: 13.25, owner: 'Buddhika Jayasena',       nic: '199090123456', phone: '0721234567', tax: 17500 },
    ];

    const taxMap = {};
    for (const t of taxData) {
      const [rec, rc] = await AssessmentTaxRecord.findOrCreate({
        where: { tax_number: t.tn },
        defaults: {
          tax_number:          t.tn,
          property_address:    t.addr,
          road_name:           t.road,
          property_type:       t.perches > 30 ? 'Industrial' : t.tn.includes('COM') ? 'Commercial' : 'Residential',
          land_area_perches:   t.perches,
          land_area:           t.perches,
          annual_tax_amount:   t.tax,
          tax_payment_status:  t.tax > 80000 ? 'PAID' : 'PAID',
          is_active:           true,
          ward:                `Ward ${taxData.indexOf(t) + 1}`,
          local_authority_area:'Kelaniya',
          imported_at:         new Date(),
          imported_by:         psoUser.user_id,
        },
      });
      await TaxRecordOwner.findOrCreate({
        where: { tax_record_id: rec.tax_record_id, owner_name: t.owner },
        defaults: {
          tax_record_id:        rec.tax_record_id,
          owner_name:           t.owner,
          nic_number:           t.nic,
          ownership_percentage: 100.00,
          is_primary:           true,
          is_active:            true,
          contact_phone:        t.phone,
        },
      });
      taxMap[t.tn] = rec;
      console.log(`  ${rc ? '✅' : '⏭ '} ${t.tn} — ${t.owner}`);
    }

    // Fetch plan types
    const ptRows = await PlanType.findAll();
    const pt = {};
    for (const r of ptRows) { pt[r.subtype] = r; }

    // ══════════════════════════════════════════════════════════════════════════
    // 3. APPLICANT USERS
    // ══════════════════════════════════════════════════════════════════════════
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

    // ══════════════════════════════════════════════════════════════════════════
    // 4. COMPLAINT — on KEL/COM/004 (before application is submitted)
    //    So when PSO processes app A3, they see the red dot
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n── Creating pre-existing complaint (red dot demo) ──');

    const [complaint1] = await Complaint.findOrCreate({
      where: { tax_number: 'KEL/COM/004/2024', complainant_nic: '199400001111' },
      defaults: {
        tax_number:          'KEL/COM/004/2024',
        complainant_name:    'K.A. Sumanadasa',
        complainant_contact: '0712233445',
        complainant_nic:     '199400001111',
        complaint_type:      'Unauthorized Construction',
        description:         'The owner has been constructing a commercial building on this plot without any visible permits or boundary markers. The construction has encroached approximately 2 feet into the common access road, obstructing the right-of-way for neighboring properties.',
        status:              'PENDING',
        pso_id:              psoUser.user_id,
        chairman_id:         chairUser.user_id,
      },
    });
    console.log(`  ✅ Complaint on KEL/COM/004/2024 — red dot trigger`);

    // ══════════════════════════════════════════════════════════════════════════
    // 5. PSO QUEUE APPLICATIONS (A1–A5)
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n── Creating PSO queue applications ──');

    const allClearQueue  = await Queue.findOne({ where: { queue_type: 'VERIFIED' } });
    const nameMismatchQ  = await Queue.findOne({ where: { queue_type: 'NAME_MISMATCH' } });
    const complaintQ     = await Queue.findOne({ where: { queue_type: 'COMPLAINT' } });
    const docIssueQ      = await Queue.findOne({ where: { queue_type: 'DOCUMENT_ISSUE' } });

    // Helper: create an application + tracking line
    const createApp = async (opts) => {
      const app = await Application.create({
        application_id:              uuidv4(),
        reference_number:            opts.ref || null,
        applicant_id:                opts.applicantId,
        tax_record_id:               opts.taxRecordId,
        tax_number:                  opts.taxNumber,
        plan_type_id:                opts.planTypeId,
        sub_plan_type:               opts.subPlanType,
        story_type:                  opts.storyType || 'SINGLE_STORY',
        submission_mode:             opts.mode || 'ONLINE',
        work_type:                   opts.workType || 'NEW_CONSTRUCTION',
        proposed_use:                opts.proposedUse || 'RESIDENTIAL',
        existing_use:                opts.existingUse || 'RESIDENTIAL',
        land_ownership_type:         'FREEHOLD',
        site_area:                   opts.siteArea || 10.0,
        building_area:               opts.buildingArea || 120.0,
        wall_length:                 opts.wallLength || null,
        building_floors:             opts.floors || 1,
        building_height_m:           opts.height || 4.5,
        distance_to_road_centre_m:   5.5,
        distance_to_rear_boundary_m: 3.0,
        distance_to_right_boundary_m:2.0,
        distance_to_left_boundary_m: 2.0,
        wall_material:               'BRICK',
        roof_material:               'TILE',
        floor_material:              'CEMENT',
        wastewater_disposal:         'Septic tank',
        rainwater_disposal:          'Soakage pit',
        solid_waste_disposal:        'Municipal collection',
        professional_name:           opts.profName || 'Eng. A.B. Perera',
        professional_designation:    'Chartered Civil Engineer',
        professional_phone:          '0712000001',
        professional_reg_number:     'SL/CE/2345',
        status:                      opts.status || 'SUBMITTED',
        applicant_declaration_accepted: true,
        declaration_accepted_at:     new Date(),
        submitted_at:                opts.submittedAt || daysAgo(3),
        has_document_issue_notification: opts.hasDocIssue || false,
        requires_ho:                 opts.requiresHo || false,
        requires_rda:                opts.requiresRda || false,
        requires_gjs:                opts.requiresGjs || false,
        approval_date:               opts.approvalDate || null,
        approval_expiry_date:        opts.approvalExpiry || null,
        extension_count:             opts.extensionCount || 0,
        rejection_reason:            opts.rejectionReason || null,
        map_lat:                     6.9271,
        map_lng:                     79.8612,
        map_place_description:       opts.mapDesc || 'Near Kelaniya Raja Maha Viharaya',
        physical_copies_confirmed:   opts.mode === 'WALK_IN' ? true : false,
        registered_by:               opts.mode === 'WALK_IN' ? psoUser.user_id : null,
        ref_receipt_path:            opts.mode === 'WALK_IN' ? 'receipts/RCP-2024-001.pdf' : null,
      });

      const line = await makeTrackingLine(app.application_id, opts.ref || app.application_id);
      await addTrackingNode(line.tracking_line_id, opts.ref || app.application_id, 'SUBMITTED',
        opts.mode === 'WALK_IN'
          ? `Walk-in application registered at counter by PSO on ${daysAgo(opts.daysAgo || 3).toLocaleDateString()}`
          : `Application submitted online on ${(opts.submittedAt || daysAgo(3)).toLocaleDateString()}`
      );
      if (opts.ref) {
        await app.update({ reference_number: opts.ref });
        await line.update({ reference_number: opts.ref });
      }
      return { app, line };
    };

    // A1: All Clear — KEL/RES/001 — Kamal Jayawardena (name matches tax record)
    const a1 = await createApp({
      ref: 'PS-2025-BP-00101', applicantId: appUsers['kamal.j@gmail.com'].appl.applicant_id,
      taxRecordId: taxMap['KEL/RES/001/2024'].tax_record_id, taxNumber: 'KEL/RES/001/2024',
      planTypeId: pt['RESIDENTIAL'].plan_type_id, subPlanType: 'residential',
      buildingArea: 145.0, siteArea: 12.5, status: 'PSO_REVIEW', submittedAt: daysAgo(2),
      mapDesc: 'Jayawardena Mawatha, Kelaniya — near primary school',
    });
    console.log('  ✅ A1: PS-2025-BP-00101 (All Clear — ready to escalate)');

    // A2: NAME MISMATCH — applicant registered as "Samanthi P. Perera" but tax record says "Samanthi Perera"
    const a2 = await createApp({
      ref: 'PS-2025-BP-00102', applicantId: appUsers['samanthi.p@gmail.com'].appl.applicant_id,
      taxRecordId: taxMap['KEL/RES/002/2024'].tax_record_id, taxNumber: 'KEL/RES/002/2024',
      planTypeId: pt['RESIDENTIAL'].plan_type_id, subPlanType: 'residential',
      buildingArea: 98.0, siteArea: 8.75, status: 'PSO_REVIEW', submittedAt: daysAgo(3),
      mapDesc: 'Sirimavo Bandaranayake Mawatha, Peliyagoda',
    });
    // Simulate PSO placing in name mismatch queue
    await QueueAssignment.findOrCreate({
      where: { application_id: a2.app.application_id, status: 'PENDING' },
      defaults: {
        queue_id:         nameMismatchQ.queue_id,
        application_id:   a2.app.application_id,
        reference_number: 'PS-2025-BP-00102',
        assigned_by:      psoUser.user_id,
        status:           'PENDING',
      },
    });
    await PSOVerificationLog.findOrCreate({
      where: { reference_number: 'PS-2025-BP-00102' },
      defaults: {
        reference_number:        'PS-2025-BP-00102',
        application_id:          a2.app.application_id,
        pso_id:                  psoUser.user_id,
        tax_number_checked:      'KEL/RES/002/2024',
        name_match_result:       'MISMATCH',
        doc_completeness_result: 'COMPLETE',
        complaint_flag:          false,
        action_taken:            'NAME_MISMATCH',
        verification_note:       'Applicant name "Samanthi P. Perera" does not match tax record owner "Samanthi Perera". PSO requires clarification on middle initial.',
      },
    });
    console.log('  ✅ A2: PS-2025-BP-00102 (Name Mismatch queue — red label)');

    // A3: COMPLAINT — KEL/COM/004 (has existing complaint, red dot)
    const a3 = await createApp({
      ref: 'PS-2025-BP-00103', applicantId: appUsers['sunanda.e@gmail.com'].appl.applicant_id,
      taxRecordId: taxMap['KEL/COM/004/2024'].tax_record_id, taxNumber: 'KEL/COM/004/2024',
      planTypeId: pt['COMMERCIAL'].plan_type_id, subPlanType: 'commercial',
      buildingArea: 320.0, siteArea: 20.0, status: 'PSO_REVIEW', submittedAt: daysAgo(1),
      proposedUse: 'COMMERCIAL', existingUse: 'COMMERCIAL',
      mapDesc: 'Baseline Road, Peliyagoda — near CEB substation',
    });
    await QueueAssignment.findOrCreate({
      where: { application_id: a3.app.application_id, status: 'PENDING' },
      defaults: {
        queue_id: complaintQ.queue_id, application_id: a3.app.application_id,
        reference_number: 'PS-2025-BP-00103', assigned_by: psoUser.user_id, status: 'PENDING',
      },
    });
    await complaint1.update({ reference_number: 'PS-2025-BP-00103' });
    console.log('  ✅ A3: PS-2025-BP-00103 (Complaint queue — red dot visible)');

    // A4: DOCUMENT ISSUE — KEL/RES/005 (structural plans missing)
    const a4 = await createApp({
      ref: 'PS-2025-BP-00104', applicantId: appUsers['nimal.f@gmail.com'].appl.applicant_id,
      taxRecordId: taxMap['KEL/RES/005/2024'].tax_record_id, taxNumber: 'KEL/RES/005/2024',
      planTypeId: pt['RESIDENTIAL'].plan_type_id, subPlanType: 'residential',
      buildingArea: 112.0, siteArea: 10.25, status: 'PSO_REVIEW', submittedAt: daysAgo(4),
      hasDocIssue: true,
      mapDesc: 'Ragama Road, Kelaniya',
    });
    await a4.app.update({ has_document_issue_notification: true });
    await QueueAssignment.findOrCreate({
      where: { application_id: a4.app.application_id, status: 'PENDING' },
      defaults: {
        queue_id: docIssueQ.queue_id, application_id: a4.app.application_id,
        reference_number: 'PS-2025-BP-00104', assigned_by: psoUser.user_id, status: 'PENDING',
      },
    });
    await PSOVerificationLog.findOrCreate({
      where: { reference_number: 'PS-2025-BP-00104' },
      defaults: {
        reference_number: 'PS-2025-BP-00104', application_id: a4.app.application_id,
        pso_id: psoUser.user_id, tax_number_checked: 'KEL/RES/005/2024',
        name_match_result: 'MATCHED', doc_completeness_result: 'INCOMPLETE',
        complaint_flag: false, action_taken: 'DOCUMENT_ISSUE',
        verification_note: 'Structural engineering plans (3 copies) are missing. Only architectural drawings were submitted. Please resubmit with complete structural plan set stamped by a Chartered Civil Engineer.',
      },
    });
    console.log('  ✅ A4: PS-2025-BP-00104 (Document Issue — edit button unlocked)');

    // A5: WALK-IN — KEL/RES/015 (bypassed PSO, directly to SW)
    const a5 = await createApp({
      ref: 'PS-2025-BP-00105', applicantId: appUsers['buddhika.j@gmail.com'].appl.applicant_id,
      taxRecordId: taxMap['KEL/RES/015/2024'].tax_record_id, taxNumber: 'KEL/RES/015/2024',
      planTypeId: pt['RESIDENTIAL'].plan_type_id, subPlanType: 'residential',
      buildingArea: 135.0, siteArea: 13.25, status: 'ASSIGNED_TO_SW', submittedAt: daysAgo(1),
      mode: 'WALK_IN', profName: 'Eng. D.N. Wickrama', mapDesc: 'Katunayake Road, Kelaniya',
    });
    await addTrackingNode(a5.line.tracking_line_id, 'PS-2025-BP-00105', 'PAYMENT_VERIFIED',
      'Payment collected at counter — Rs. 200.00');
    await addTrackingNode(a5.line.tracking_line_id, 'PS-2025-BP-00105', 'PSO_VERIFIED',
      'Physical documents and 3 plan copies verified at counter');
    await addTrackingNode(a5.line.tracking_line_id, 'PS-2025-BP-00105', 'REFERENCE_NUMBER',
      'Reference number PS-2025-BP-00105 issued');
    await Payment.findOrCreate({ where: { reference_number: 'PS-2025-BP-00105', payment_type: 'APPLICATION_FEE' }, defaults: {
      application_id: a5.app.application_id, payment_type: 'APPLICATION_FEE',
      amount: 200, payment_method: 'COUNTER_CASH', payment_status: 'COMPLETED',
      transaction_id: `CASH-${Date.now()}`,
    }});
    console.log('  ✅ A5: PS-2025-BP-00105 (Walk-in — bypassed PSO, in SW queue)');

    // ══════════════════════════════════════════════════════════════════════════
    // 6. SW WORKLOAD — 9 applications across 3 TOs
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n── Creating SW workload (3 TOs × distributed tasks) ──');

    const createAssignedApp = async (opts) => {
      const { app, line } = await createApp(opts);
      await addTrackingNode(line.tracking_line_id, opts.ref, 'PSO_VERIFIED', 'PSO verification complete');
      await addTrackingNode(line.tracking_line_id, opts.ref, 'REFERENCE_NUMBER', `Reference ${opts.ref} issued`);
      await addTrackingNode(line.tracking_line_id, opts.ref, 'SW_INITIAL', `Assigned to ${opts.toName} for inspection`);
      const task = await TaskAssignment.create({
        task_id: uuidv4(), reference_number: opts.ref, application_id: app.application_id,
        assigned_to: opts.toUserId, assigned_by: swUser.user_id,
        task_type: 'TO_INSPECTION', status: opts.taskStatus || 'PENDING',
        priority: opts.priority || 'NORMAL',
        assignment_note: `Assigned by SW to ${opts.toName}`,
        stage_at_assignment: 'ASSIGNED_TO_TO',
        due_date: daysFromNow(14),
      });
      await app.update({ status: opts.appStatus || 'ASSIGNED_TO_TO' });
      await Payment.findOrCreate({ where: { reference_number: opts.ref, payment_type: 'APPLICATION_FEE' }, defaults: {
        application_id: app.application_id, payment_type: 'APPLICATION_FEE',
        amount: 200, payment_method: 'ONLINE', payment_status: 'COMPLETED',
      }});
      return { app, line, task };
    };

    // ── TO1: John Perera — 4 tasks (heaviest load = 60% bar) ─────────────────
    const w1 = await createAssignedApp({
      ref: 'PS-2025-BP-00201', applicantId: appUsers['ranjith.d@gmail.com'].appl.applicant_id,
      taxRecordId: taxMap['KEL/RES/003/2024'].tax_record_id, taxNumber: 'KEL/RES/003/2024',
      planTypeId: pt['RESIDENTIAL'].plan_type_id, subPlanType: 'residential',
      buildingArea: 168.0, siteArea: 15.0, status: 'ASSIGNED_TO_TO', submittedAt: daysAgo(8),
      toUserId: to1User.user_id, toName: 'John Perera', appStatus: 'ASSIGNED_TO_TO',
      mapDesc: 'Temple Road, Kelaniya',
    });
    console.log('  ✅ W1: PS-2025-BP-00201 → TO1 John (pending)');

    const w2 = await createAssignedApp({
      ref: 'PS-2025-BP-00202', applicantId: appUsers['malini.s@gmail.com'].appl.applicant_id,
      taxRecordId: taxMap['KEL/RES/011/2024'].tax_record_id, taxNumber: 'KEL/RES/011/2024',
      planTypeId: pt['RESIDENTIAL_COMMERCIAL'].plan_type_id, subPlanType: 'residential-commercial',
      buildingArea: 210.0, siteArea: 14.0, status: 'ASSIGNED_TO_TO', submittedAt: daysAgo(6),
      toUserId: to1User.user_id, toName: 'John Perera', storyType: 'MULTI_STORY', floors: 2,
      appStatus: 'ASSIGNED_TO_TO', mapDesc: 'Kelani Road, Kelaniya — near police station',
    });
    console.log('  ✅ W2: PS-2025-BP-00202 → TO1 John (pending, shop house)');

    // W3: TO1 — Inspection SCHEDULED (applicant can accept/counter-propose)
    const w3 = await createAssignedApp({
      ref: 'PS-2025-BP-00203', applicantId: appUsers['anura.b@gmail.com'].appl.applicant_id,
      taxRecordId: taxMap['KEL/RES/010/2024'].tax_record_id, taxNumber: 'KEL/RES/010/2024',
      planTypeId: pt['RESIDENTIAL'].plan_type_id, subPlanType: 'residential',
      buildingArea: 128.0, siteArea: 11.75, status: 'INSPECTION_SCHEDULED', submittedAt: daysAgo(10),
      toUserId: to1User.user_id, toName: 'John Perera', taskStatus: 'IN_PROGRESS',
      appStatus: 'INSPECTION_SCHEDULED', mapDesc: 'Mahawatta Road, Kelaniya',
    });
    const insp1 = await Inspection.create({
      inspection_id: uuidv4(), reference_number: 'PS-2025-BP-00203',
      application_id: w3.app.application_id, task_id: w3.task.task_id,
      officer_id: to1Off.officer_id, inspection_type: 'INITIAL',
      status: 'SCHEDULED', scheduled_date: daysFromNow(3),
      location_address: '67 Mahawatta Road, Kelaniya',
    });
    await w3.app.update({ status: 'INSPECTION_SCHEDULED' });
    console.log('  ✅ W3: PS-2025-BP-00203 → TO1 John (scheduled in 3 days — accept/counter demo)');

    // W4: TO1 — Inspection COMPLETED + minute submitted (SW pending review)
    const w4 = await createAssignedApp({
      ref: 'PS-2025-BP-00204', applicantId: appUsers['roshan.g@gmail.com'].appl.applicant_id,
      taxRecordId: taxMap['KEL/RES/012/2024'].tax_record_id, taxNumber: 'KEL/RES/012/2024',
      planTypeId: pt['RESIDENTIAL'].plan_type_id, subPlanType: 'residential',
      buildingArea: 88.0, siteArea: 7.5, status: 'INSPECTION_DONE', submittedAt: daysAgo(15),
      toUserId: to1User.user_id, toName: 'John Perera', taskStatus: 'COMPLETED',
      appStatus: 'INSPECTION_DONE', mapDesc: 'Sapugaskanda Road, Peliyagoda',
    });
    const insp2 = await Inspection.create({
      inspection_id: uuidv4(), reference_number: 'PS-2025-BP-00204',
      application_id: w4.app.application_id, task_id: w4.task.task_id,
      officer_id: to1Off.officer_id, inspection_type: 'INITIAL',
      status: 'COMPLETED', scheduled_date: daysAgo(5), actual_date: daysAgo(5),
      location_address: '5 Sapugaskanda Road, Peliyagoda',
    });
    const im1 = await InspectionMinute.create({
      minute_id: uuidv4(), inspection_id: insp2.inspection_id,
      reference_number: 'PS-2025-BP-00204', officer_id: to1Off.officer_id,
      status: 'SUBMITTED',
      site_area_measured: 7.5, building_area_measured: 88.0,
      is_flood_zone: false, slldc_clearance_ok: true, obstructs_natural_drainage: false,
      adjacent_land_nature: 'Residential properties on all sides. No commercial or industrial neighbors.',
      zoning_classification: 'RESIDENTIAL', zoning_compliant: true,
      plot_coverage_allowed_pct: 60.0, plot_coverage_proposed_pct: 45.0,
      far_allowed: 1.5, far_proposed: 0.9,
      open_space_sqm: 42.0, power_line_distance_m: 15.0,
      road_ownership: 'LOCAL_GOVERNMENT', road_width_ft: 16.0,
      building_line_dev_plan_m: 3.0, road_building_line_compliant: true,
      parking_required: 1, parking_provided: 2,
      light_ventilation_adequate: true, open_space_rear_adequate: true,
      open_space_front_adequate: true, open_space_light_ventilation_adequate: true,
      drainage_system_available: true, surface_drain_details: 'Roadside concrete drain',
      wastewater_disposal: 'Septic tank with soakage pit',
      to_remarks: 'Property is well-maintained. No unauthorized construction observed. Land extents match the survey plan.',
      to_recommendation: 'RECOMMEND FOR APPROVAL — The proposed single-storey residential building complies with all UDA regulations. Building coverage, FAR, setbacks, and parking provisions are within permissible limits. No objections from an inspection perspective.',
      submitted_at: daysAgo(5), construction_type: 'NEW_CONSTRUCTION',
    });
    await w4.task.update({ status: 'COMPLETED', completed_at: daysAgo(5) });
    await addTrackingNode(w4.line.tracking_line_id, 'PS-2025-BP-00204', 'TO_INSPECTION',
      'Site inspection completed by TO John Perera');
    await w4.app.update({ status: 'SW_REVIEW' });
    await Minute.create({
      minute_id: uuidv4(), reference_number: 'PS-2025-BP-00204',
      application_id: w4.app.application_id, authored_by: to1User.user_id,
      minute_type: 'REVIEW', visibility: 'OFFICERS_ONLY', status: 'SUBMITTED',
      content: im1.to_recommendation, submitted_at: daysAgo(5),
    });
    console.log('  ✅ W4: PS-2025-BP-00204 → TO1 John (minute submitted — SW pending review)');

    // ── TO2: Mary Silva — 3 tasks ─────────────────────────────────────────────
    const w5 = await createAssignedApp({
      ref: 'PS-2025-PL-00301', applicantId: appUsers['sithara.w@gmail.com'].appl.applicant_id,
      taxRecordId: taxMap['KEL/RES/014/2024'].tax_record_id, taxNumber: 'KEL/RES/014/2024',
      planTypeId: pt['WHOLE_LAND'].plan_type_id, subPlanType: 'whole-land',
      buildingArea: null, siteArea: 22.0, status: 'ASSIGNED_TO_TO', submittedAt: daysAgo(7),
      toUserId: to2User.user_id, toName: 'Mary Silva',
      proposedUse: 'RESIDENTIAL', appStatus: 'ASSIGNED_TO_TO',
      mapDesc: 'Hospital Road, Kelaniya',
    });
    console.log('  ✅ W5: PS-2025-PL-00301 → TO2 Mary (plot pending)');

    const w6 = await createAssignedApp({
      ref: 'PS-2025-BW-00302', applicantId: appUsers['samanthi.p@gmail.com'].appl.applicant_id,
      taxRecordId: taxMap['KEL/RES/002/2024'].tax_record_id, taxNumber: 'KEL/RES/002/2024',
      planTypeId: pt['INSIDE_BUILDING_LIMITS'].plan_type_id, subPlanType: 'standard-wall',
      wallLength: 35.0, siteArea: 8.75, status: 'ASSIGNED_TO_TO', submittedAt: daysAgo(5),
      toUserId: to2User.user_id, toName: 'Mary Silva',
      appStatus: 'ASSIGNED_TO_TO', mapDesc: 'Sirimavo Bandaranayake Mawatha, Peliyagoda',
    });
    console.log('  ✅ W6: PS-2025-BW-00302 → TO2 Mary (boundary wall pending)');

    const w7 = await createAssignedApp({
      ref: 'PS-2025-BP-00303', applicantId: appUsers['thilanka.h@gmail.com'].appl.applicant_id,
      taxRecordId: taxMap['KEL/COM/009/2024'].tax_record_id, taxNumber: 'KEL/COM/009/2024',
      planTypeId: pt['COMMERCIAL'].plan_type_id, subPlanType: 'commercial',
      buildingArea: 380.0, siteArea: 25.0, status: 'INSPECTION_SCHEDULED', submittedAt: daysAgo(9),
      toUserId: to2User.user_id, toName: 'Mary Silva', taskStatus: 'IN_PROGRESS',
      proposedUse: 'COMMERCIAL', appStatus: 'INSPECTION_SCHEDULED',
      mapDesc: 'Colombo Road, Peliyagoda — next to supermarket',
    });
    const insp3 = await Inspection.create({
      inspection_id: uuidv4(), reference_number: 'PS-2025-BP-00303',
      application_id: w7.app.application_id, task_id: w7.task.task_id,
      officer_id: to2Off.officer_id, inspection_type: 'INITIAL',
      status: 'SCHEDULED', scheduled_date: daysFromNow(5),
      location_address: '14 Colombo Road, Peliyagoda',
    });
    console.log('  ✅ W7: PS-2025-BP-00303 → TO2 Mary (commercial, scheduled in 5 days)');

    // ── TO3: David Gunasekara — 2 tasks ───────────────────────────────────────
    const w8 = await createAssignedApp({
      ref: 'PS-2025-BP-00401', applicantId: appUsers['chaminda.r@gmail.com'].appl.applicant_id,
      taxRecordId: taxMap['KEL/RES/008/2024'].tax_record_id, taxNumber: 'KEL/RES/008/2024',
      planTypeId: pt['RESIDENTIAL'].plan_type_id, subPlanType: 'residential',
      buildingArea: 105.0, siteArea: 9.0, status: 'COR_REVIEW', submittedAt: daysAgo(400),
      toUserId: to3User.user_id, toName: 'David Gunasekara', taskStatus: 'PENDING',
      appStatus: 'COR_REVIEW',
      approvalDate: daysAgo(370), approvalExpiry: daysFromNow(1460),
      mapDesc: 'New Kandy Road, Kelaniya',
    });
    await CORApplication.findOrCreate({
      where: { reference_number: 'PS-2025-BP-00401' },
      defaults: {
        reference_number: 'PS-2025-BP-00401', application_id: w8.app.application_id,
        applicant_id: w8.app.applicant_id, status: 'INSPECTION_SCHEDULED',
        compliance_statement: 'Construction completed as per approved plan. All conditions have been fulfilled.',
        submitted_at: daysAgo(5),
      },
    });
    await w8.task.update({ task_type: 'COR_INSPECTION' });
    console.log('  ✅ W8: PS-2025-BP-00401 → TO3 David (COR inspection pending)');

    const w9 = await createAssignedApp({
      ref: 'PS-2025-BP-00402', applicantId: appUsers['lanka.steel@gmail.com'].appl.applicant_id,
      taxRecordId: taxMap['KEL/IND/006/2024'].tax_record_id, taxNumber: 'KEL/IND/006/2024',
      planTypeId: pt['INDUSTRIAL'].plan_type_id, subPlanType: 'industrial',
      buildingArea: 520.0, siteArea: 45.0, status: 'ASSIGNED_TO_TO', submittedAt: daysAgo(12),
      toUserId: to3User.user_id, toName: 'David Gunasekara',
      proposedUse: 'INDUSTRIAL', requiresHo: true,
      appStatus: 'ASSIGNED_TO_TO', mapDesc: 'Peliyagoda Industrial Zone — Lot 7',
    });
    console.log('  ✅ W9: PS-2025-BP-00402 → TO3 David (industrial, HO required)');

    // ══════════════════════════════════════════════════════════════════════════
    // 7. FULL LIFECYCLE APPLICATIONS
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n── Creating full lifecycle demo applications ──');

    // B1: APPROVED — cert generated, awaiting Chairman signature
    const b1 = await createApp({
      ref: 'PS-2025-BP-00501', applicantId: appUsers['priyanka.w@gmail.com'].appl.applicant_id,
      taxRecordId: taxMap['KEL/RES/007/2024'].tax_record_id, taxNumber: 'KEL/RES/007/2024',
      planTypeId: pt['RESIDENTIAL'].plan_type_id, subPlanType: 'residential',
      buildingArea: 195.0, siteArea: 18.5, status: 'APPROVED',
      submittedAt: daysAgo(45), approvalDate: daysAgo(5), approvalExpiry: daysFromNow(1825),
      mapDesc: 'Kandy Road, Kelaniya',
    });
    for (const [nt, lbl] of [
      ['PSO_VERIFIED','PSO verification complete — all documents in order'],
      ['REFERENCE_NUMBER','Reference PS-2025-BP-00501 issued'],
      ['SW_INITIAL','Assigned to TO John Perera for inspection'],
      ['TO_INSPECTION','Site inspection completed — recommendation: APPROVE'],
      ['SW_REVIEW','SW reviewed TO minute — forwarding to PC meeting'],
      ['PC_COMMITTEE','Planning Committee decision: APPROVED'],
      ['APPROVED','Building permit approved — awaiting fee payment and certificate'],
    ]) { await addTrackingNode(b1.line.tracking_line_id, 'PS-2025-BP-00501', nt, lbl); }
    await Payment.findOrCreate({ where: { reference_number: 'PS-2025-BP-00501', payment_type: 'APPROVAL_FEE' }, defaults: {
      application_id: b1.app.application_id, payment_type: 'APPROVAL_FEE',
      amount: 3900, payment_method: 'ONLINE', payment_status: 'COMPLETED',
    }});
    const cert1 = await ApprovalCertificate.findOrCreate({ where: { reference_number: 'PS-2025-BP-00501' }, defaults: {
      certificate_id: uuidv4(), reference_number: 'PS-2025-BP-00501',
      application_id: b1.app.application_id, decision_id: uuidv4(),
      certificate_number: 'KPS/AP/2025/00501',
      verification_code: `VERIFY-${Math.random().toString(36).substring(2,10).toUpperCase()}`,
      conditions: '1. Validity Period: 1 year from approval date.\n2. Construction must follow approved plan exactly.\n3. COR must be obtained before occupying the building.\n4. Street line: 5 feet from road centre.',
      approval_date: daysAgo(5), expiry_date: daysFromNow(1825),
      is_issued: false,
    }});
    console.log('  ✅ B1: PS-2025-BP-00501 — APPROVED, cert generated → Chairman must sign');

    // B2: COR_REVIEW — Chaminda's house (already in w8 above, add lifecycle nodes)
    await addTrackingNode(w8.line.tracking_line_id, 'PS-2025-BP-00401', 'TO_INSPECTION',
      'Original site inspection completed by TO David Gunasekara');
    await addTrackingNode(w8.line.tracking_line_id, 'PS-2025-BP-00401', 'PC_COMMITTEE',
      'Planning Committee: APPROVED');
    await addTrackingNode(w8.line.tracking_line_id, 'PS-2025-BP-00401', 'APPROVED',
      'Building permit approved');
    await addTrackingNode(w8.line.tracking_line_id, 'PS-2025-BP-00401', 'COR_APPLICATION',
      'Applicant submitted COR application — construction complete');
    console.log('  ✅ B2: PS-2025-BP-00401 — COR requested, TO3 David assigned (visible in TO COR tab)');

    // B3: PC_REVIEW — Thilanka Holdings commercial (already w7, escalate to PC)
    await w7.app.update({ status: 'PC_REVIEW' });
    await addTrackingNode(w7.line.tracking_line_id, 'PS-2025-BP-00303', 'TO_INSPECTION',
      'Inspection completed — minor observations on parking layout');
    await addTrackingNode(w7.line.tracking_line_id, 'PS-2025-BP-00303', 'SW_REVIEW',
      'SW reviewed — no external approvals required — escalating to PC');
    await addTrackingNode(w7.line.tracking_line_id, 'PS-2025-BP-00303', 'PC_COMMITTEE',
      'Added to Planning Committee agenda');
    const meeting1 = await PlanningCommitteeMeeting.findOrCreate({
      where: { title: 'PC Meeting — December 2025' },
      defaults: {
        meeting_id: uuidv4(), title: 'PC Meeting — December 2025',
        scheduled_date: daysFromNow(7), venue: 'KPS Board Room', status: 'SCHEDULED',
        created_by: swUser.user_id, quorum_required: 4,
      },
    });
    await PCApplication.findOrCreate({
      where: { application_id: w7.app.application_id },
      defaults: {
        pc_application_id: uuidv4(), meeting_id: meeting1[0].meeting_id,
        application_id: w7.app.application_id, reference_number: 'PS-2025-BP-00303',
        presentation_order: 1, status: 'PENDING', added_by: swUser.user_id, member_minutes: [],
      },
    });
    console.log('  ✅ B3: PS-2025-BP-00303 — PC_REVIEW, on meeting agenda');

    // B4: REJECTED + APPEAL submitted
    const b4 = await createApp({
      ref: 'PS-2025-BP-00601', applicantId: appUsers['anura.b@gmail.com'].appl.applicant_id,
      taxRecordId: taxMap['KEL/RES/010/2024'].tax_record_id, taxNumber: 'KEL/RES/010/2024',
      planTypeId: pt['RESIDENTIAL_COMMERCIAL'].plan_type_id, subPlanType: 'residential-commercial',
      buildingArea: 250.0, siteArea: 11.75, status: 'APPEAL_IN_REVIEW',
      submittedAt: daysAgo(60), storyType: 'MULTI_STORY', floors: 3,
      rejectionReason: 'Proposed building exceeds permissible Floor Area Ratio (FAR) of 1.5 for this zone. The proposed FAR of 2.3 does not comply with UDA regulations. Additionally, the proposed 3-storey structure exceeds the maximum permissible height of 10 metres for residential-commercial buildings in this locality.',
      mapDesc: 'Mahawatta Road, Kelaniya',
    });
    for (const [nt, lbl] of [
      ['PSO_VERIFIED','PSO verified — all documents complete'],
      ['REFERENCE_NUMBER','Reference PS-2025-BP-00601 issued'],
      ['SW_INITIAL','Assigned to TO John Perera'],
      ['TO_INSPECTION','Inspection completed — concerns on FAR and height'],
      ['SW_REVIEW','SW reviewed — escalating to PC'],
      ['PC_COMMITTEE','Planning Committee decision: REJECTED'],
      ['REJECTED','Application rejected — FAR and height non-compliance'],
      ['APPEAL','Appeal submitted — escalated to TO for re-inspection'],
    ]) { await addTrackingNode(b4.line.tracking_line_id, 'PS-2025-BP-00601', nt, lbl); }
    const { Appeal } = require('../models');
    await Appeal.findOrCreate({
      where: { reference_number: 'PS-2025-BP-00601', appeal_round: 1 },
      defaults: {
        appeal_id: uuidv4(), reference_number: 'PS-2025-BP-00601',
        application_id: b4.app.application_id, appeal_round: 1,
        appeal_reason: 'The applicant has revised the plans to reduce the building to 2 storeys with a FAR of 1.45, which is within the permissible limit. The height has been reduced to 9.2 metres. All previously rejected elements have been addressed. New structural plans and revised site plan are attached for review.',
        status: 'SUBMITTED', submitted_at: daysAgo(5),
      },
    });
    await TaskAssignment.findOrCreate({
      where: { reference_number: 'PS-2025-BP-00601', task_type: 'TO_INSPECTION' },
      defaults: {
        task_id: uuidv4(), reference_number: 'PS-2025-BP-00601',
        application_id: b4.app.application_id,
        assigned_to: to1User.user_id, assigned_by: swUser.user_id,
        task_type: 'TO_INSPECTION', status: 'PENDING',
        assignment_note: 'Appeal Round 1 — re-inspection required with revised plans',
        priority: 'HIGH',
      },
    });
    console.log('  ✅ B4: PS-2025-BP-00601 — REJECTED → Appeal submitted → TO1 assigned');

    // B5: EXTERNAL_APPROVAL — Industrial with HO
    await addTrackingNode(w9.line.tracking_line_id, 'PS-2025-BP-00402', 'PSO_VERIFIED', 'PSO verified');
    await addTrackingNode(w9.line.tracking_line_id, 'PS-2025-BP-00402', 'REFERENCE_NUMBER', 'Reference issued');
    await addTrackingNode(w9.line.tracking_line_id, 'PS-2025-BP-00402', 'SW_INITIAL', 'Assigned to TO3 David');
    await addTrackingNode(w9.line.tracking_line_id, 'PS-2025-BP-00402', 'TO_INSPECTION', 'Inspection done — requires HO clearance');
    await addTrackingNode(w9.line.tracking_line_id, 'PS-2025-BP-00402', 'HO_APPROVAL', 'Forwarded to Health Officer for industrial clearance');
    await w9.app.update({ status: 'EXTERNAL_APPROVAL', requires_ho: true });
    const { ExternalApproval } = require('../models');
    await ExternalApproval.findOrCreate({
      where: { reference_number: 'PS-2025-BP-00402', officer_role: 'HO' },
      defaults: {
        external_approval_id: uuidv4(), reference_number: 'PS-2025-BP-00402',
        application_id: w9.app.application_id, officer_id: hoUser.user_id,
        officer_role: 'HO', status: 'PENDING',
        forwarded_by: swUser.user_id, forwarded_at: daysAgo(2),
        due_date: daysFromNow(14),
      },
    });
    console.log('  ✅ B5: PS-2025-BP-00402 — EXTERNAL_APPROVAL, HO assessment pending');

    // B6: FURTHER_REVIEW — Malini's shop house
    await w2.app.update({ status: 'FURTHER_REVIEW' });
    await addTrackingNode(w2.line.tracking_line_id, 'PS-2025-BP-00202', 'TO_INSPECTION',
      'Inspection done — concerns on structural plan compliance for multi-storey');
    await addTrackingNode(w2.line.tracking_line_id, 'PS-2025-BP-00202', 'SW_REVIEW',
      'SW reviewed — forwarded to PC for decision');
    await addTrackingNode(w2.line.tracking_line_id, 'PS-2025-BP-00202', 'PC_COMMITTEE',
      'PC decision: FURTHER REVIEW — additional structural assessment required');
    await addTrackingNode(w2.line.tracking_line_id, 'PS-2025-BP-00202', 'FURTHER_REVIEW',
      'Returned for further review — structural engineer\'s certificate required for 2-storey frame');
    await Minute.findOrCreate({
      where: { reference_number: 'PS-2025-BP-00202', minute_type: 'PC_MEETING' },
      defaults: {
        minute_id: uuidv4(), reference_number: 'PS-2025-BP-00202',
        application_id: w2.app.application_id, authored_by: chairUser.user_id,
        minute_type: 'PC_MEETING', visibility: 'OFFICERS_ONLY', status: 'SUBMITTED',
        content: 'Planning Committee observes that the submitted structural plans for this 2-storey residential-commercial building do not include a certification from a Chartered Structural Engineer as required under Section 8A of the UDA Act. The application is returned for further review. The applicant must submit a certified structural calculation report before the application can be reconsidered.',
        submitted_at: daysAgo(3),
      },
    });
    console.log('  ✅ B6: PS-2025-BP-00202 — FURTHER_REVIEW after PC meeting');

    // B7: Extension used once — Roshan Gunawardena (already w4 — PS-2025-BP-00204)
    // This app went through full approval cycle and applicant requested one extension
    await addTrackingNode(w4.line.tracking_line_id, 'PS-2025-BP-00204', 'SW_REVIEW',
      'SW reviewed TO minute — all clear, escalating to PC');
    await addTrackingNode(w4.line.tracking_line_id, 'PS-2025-BP-00204', 'PC_COMMITTEE',
      'PC decision: APPROVED');
    await addTrackingNode(w4.line.tracking_line_id, 'PS-2025-BP-00204', 'APPROVED',
      'Building permit approved — certificate issued');
    await addTrackingNode(w4.line.tracking_line_id, 'PS-2025-BP-00204', 'TIME_EXTENSION',
      'Time Extension #1 — New expiry: ' + daysFromNow(730).toLocaleDateString('en-LK'));
    await w4.app.update({
      status: 'CERTIFICATE_READY', approval_date: daysAgo(400),
      approval_expiry_date: daysFromNow(730), extension_count: 1,
    });
    await TimeExtension.findOrCreate({
      where: { reference_number: 'PS-2025-BP-00204' },
      defaults: {
        extension_id: uuidv4(), reference_number: 'PS-2025-BP-00204',
        application_id: w4.app.application_id, requested_by: appUsers['roshan.g@gmail.com'].user.user_id,
        extension_number: 1, extension_years: 1, reason: 'Construction delayed due to material shortages.',
        old_expiry_date: daysAgo(30), new_expiry_date: daysFromNow(730),
        fee_amount: 200, status: 'APPROVED',
        granted_by: chairUser.user_id, granted_at: daysAgo(25),
      },
    });
    console.log('  ✅ B7: PS-2025-BP-00204 — APPROVED + 1 extension used (1 remaining)');

    // ══════════════════════════════════════════════════════════════════════════
    // 8. PRINT SUMMARY
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n══════════════════════════════════════════════════════════════');
    console.log('✅  DEMO SEED COMPLETE');
    console.log('══════════════════════════════════════════════════════════════');
    console.log('\n  ── OFFICER LOGINS (all password: Demo@2024!) ─────────────');
    console.log('  PSO:      pso@kps.lk');
    console.log('  SW:       sw@kps.lk');
    console.log('  TO1:      to1@kps.lk       (4 tasks — 60% workload)');
    console.log('  TO2:      to2@kps.lk       (3 tasks — 40% workload)');
    console.log('  TO3:      to3@kps.lk       (2 tasks — 25% workload)');
    console.log('  PHI:      phi@kps.lk');
    console.log('  HO:       ho@kps.lk');
    console.log('  RDA:      rda@kps.lk');
    console.log('  UDA:      uda@kps.lk');
    console.log('  Chairman: chairman@kps.lk');
    console.log('\n  ── APPLICANT LOGINS (all password: Demo@2024!) ───────────');
    console.log('  kamal.j@gmail.com      — A1: All Clear in PSO queue');
    console.log('  samanthi.p@gmail.com   — A2: Name Mismatch in PSO queue');
    console.log('  sunanda.e@gmail.com    — A3: Complaint (red dot) in PSO queue');
    console.log('  nimal.f@gmail.com      — A4: Doc Issue (edit btn unlocked)');
    console.log('  buddhika.j@gmail.com   — A5: Walk-in, in SW queue');
    console.log('  priyanka.w@gmail.com   — B1: APPROVED, cert pending signature');
    console.log('  chaminda.r@gmail.com   — B2: COR requested');
    console.log('  thilanka.h@gmail.com   — B3: In PC meeting agenda');
    console.log('  anura.b@gmail.com      — B4: Rejected + Appeal submitted');
    console.log('  malini.s@gmail.com     — B6: Further Review');
    console.log('  roshan.g@gmail.com     — B7: Approved, 1 extension used');
    console.log('\n  ── DEMO FLOW GUIDE ──────────────────────────────────────');
    console.log('  1. PSO login → see A1(clear) A2(mismatch) A3(complaint🔴) A4(docissue)');
    console.log('  2. PSO: escalate A1 to SW → ref number generated');
    console.log('  3. SW login → assign A5/A1 to TO (workload bars visible)');
    console.log('  4. SW: review W4 minute → forward to PC meeting');
    console.log('  5. TO1 login → pending list, schedule W1, submit minute for W1');
    console.log('  6. TO1: see W3 (scheduled) → accept counter-proposal from applicant');
    console.log('  7. TO3 login → see COR tab with W8');
    console.log('  8. Chairman login → Generate Certs tab → sign B1 cert');
    console.log('  9. PC meeting → add B3 to agenda → submit minutes → decide');
    console.log('  10.HO login → see B5 in assigned list → submit assessment');
    console.log('══════════════════════════════════════════════════════════════\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Demo seed failed:', err.message, '\n', err.stack);
    process.exit(1);
  }
}

demoSeed();
