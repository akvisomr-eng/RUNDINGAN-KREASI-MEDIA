import { formatRupiah, getBrowserSupabase } from './supabaseClient';

export interface EnterpriseHqSnapshot {
  generated_at: string;
  branch_filter: string;
  holding: {
    id: string;
    code: string;
    legal_entity_name: string;
    entity_type: string;
    ahu_decree_number: string;
    npwp_number: string;
    oss_master_nib: string;
    kbli_codes: string[];
    medical_director_name: string;
    head_office_address: string;
  };
  branches: Array<{
    id: string;
    code: string;
    name: string;
    city: string;
    province: string;
    dinkes_license_number: string;
    fasyankes_code: string;
    satusehat_org_id: string;
    accreditation_status: string;
    clinic_classification: string;
    is_flagship_hq: boolean;
    head_of_clinic_name: string;
    monthly_revenue_target_idr: number;
    practitioner_count: number;
    patient_count: number;
    realized_revenue_idr: number;
  }>;
  sip_matrix: Array<{
    practitioner_id: string;
    employee_number: string;
    full_name: string;
    profession_type: string;
    collegium_council_name: string;
    str_number: string;
    skp_points_earned: number;
    skp_points_target: number;
    active_sip_count: number;
    sip_slots: Array<{
      slot: number;
      clinic_code: string;
      clinic_city: string;
      sip_number: string;
      valid_until: string;
      practice_days: string;
    }>;
  }>;
  interprofessional_referrals: Array<{
    id: string;
    clinic_code: string;
    patient_name: string;
    medical_record_number: string;
    from_practitioner: string;
    from_profession: string;
    to_profession: string;
    to_practitioner: string;
    clinical_reason: string;
    joint_care_goal: string;
    priority: string;
    status: string;
  }>;
  coa_accounts: Array<{
    id: string;
    account_code: string;
    account_name: string;
    account_type: string;
    normal_balance: string;
    balance_idr: number;
  }>;
  journals: Array<{
    id: string;
    journal_number: string;
    entry_date: string;
    clinic_code: string;
    clinic_city: string;
    source_module: string;
    description: string;
    debit_account_code: string;
    credit_account_code: string;
    amount_idr: number;
  }>;
  payrolls: Array<{
    id: string;
    practitioner_name: string;
    profession_type: string;
    clinic_code: string;
    period_month: string;
    verified_locked_sessions: number;
    base_salary_idr: number;
    total_session_fee_idr: number;
    pph21_deduction_idr: number;
    take_home_pay_idr: number;
    payout_status: string;
  }>;
  purchase_orders: Array<{
    id: string;
    po_number: string;
    clinic_code: string;
    clinic_city: string;
    supplier_name: string;
    pak_alkes_license: string;
    items_summary: string;
    total_amount_idr: number;
    nie_kemenkes_verified: boolean;
    status: string;
  }>;
}

export const FALLBACK_ENTERPRISE_HQ: EnterpriseHqSnapshot = {
  generated_at: new Date().toISOString(),
  branch_filter: 'ALL',
  holding: {
    id: '11111111-2222-3333-4444-555555555500',
    code: 'WICARASEHAT-CORP',
    legal_entity_name: 'PT Wicara Sehat Medika Nusantara',
    entity_type: 'PERSEROAN_TERBATAS',
    ahu_decree_number: 'AHU-0049182.AH.01.01.TAHUN 2024',
    npwp_number: '09.482.716.5-622.000',
    oss_master_nib: '9120300492817',
    kbli_codes: [
      '86104 (Aktivitas Klinik Swasta)',
      '86901 (Pelayanan Kesehatan Tenaga Kesehatan)',
    ],
    medical_director_name: 'dr. Ratna Kusumawati, Sp.KFR., M.Kes',
    head_office_address:
      'Gedung WicaraSehat Center Lt. 3, Jl. Jaksa Agung Suprapto No. 24, Kota Kediri, Jawa Timur',
  },
  branches: [
    {
      id: '11111111-2222-3333-4444-555555555501',
      code: 'KLN-TW-KDR-01',
      name: 'Klinik Utama Rehabilitasi & Terapi Wicara WicaraSehat (Flagship HQ)',
      city: 'Kota Kediri',
      province: 'Jawa Timur',
      dinkes_license_number: '503/442.8/SIP-KLN/DINKES-KDR/2025',
      fasyankes_code: '3571042001',
      satusehat_org_id: '10002849102',
      accreditation_status: 'PARIPURNA',
      clinic_classification: 'KLINIK_UTAMA_REHABILITASI',
      is_flagship_hq: true,
      head_of_clinic_name: 'dr. Ratna Kusumawati, Sp.KFR',
      monthly_revenue_target_idr: 180000000,
      practitioner_count: 4,
      patient_count: 4,
      realized_revenue_idr: 148430000,
    },
    {
      id: '11111111-2222-3333-4444-555555555502',
      code: 'KLN-TW-SBY-02',
      name: 'Klinik Utama Tumbuh Kembang & Terapi Wicara WicaraSehat Cabang Surabaya',
      city: 'Kota Surabaya',
      province: 'Jawa Timur',
      dinkes_license_number: '503.445/0892/SIP-KLN/DINKES-SBY/2025',
      fasyankes_code: '3578114002',
      satusehat_org_id: '10002849209',
      accreditation_status: 'PARIPURNA',
      clinic_classification: 'PUSAT_TUMBUH_KEMBANG_TERPADU',
      is_flagship_hq: false,
      head_of_clinic_name: 'dr. Arief Budiman, Sp.KFR',
      monthly_revenue_target_idr: 250000000,
      practitioner_count: 3,
      patient_count: 18,
      realized_revenue_idr: 214850000,
    },
    {
      id: '11111111-2222-3333-4444-555555555503',
      code: 'KLN-TW-MLG-03',
      name: 'Klinik Pratama Rehabilitasi & Terapi Wicara WicaraSehat Cabang Malang',
      city: 'Kota Malang',
      province: 'Jawa Timur',
      dinkes_license_number: '503/0314/SIP-KLN/DINKES-MLG/2026',
      fasyankes_code: '3573021008',
      satusehat_org_id: '10002849315',
      accreditation_status: 'UTAMA',
      clinic_classification: 'KLINIK_PRATAMA',
      is_flagship_hq: false,
      head_of_clinic_name: 'dr. Sinta Maharani, Sp.A',
      monthly_revenue_target_idr: 140000000,
      practitioner_count: 1,
      patient_count: 11,
      realized_revenue_idr: 108750000,
    },
  ],
  sip_matrix: [
    {
      practitioner_id: 'p-dr-1',
      employee_number: 'MED-SPKFR-001',
      full_name: 'dr. Ratna Kusumawati, Sp.KFR',
      profession_type: 'DOKTER_SP_KFR',
      collegium_council_name: 'Kolegium IKFR / KKI',
      str_number: 'STR-DR-3511908271625501',
      skp_points_earned: 240,
      skp_points_target: 250,
      active_sip_count: 3,
      sip_slots: [
        {
          slot: 1,
          clinic_code: 'KLN-TW-KDR-01',
          clinic_city: 'Kota Kediri',
          sip_number: '503/0012/SIP-DR-1/DINKES-KDR/I/2025',
          valid_until: '2030-01-10',
          practice_days: 'Senin, Rabu, Jumat',
        },
        {
          slot: 2,
          clinic_code: 'KLN-TW-SBY-02',
          clinic_city: 'Kota Surabaya',
          sip_number: '503/0712/SIP-DR-2/DINKES-SBY/II/2025',
          valid_until: '2030-02-01',
          practice_days: 'Selasa & Kamis',
        },
        {
          slot: 3,
          clinic_code: 'KLN-TW-MLG-03',
          clinic_city: 'Kota Malang',
          sip_number: '503/0198/SIP-DR-3/DINKES-MLG/III/2026',
          valid_until: '2031-03-01',
          practice_days: 'Sabtu (Visite Konsultan)',
        },
      ],
    },
    {
      practitioner_id: 'p-tw-1',
      employee_number: 'TW-2023-001',
      full_name: 'Nadia Pramesti, S.Tr.Kes',
      profession_type: 'TERAPIS_WICARA',
      collegium_council_name: 'Kolegium Terapi Wicara / IKATWI',
      str_number: 'STR-TW-1409827162534190',
      skp_points_earned: 185.5,
      skp_points_target: 250,
      active_sip_count: 2,
      sip_slots: [
        {
          slot: 1,
          clinic_code: 'KLN-TW-KDR-01',
          clinic_city: 'Kota Kediri',
          sip_number: '503/0118/SIP-TW-1/DINKES-KDR/II/2024',
          valid_until: '2029-02-15',
          practice_days: 'Senin - Kamis',
        },
        {
          slot: 2,
          clinic_code: 'KLN-TW-SBY-02',
          clinic_city: 'Kota Surabaya',
          sip_number: '503/0991/SIP-TW-2/DINKES-SBY/VI/2025',
          valid_until: '2030-06-01',
          practice_days: 'Jumat - Sabtu',
        },
      ],
    },
    {
      practitioner_id: 'p-tw-2',
      employee_number: 'TW-2024-002',
      full_name: 'Dimas Arya Prakoso, A.Md.TW',
      profession_type: 'TERAPIS_WICARA',
      collegium_council_name: 'Kolegium Terapi Wicara / IKATWI',
      str_number: 'STR-TW-1409827162599812',
      skp_points_earned: 210,
      skp_points_target: 250,
      active_sip_count: 1,
      sip_slots: [
        {
          slot: 1,
          clinic_code: 'KLN-TW-KDR-01',
          clinic_city: 'Kota Kediri',
          sip_number: '503/0204/SIP-TW-1/DINKES-KDR/I/2022',
          valid_until: '2027-01-20',
          practice_days: 'Senin - Sabtu',
        },
      ],
    },
    {
      practitioner_id: 'p-ot-1',
      employee_number: 'OT-2024-001',
      full_name: 'Hana Kartika Putri, S.Tr.Kes',
      profession_type: 'TERAPIS_OKUPASI',
      collegium_council_name: 'Kolegium Okupasi Terapi / IOTI',
      str_number: 'STR-OT-1509281726110092',
      skp_points_earned: 165,
      skp_points_target: 250,
      active_sip_count: 1,
      sip_slots: [
        {
          slot: 1,
          clinic_code: 'KLN-TW-KDR-01',
          clinic_city: 'Kota Kediri',
          sip_number: '503/0189/SIP-OT-1/DINKES-KDR/III/2025',
          valid_until: '2030-03-01',
          practice_days: 'Senin - Jumat',
        },
      ],
    },
    {
      practitioner_id: 'p-psi-1',
      employee_number: 'PSI-2024-001',
      full_name: 'Maya Kusuma Wardhani, M.Psi., Psikolog',
      profession_type: 'PSIKOLOG_KLINIS',
      collegium_council_name: 'Kolegium Psikologi Klinis / IPK',
      str_number: 'STR-PK-1908271625119021',
      skp_points_earned: 195,
      skp_points_target: 250,
      active_sip_count: 1,
      sip_slots: [
        {
          slot: 1,
          clinic_code: 'KLN-TW-SBY-02',
          clinic_city: 'Kota Surabaya',
          sip_number: '503/0441/SIPPK-1/DINKES-SBY/IV/2025',
          valid_until: '2030-04-12',
          practice_days: 'Selasa - Sabtu',
        },
      ],
    },
  ],
  interprofessional_referrals: [
    {
      id: 'ir-1',
      clinic_code: 'KLN-TW-KDR-01',
      patient_name: 'Arkaiyan Putra Wijaya',
      medical_record_number: 'RM-TW-2026-0041',
      from_practitioner: 'Nadia Pramesti, S.Tr.Kes',
      from_profession: 'TERAPIS_WICARA',
      to_profession: 'TERAPIS_OKUPASI',
      to_practitioner: 'Hana Kartika Putri, S.Tr.Kes',
      clinical_reason:
        'Pasien menunjukkan sensory seeking proprioseptif & hipersensitivitas auditori (>75dB) yang memengaruhi atensi duduk saat terapi bahasa ekspresif.',
      joint_care_goal:
        'Co-Treatment TW + OT: Regulasi sensori 15 menit pra-terapi wicara agar joint attention bertahan >=15 menit.',
      priority: 'RUTIN',
      status: 'AKTIF_KOLABORASI',
    },
    {
      id: 'ir-2',
      clinic_code: 'KLN-TW-KDR-01',
      patient_name: 'H. Bambang Sudibyo',
      medical_record_number: 'RM-TW-2026-0072',
      from_practitioner: 'Nadia Pramesti, S.Tr.Kes',
      from_profession: 'TERAPIS_WICARA',
      to_profession: 'DOKTER_SP_KFR',
      to_practitioner: 'dr. Ratna Kusumawati, Sp.KFR',
      clinical_reason:
        'Evaluasi medis berkala risiko aspirasi cairan encer pada disfagia orofaringeal pasca-stroke sebelum naik dari IDDSI Level 2 ke Level 1.',
      joint_care_goal:
        'Konfirmasi protokol rehabilitasi medik menelan & rujukan FEES bila diperlukan.',
      priority: 'CITO_DISFAGIA',
      status: 'AKTIF_KOLABORASI',
    },
  ],
  coa_accounts: [
    { id: 'c1', account_code: '1-1100', account_name: 'Kas & Setara Kas Bank Operasional Klinik (QRIS/VA)', account_type: 'ASET', normal_balance: 'DEBIT', balance_idr: 485250000 },
    { id: 'c2', account_code: '1-1300', account_name: 'Persediaan Alat Oral Motor, Kit Tes & BHP Medis PPI', account_type: 'ASET', normal_balance: 'DEBIT', balance_idr: 94500000 },
    { id: 'c3', account_code: '1-2100', account_name: 'Aset Tetap Ruang Kedap Suara & Instrumen Rehabilitasi Medik', account_type: 'ASET', normal_balance: 'DEBIT', balance_idr: 620000000 },
    { id: 'c4', account_code: '2-1200', account_name: 'Pendapatan Diterima di Muka — Deposit Paket Sesi Pasien (Unearned)', account_type: 'LIABILITAS', normal_balance: 'KREDIT', balance_idr: 68400000 },
    { id: 'c5', account_code: '2-1300', account_name: 'Utang Bagi Hasil Jasa Medis Nakes & PPh Pasal 21', account_type: 'LIABILITAS', normal_balance: 'KREDIT', balance_idr: 42850000 },
    { id: 'c6', account_code: '3-1100', account_name: 'Modal Disetor PT Wicara Sehat Medika Nusantara', account_type: 'EKUITAS', normal_balance: 'KREDIT', balance_idr: 950000000 },
    { id: 'c7', account_code: '4-1100', account_name: 'Pendapatan Pelayanan Klinis Terapi Wicara & Tumbuh Kembang', account_type: 'PENDAPATAN_PELAYANAN', normal_balance: 'KREDIT', balance_idr: 312600000 },
    { id: 'c8', account_code: '5-1100', account_name: 'Beban Jasa Pelayanan Medis (Sp.KFR, TW, OT, Psikolog)', account_type: 'BEBAN_MEDIS', normal_balance: 'DEBIT', balance_idr: 118400000 },
    { id: 'c9', account_code: '5-1200', account_name: 'Beban Pemakaian BHP Sterilisasi PPI & Kalibrasi Alat MFK', account_type: 'BEBAN_MEDIS', normal_balance: 'DEBIT', balance_idr: 24800000 },
    { id: 'c10', account_code: '6-1100', account_name: 'Beban Gaji Staf Administrasi RME, Sewa & Utilitas Cabang', account_type: 'BEBAN_OPERASIONAL', normal_balance: 'DEBIT', balance_idr: 30650000 },
  ],
  journals: [
    { id: 'j1', journal_number: 'JRN/EMS/202611/0001', entry_date: '2026-11-21', clinic_code: 'KLN-TW-KDR-01', clinic_city: 'Kota Kediri', source_module: 'KASIR_KLINIK', description: 'Penerimaan Pembayaran Paket 12 Sesi Terapi Wicara Pediatrik (Deposit Liabilitas)', debit_account_code: '1-1100', credit_account_code: '2-1200', amount_idr: 2160000 },
    { id: 'j2', journal_number: 'JRN/EMS/202611/0002', entry_date: '2026-11-23', clinic_code: 'KLN-TW-KDR-01', clinic_city: 'Kota Kediri', source_module: 'AMORTISASI_PAKET_SESI', description: 'Pengakuan Pendapatan Sesi ke-8 Terkunci TTE (Unearned -> Earned Revenue)', debit_account_code: '2-1200', credit_account_code: '4-1100', amount_idr: 180000 },
    { id: 'j3', journal_number: 'JRN/EMS/202611/0004', entry_date: '2026-11-24', clinic_code: 'KLN-TW-SBY-02', clinic_city: 'Kota Surabaya', source_module: 'KASIR_KLINIK', description: 'Konsolidasi Pendapatan Asesmen Terpadu TW + Psikolog Cabang Surabaya', debit_account_code: '1-1100', credit_account_code: '4-1100', amount_idr: 14850000 },
    { id: 'j4', journal_number: 'JRN/EMS/202611/0005', entry_date: '2026-11-24', clinic_code: 'KLN-TW-MLG-03', clinic_city: 'Kota Malang', source_module: 'KASIR_KLINIK', description: 'Konsolidasi Pendapatan Layanan Terapi Wicara Cabang Malang', debit_account_code: '1-1100', credit_account_code: '4-1100', amount_idr: 8750000 },
    { id: 'j5', journal_number: 'JRN/EMS/202611/0006', entry_date: '2026-11-24', clinic_code: 'KLN-TW-KDR-01', clinic_city: 'Kota Kediri', source_module: 'PAYROLL_JASA_MEDIS', description: 'Akrual Bagi Hasil Jasa Medis Nakes Berbasis Sesi SOAP Terkunci TTE', debit_account_code: '5-1100', credit_account_code: '2-1300', amount_idr: 16450000 },
  ],
  payrolls: [
    { id: 'pr-1', practitioner_name: 'dr. Ratna Kusumawati, Sp.KFR', profession_type: 'DOKTER_SP_KFR', clinic_code: 'KLN-TW-KDR-01', period_month: '2026-11', verified_locked_sessions: 28, base_salary_idr: 12000000, total_session_fee_idr: 4200000, pph21_deduction_idr: 810000, take_home_pay_idr: 15390000, payout_status: 'DIBAYARKAN_LUNAS' },
    { id: 'pr-2', practitioner_name: 'Maya Kusuma Wardhani, M.Psi., Psikolog', profession_type: 'PSIKOLOG_KLINIS', clinic_code: 'KLN-TW-SBY-02', period_month: '2026-11', verified_locked_sessions: 40, base_salary_idr: 6500000, total_session_fee_idr: 4400000, pph21_deduction_idr: 272500, take_home_pay_idr: 10627500, payout_status: 'SIAP_TRANSFER' },
    { id: 'pr-3', practitioner_name: 'Nadia Pramesti, S.Tr.Kes', profession_type: 'TERAPIS_WICARA', clinic_code: 'KLN-TW-KDR-01', period_month: '2026-11', verified_locked_sessions: 64, base_salary_idr: 5200000, total_session_fee_idr: 5440000, pph21_deduction_idr: 266000, take_home_pay_idr: 10374000, payout_status: 'SIAP_TRANSFER' },
    { id: 'pr-4', practitioner_name: 'Hana Kartika Putri, S.Tr.Kes', profession_type: 'TERAPIS_OKUPASI', clinic_code: 'KLN-TW-KDR-01', period_month: '2026-11', verified_locked_sessions: 48, base_salary_idr: 4800000, total_session_fee_idr: 3600000, pph21_deduction_idr: 168000, take_home_pay_idr: 8232000, payout_status: 'SIAP_TRANSFER' },
    { id: 'pr-5', practitioner_name: 'Dimas Arya Prakoso, A.Md.TW', profession_type: 'TERAPIS_WICARA', clinic_code: 'KLN-TW-KDR-01', period_month: '2026-11', verified_locked_sessions: 52, base_salary_idr: 4500000, total_session_fee_idr: 3640000, pph21_deduction_idr: 162800, take_home_pay_idr: 7977200, payout_status: 'SIAP_TRANSFER' },
  ],
  purchase_orders: [
    { id: 'po-1', po_number: 'PO/EMS-TW/202611/0101', clinic_code: 'KLN-TW-KDR-01', clinic_city: 'Kota Kediri', supplier_name: 'PT Medika Rehabilitasi Alkesindo', pak_alkes_license: 'FK.01.01/VI/1928-e/2024 (Izin PAK Kemenkes)', items_summary: '10 Set Probe Z-Vibe Tip Steril + 3 Unit Pulse Oximeter Pediatrik (NIE AKL Kemenkes)', total_amount_idr: 14750000, nie_kemenkes_verified: true, status: 'DITERIMA_GUDANG_STERIL' },
    { id: 'po-2', po_number: 'PO/EMS-TW/202611/0102', clinic_code: 'KLN-TW-SBY-02', clinic_city: 'Kota Surabaya', supplier_name: 'PT Nusantara Steril Husada', pak_alkes_license: 'FK.01.01/VI/3304-e/2025 (Izin Distribusi Alkes)', items_summary: '100 Box Tongue Depressor Kayu Steril + 20 Galon Larutan Enzimatik PPI Cabang Surabaya', total_amount_idr: 8900000, nie_kemenkes_verified: true, status: 'DISETUJUI_DIREKTUR' },
    { id: 'po-3', po_number: 'PO/EMS-TW/202611/0103', clinic_code: 'KLN-TW-MLG-03', clinic_city: 'Kota Malang', supplier_name: 'PT Medika Rehabilitasi Alkesindo', pak_alkes_license: 'FK.01.01/VI/1928-e/2024 (Izin PAK Kemenkes)', items_summary: '2 Kit Lengkap Tes Artikulasi & Bahasa Standar + 1 Sound Level Meter Kalibrasi Cabang Malang', total_amount_idr: 11200000, nie_kemenkes_verified: true, status: 'MENUNGGU_APPROVAL' },
  ],
};

export async function loadEnterpriseHqSnapshot(
  branchCode: string = 'ALL'
): Promise<{ data: EnterpriseHqSnapshot; connected: boolean }> {
  const sb = getBrowserSupabase();
  if (sb) {
    try {
      const { data, error } = await sb.rpc('tw_enterprise_hq_snapshot', {
        p_branch_code: branchCode,
      });
      if (!error && data) {
        return { data: data as EnterpriseHqSnapshot, connected: true };
      }
    } catch {
      // fallback
    }
  }

  if (branchCode === 'ALL') {
    return { data: FALLBACK_ENTERPRISE_HQ, connected: false };
  }

  return {
    connected: false,
    data: {
      ...FALLBACK_ENTERPRISE_HQ,
      branch_filter: branchCode,
      interprofessional_referrals:
        FALLBACK_ENTERPRISE_HQ.interprofessional_referrals.filter(
          (r) => r.clinic_code === branchCode
        ),
      journals: FALLBACK_ENTERPRISE_HQ.journals.filter(
        (j) => j.clinic_code === branchCode
      ),
      payrolls: FALLBACK_ENTERPRISE_HQ.payrolls.filter(
        (p) => p.clinic_code === branchCode
      ),
      purchase_orders: FALLBACK_ENTERPRISE_HQ.purchase_orders.filter(
        (po) => po.clinic_code === branchCode
      ),
    },
  };
}

export { formatRupiah };
