import {
  Document,
  Page,
  renderToBuffer,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import {
  formatDate,
  formatMinutesAsHours,
  formatPence,
  formatTime,
} from "@/lib/format";
import type { ReportData, ReportShift } from "@/lib/report-data";

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 8.5, fontFamily: "Helvetica" },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  subtitle: { fontSize: 8.5, color: "#555", marginBottom: 4 },
  note: { fontSize: 7.5, color: "#777", marginBottom: 12 },
  shiftBlock: { marginBottom: 14 },
  shiftHeader: {
    backgroundColor: "#dce9ff",
    padding: 6,
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
  },
  shiftSub: { padding: 4, paddingLeft: 6, color: "#444" },
  batchHeader: {
    backgroundColor: "#eff4ff",
    paddingVertical: 3,
    paddingHorizontal: 6,
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    marginTop: 4,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#ddd",
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  headRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    paddingVertical: 3,
    paddingHorizontal: 6,
    fontFamily: "Helvetica-Bold",
  },
  name: { width: "20%" },
  phone: { width: "14%" },
  times: { width: "14%" },
  brk: { width: "8%", textAlign: "right" },
  hours: { width: "10%", textAlign: "right" },
  rate: { width: "10%", textAlign: "right" },
  extra: { width: "11%", textAlign: "right" },
  total: { width: "13%", textAlign: "right" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    padding: 6,
    fontFamily: "Helvetica-Bold",
  },
  grand: {
    marginTop: 8,
    padding: 8,
    backgroundColor: "#dce9ff",
    flexDirection: "row",
    justifyContent: "space-between",
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginTop: 10,
    marginBottom: 6,
  },
  sName: { width: "24%" },
  sPhone: { width: "16%" },
  sShifts: { width: "10%", textAlign: "right" },
  sHours: { width: "12%", textAlign: "right" },
  sBase: { width: "13%", textAlign: "right" },
  sExtra: { width: "12%", textAlign: "right" },
  sTotal: { width: "13%", textAlign: "right" },
});

function ShiftSection({ shift }: { shift: ReportShift }) {
  return (
    <View style={styles.shiftBlock} wrap={false}>
      <Text style={styles.shiftHeader}>
        {formatDate(shift.startAt)} — {shift.location} —{" "}
        {formatTime(shift.startAt)}–{formatTime(shift.endAt)}
      </Text>
      <Text style={styles.shiftSub}>
        {shift.staffCount} staff in{" "}
        {shift.batches.length === 1
          ? "1 batch"
          : `${shift.batches.length} batches`}{" "}
        · base {formatPence(shift.baseRatePence)}/hr · supervisor{" "}
        {formatPence(shift.supervisorRatePence)}/hr
        {shift.description ? ` · ${shift.description}` : ""}
      </Text>

      {shift.batches.map((batch) => (
        <View key={batch.batchId}>
          <Text style={styles.batchHeader}>
            {batch.label} — {formatTime(batch.startAt)}–
            {formatTime(batch.endAt)} — {batch.entries.length} staff —{" "}
            {formatPence(batch.totalPence)}
          </Text>
          <View style={styles.headRow}>
            <Text style={styles.name}>Name</Text>
            <Text style={styles.phone}>Phone</Text>
            <Text style={styles.times}>Times</Text>
            <Text style={styles.brk}>Break</Text>
            <Text style={styles.hours}>Hours</Text>
            <Text style={styles.rate}>Rate</Text>
            <Text style={styles.extra}>Additional</Text>
            <Text style={styles.total}>Total</Text>
          </View>
          {batch.entries.map((e) => (
            <View key={e.entryId} style={styles.row}>
              <Text style={styles.name}>
                {e.name}
                {e.isSupervisor ? " (S)" : ""}
              </Text>
              <Text style={styles.phone}>{e.phone ?? "—"}</Text>
              <Text style={styles.times}>
                {formatTime(e.startAt)}–{formatTime(e.endAt)}
              </Text>
              <Text style={styles.brk}>{e.breakMinutes}m</Text>
              <Text style={styles.hours}>
                {formatMinutesAsHours(e.pay.grossMinutes)}
              </Text>
              <Text style={styles.rate}>{formatPence(e.pay.ratePence)}</Text>
              <Text style={styles.extra}>
                {e.pay.additionalPence
                  ? formatPence(e.pay.additionalPence)
                  : "—"}
              </Text>
              <Text style={styles.total}>{formatPence(e.pay.totalPence)}</Text>
            </View>
          ))}
        </View>
      ))}

      <View style={styles.totalRow}>
        <Text>Shift total: {formatPence(shift.totalPence)}</Text>
      </View>
    </View>
  );
}

function ReportDocument({ data }: { data: ReportData }) {
  return (
    <Document title={`Wage report ${data.from} to ${data.to}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Wage report</Text>
        <Text style={styles.subtitle}>
          {data.from} to {data.to} · generated{" "}
          {formatDate(data.generatedAt)}, {formatTime(data.generatedAt)} ·
          Wage-Calc
        </Text>
        <Text style={styles.note}>
          Hours show total time on site including breaks. Pay is calculated on
          hours worked after deducting the break shown.
        </Text>

        {data.shifts.map((s) => (
          <ShiftSection key={s.id} shift={s} />
        ))}

        <View style={styles.grand}>
          <Text>Grand total ({data.shifts.length} shifts)</Text>
          <Text>{formatPence(data.grandTotalPence)}</Text>
        </View>

        <Text style={styles.sectionTitle} break={data.shifts.length > 0}>
          Per-staff summary
        </Text>
        <View style={styles.headRow}>
          <Text style={styles.sName}>Name</Text>
          <Text style={styles.sPhone}>Phone</Text>
          <Text style={styles.sShifts}>Shifts</Text>
          <Text style={styles.sHours}>Hours</Text>
          <Text style={styles.sBase}>Base pay</Text>
          <Text style={styles.sExtra}>Additional</Text>
          <Text style={styles.sTotal}>Total</Text>
        </View>
        {data.staffSummary.map((s) => (
          <View key={s.name} style={styles.row}>
            <Text style={styles.sName}>{s.name}</Text>
            <Text style={styles.sPhone}>{s.phone ?? "—"}</Text>
            <Text style={styles.sShifts}>{s.shiftCount}</Text>
            <Text style={styles.sHours}>
              {formatMinutesAsHours(s.grossMinutes)}
            </Text>
            <Text style={styles.sBase}>{formatPence(s.basePence)}</Text>
            <Text style={styles.sExtra}>
              {s.additionalPence ? formatPence(s.additionalPence) : "—"}
            </Text>
            <Text style={styles.sTotal}>{formatPence(s.totalPence)}</Text>
          </View>
        ))}
        <View style={styles.grand}>
          <Text>All staff</Text>
          <Text>{formatPence(data.grandTotalPence)}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderReportPdf(data: ReportData): Promise<Buffer> {
  return renderToBuffer(<ReportDocument data={data} />);
}
