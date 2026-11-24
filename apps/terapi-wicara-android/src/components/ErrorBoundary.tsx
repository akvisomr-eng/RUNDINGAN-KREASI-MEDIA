import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, RotateCcw } from 'lucide-react-native';

interface Props {
  children: React.ReactNode;
  onReset?: () => void;
}

interface State {
  error: Error | null;
}

/**
 * Penjaga kesalahan layar.
 *
 * Tanpa ini, satu kesalahan render (mis. data pasien tidak lengkap dari server)
 * akan membuat seluruh aplikasi menjadi layar putih — pengalaman yang paling
 * merusak kepercayaan pada aplikasi klinis. Dengan penjaga ini, terapis melihat
 * pesan yang jelas dan dapat memulihkan sesi tanpa kehilangan data lokal.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Jejak kesalahan disimpan di konsol perangkat untuk diagnosis teknisi TI klinik.
    console.error('[WicaraSehat] Kesalahan layar:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.iconBox}>
            <AlertTriangle size={30} color="#B45309" />
          </View>

          <Text style={styles.title}>Layar ini gagal ditampilkan</Text>
          <Text style={styles.body}>
            Catatan klinis yang sudah Anda simpan di perangkat tetap aman dan tidak hilang.
            Tekan tombol di bawah untuk memuat ulang layar.
          </Text>

          <Pressable style={styles.btn} onPress={this.handleReset}>
            <RotateCcw size={16} color="#FFFFFF" />
            <Text style={styles.btnText}>Muat Ulang Layar</Text>
          </Pressable>

          <Text style={styles.detailLabel}>Rincian teknis untuk teknisi TI klinik:</Text>
          <Text style={styles.detailText}>{String(this.state.error?.message ?? 'Kesalahan tidak dikenal')}</Text>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1F5F9' },
  content: { padding: 24, alignItems: 'center', paddingTop: 48 },
  iconBox: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 16, fontWeight: '800', color: '#0F172A', textAlign: 'center' },
  body: {
    fontSize: 12.5,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 9,
  },
  btn: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#0F766E',
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 11,
  },
  btnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  detailLabel: {
    marginTop: 30,
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    alignSelf: 'flex-start',
  },
  detailText: {
    marginTop: 5,
    fontSize: 10,
    color: '#94A3B8',
    alignSelf: 'flex-start',
    fontFamily: 'monospace',
    lineHeight: 15,
  },
});
