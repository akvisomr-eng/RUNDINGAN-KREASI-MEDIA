import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  CheckCircle2,
  ClipboardList,
  CloudOff,
  CloudUpload,
  FileText,
  Filter,
  Search,
  ShieldCheck,
  Stethoscope,
  Trash2,
} from 'lucide-react-native';
import { LocalClinicalRecord, LocalRecordKind } from '../services/localRecordStore';

interface RecordsHistoryScreenProps {
  records: LocalClinicalRecord[];
  pendingQueueCount: number;
  offlineMode: boolean;
  onSyncAll: () => void;
  onDelete: (id: string) => void;
}

const KIND_META: Record<
  LocalRecordKind,
  { label: string; color: string; bg: string; Icon: React.ComponentType<{ size?: number; color?: string }> }
> = {
  SOAP: { label: 'SOAP', color: '#0F766E', bg: '#CCFBF1', Icon: ClipboardList },
  ASESMEN: { label: 'Asesmen', color: '#1D4ED8', bg: '#DBEAFE', Icon: Stethoscope },
  PPI: { label: 'PPI', color: '#7C3AED', bg: '#EDE9FE', Icon: ShieldCheck },
  IKP: { label: 'IKP', color: '#B91C1C', bg: '#FEE2E2', Icon: ShieldCheck },
  RUJUKAN: { label: 'Rujukan', color: '#B45309', bg: '#FEF3C7', Icon: FileText },
};

const FILTERS: Array<{ id: 'ALL' | LocalRecordKind; label: string }> = [
  { id: 'ALL', label: 'Semua' },
  { id: 'SOAP', label: 'SOAP' },
  { id: 'ASESMEN', label: 'Asesmen' },
  { id: 'PPI', label: 'PPI' },
  { id: 'IKP', label: 'IKP' },
  { id: 'RUJUKAN', label: 'Rujukan' },
];

export const RecordsHistoryScreen: React.FC<RecordsHistoryScreenProps> = ({
  records,
  pendingQueueCount,
  offlineMode,
  onSyncAll,
  onDelete,
}) => {
  const [filter, setFilter] = useState<'ALL' | LocalRecordKind>('ALL');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter((r) => {
      const byKind = filter === 'ALL' || r.kind === filter;
      const byQuery =
        !q ||
        r.title.toLowerCase().includes(q) ||
        r.patient_name.toLowerCase().includes(q) ||
        r.medical_record_number.toLowerCase().includes(q);
      return byKind && byQuery;
    });
  }, [records, filter, query]);

  const pending = records.filter((r) => !r.synced).length;

  return (
    <View style={styles.root}>
      {/* Ringkasan & aksi sinkronisasi */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Riwayat Catatan Saya</Text>
          <Text style={styles.subtitle}>
            {records.length} catatan tersimpan di perangkat • {pending} menunggu sinkronisasi
          </Text>
        </View>
        <Pressable
          style={[styles.syncBtn, (offlineMode || pending === 0) && styles.syncBtnDisabled]}
          disabled={offlineMode || pending === 0}
          onPress={() =>
            Alert.alert(
              'Sinkronkan sekarang?',
              `${pending} catatan akan dikirim ke server RME. Pastikan perangkat terhubung internet.`,
              [
                { text: 'Batal', style: 'cancel' },
                { text: 'Kirim', onPress: onSyncAll },
              ]
            )
          }
        >
          <CloudUpload size={14} color="#FFFFFF" />
          <Text style={styles.syncBtnText}>Sinkronkan</Text>
        </Pressable>
      </View>

      {pendingQueueCount > 0 && (
        <View style={styles.banner}>
          <CloudOff size={13} color="#92400E" />
          <Text style={styles.bannerText}>
            {pendingQueueCount} entri masih dalam antrean offline dan akan terkirim otomatis saat online.
          </Text>
        </View>
      )}

      {/* Pencarian */}
      <View style={styles.searchBox}>
        <Search size={14} color="#94A3B8" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Cari pasien, No. RM, atau judul catatan…"
          placeholderTextColor="#94A3B8"
          style={styles.searchInput}
        />
      </View>

      {/* Filter jenis */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 14 }}>
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => setFilter(f.id)}
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                {f.id === 'ALL' && <Filter size={11} color={active ? '#FFFFFF' : '#64748B'} />}
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Daftar catatan */}
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <FileText size={26} color="#94A3B8" />
            <Text style={styles.emptyTitle}>Belum ada catatan</Text>
            <Text style={styles.emptyText}>
              Simpan SOAP dari tab Terapi/SOAP atau asesmen dari tab Asesmen, dan catatan akan muncul di sini.
            </Text>
          </View>
        ) : (
          filtered.map((rec) => {
            const meta = KIND_META[rec.kind];
            const Icon = meta.Icon;
            return (
              <View key={rec.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={[styles.kindBadge, { backgroundColor: meta.bg }]}>
                    <Icon size={12} color={meta.color} />
                    <Text style={[styles.kindBadgeText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      rec.synced ? styles.statusOk : styles.statusPending,
                    ]}
                  >
                    {rec.synced ? (
                      <CheckCircle2 size={10} color="#065F46" />
                    ) : (
                      <CloudOff size={10} color="#92400E" />
                    )}
                    <Text
                      style={[
                        styles.statusText,
                        rec.synced ? styles.statusTextOk : styles.statusTextPending,
                      ]}
                    >
                      {rec.synced ? 'TERKIRIM' : 'ANTREAN'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.cardTitle}>{rec.title}</Text>
                <Text style={styles.cardMeta}>
                  {rec.patient_name || 'Pasien'} • {rec.medical_record_number || 'Tanpa No. RM'}
                </Text>
                <Text style={styles.cardMeta}>
                  {new Date(rec.created_at).toLocaleString('id-ID')}
                </Text>
                {!!rec.summary && <Text style={styles.cardSummary}>{rec.summary}</Text>}

                <Pressable
                  style={styles.deleteBtn}
                  onPress={() =>
                    Alert.alert(
                      'Hapus catatan?',
                      'Catatan yang dihapus dari perangkat tidak dapat dikembalikan. Catatan yang sudah terkirim tetap tersimpan di server RME (retensi 25 tahun).',
                      [
                        { text: 'Batal', style: 'cancel' },
                        { text: 'Hapus', style: 'destructive', onPress: () => onDelete(rec.id) },
                      ]
                    )
                  }
                >
                  <Trash2 size={12} color="#B91C1C" />
                  <Text style={styles.deleteText}>Hapus</Text>
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1F5F9' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
  },
  title: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  subtitle: { fontSize: 10.5, color: '#64748B', marginTop: 2 },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#0F766E',
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 9,
  },
  syncBtnDisabled: { backgroundColor: '#94A3B8' },
  syncBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    marginHorizontal: 14,
    padding: 9,
    borderRadius: 9,
    marginBottom: 8,
  },
  bannerText: { flex: 1, fontSize: 10.5, color: '#92400E', fontWeight: '600', lineHeight: 15 },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    marginHorizontal: 14,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 12, color: '#0F172A' },

  filterRow: { marginTop: 10, marginBottom: 6, maxHeight: 40 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
  },
  filterChipActive: { backgroundColor: '#0F766E', borderColor: '#0F766E' },
  filterText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  filterTextActive: { color: '#FFFFFF' },

  list: { padding: 14, paddingTop: 6, gap: 10, paddingBottom: 28 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kindBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  kindBadgeText: { fontSize: 9.5, fontWeight: '900' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusOk: { backgroundColor: '#D1FAE5' },
  statusPending: { backgroundColor: '#FEF3C7' },
  statusText: { fontSize: 8.5, fontWeight: '900' },
  statusTextOk: { color: '#065F46' },
  statusTextPending: { color: '#92400E' },

  cardTitle: { fontSize: 12.5, fontWeight: '800', color: '#0F172A', marginTop: 8 },
  cardMeta: { fontSize: 10.5, color: '#64748B', marginTop: 2 },
  cardSummary: { fontSize: 10.5, color: '#475569', marginTop: 5, lineHeight: 15 },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 9,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: '#FEF2F2',
  },
  deleteText: { fontSize: 10, fontWeight: '800', color: '#B91C1C' },

  empty: { alignItems: 'center', paddingVertical: 40, gap: 7 },
  emptyTitle: { fontSize: 12.5, fontWeight: '800', color: '#334155' },
  emptyText: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 24,
  },
});
