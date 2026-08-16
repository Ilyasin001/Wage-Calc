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
import type { BatchView } from "@/lib/shift-view";

/**
 * Layout rules that keep a 3-staff shift and a 50-staff shift looking the
 * same:
 *  - Nothing large is marked `wrap={false}`. Only individual rows are
 *    unbreakable, so long shifts flow onto the next page instead of
 *    overprinting themselves.
 *  - Every row is the same fixed height and every cell has a fixed width,
 *    with `maxLines` so a long name is clipped rather than pushing the row
 *    taller and colliding with its neighbour.
 *  - Table headers repeat at the top of each page of a table.
 *  - Page margins are explicit, with a running footer.
 */

const ROW_HEIGHT = 16;

const COLUMNS = {
  name: "21%",
  phone: "13%",
  times: "14%",
  break: "8%",
  hours: "10%",
  rate: "9%",
  additional: "12%",
  total: "13%",
} as const;

const SUMMARY_COLUMNS = {
  name: "25%",
  phone: "16%",
  shifts: "9%",
  hours: "12%",
  base: "13%",
  additional: "12%",
  total: "13%",
} as const;

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 36,
    fontSize: 8,
    fontFamily: "Helvetica",
    color: "#0b1c30",
  },
  company: { fontSize: 15, fontFamily: "Helvetica-Bold", marginBottom: 1 },
  title: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  subtitle: { fontSize: 8, color: "#555" },
  note: { fontSize: 7, color: "#777", marginTop: 3, marginBottom: 12 },

  shiftBlock: { marginBottom: 12 },
  shiftHeader: {
    backgroundColor: "#dce9ff",
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  shiftHeaderText: { fontSize: 9.5, fontFamily: "Helvetica-Bold" },
  shiftSubText: { fontSize: 7.5, color: "#444", marginTop: 1 },
  batchHeader: {
    backgroundColor: "#eff4ff",
    paddingVertical: 3,
    paddingHorizontal: 6,
    marginTop: 5,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  batchHeaderText: { fontSize: 8, fontFamily: "Helvetica-Bold" },

  headRow: {
    flexDirection: "row",
    alignItems: "center",
    height: ROW_HEIGHT,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    paddingHorizontal: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    height: ROW_HEIGHT,
    overflow: "hidden",
    borderBottomWidth: 0.5,
    borderBottomColor: "#dfe3ea",
    paddingHorizontal: 6,
  },
  headCell: { fontSize: 7.5, fontFamily: "Helvetica-Bold" },
  cell: { fontSize: 8 },
  right: { textAlign: "right" },

  shiftTotal: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingVertical: 4,
    paddingHorizontal: 6,
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
  },
  grand: {
    marginTop: 6,
    paddingVertical: 7,
    paddingHorizontal: 8,
    backgroundColor: "#dce9ff",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  grandText: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginTop: 12,
    marginBottom: 5,
  },
  footer: {
    position: "absolute",
    bottom: 22,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: "#888",
    borderTopWidth: 0.5,
    borderTopColor: "#dfe3ea",
    paddingTop: 5,
  },
});

/** One data cell. `maxLines` stops long values changing the row height. */
function Cell({
  width,
  children,
  right = false,
  head = false,
}: {
  width: string;
  children: React.ReactNode;
  right?: boolean;
  head?: boolean;
}) {
  return (
    <Text
      style={[
        head ? styles.headCell : styles.cell,
        // maxLines/textOverflow are style properties in react-pdf, and they
        // are what stop a long name from wrapping the row taller.
        { width, maxLines: 1, textOverflow: "ellipsis" },
        ...(right ? [styles.right] : []),
      ]}
    >
      {children}
    </Text>
  );
}

function EntryTableHeader() {
  return (
    // `fixed` repeats this header if the table spills onto another page.
    <View style={styles.headRow} fixed>
      <Cell head width={COLUMNS.name}>
        Name
      </Cell>
      <Cell head width={COLUMNS.phone}>
        Phone
      </Cell>
      <Cell head width={COLUMNS.times}>
        Times
      </Cell>
      <Cell head right width={COLUMNS.break}>
        Break
      </Cell>
      <Cell head right width={COLUMNS.hours}>
        Hours
      </Cell>
      <Cell head right width={COLUMNS.rate}>
        Rate
      </Cell>
      <Cell head right width={COLUMNS.additional}>
        Additional
      </Cell>
      <Cell head right width={COLUMNS.total}>
        Total
      </Cell>
    </View>
  );
}

function BatchSection({ batch }: { batch: BatchView }) {
  return (
    <View>
      <View style={styles.batchHeader} wrap={false}>
        <Text style={styles.batchHeaderText}>
          {batch.label} — {formatTime(batch.startAt)}–{formatTime(batch.endAt)}{" "}
          — {batch.entries.length} staff
        </Text>
        <Text style={styles.batchHeaderText}>
          {formatPence(batch.totalPence)}
        </Text>
      </View>
      <EntryTableHeader />
      {batch.entries.map((e) => (
        // Rows never split; the table flows onto the next page instead.
        <View key={e.entryId} style={styles.row} wrap={false}>
          <Cell width={COLUMNS.name}>
            {e.name}
            {e.isSupervisor ? " (S)" : ""}
          </Cell>
          <Cell width={COLUMNS.phone}>{e.phone ?? "—"}</Cell>
          <Cell width={COLUMNS.times}>
            {formatTime(e.startAt)}–{formatTime(e.endAt)}
          </Cell>
          <Cell right width={COLUMNS.break}>
            {e.breakMinutes}m
          </Cell>
          <Cell right width={COLUMNS.hours}>
            {formatMinutesAsHours(e.pay.grossMinutes)}
          </Cell>
          <Cell right width={COLUMNS.rate}>
            {formatPence(e.pay.ratePence)}
          </Cell>
          <Cell right width={COLUMNS.additional}>
            {e.pay.additionalPence ? formatPence(e.pay.additionalPence) : "—"}
          </Cell>
          <Cell right width={COLUMNS.total}>
            {formatPence(e.pay.totalPence)}
          </Cell>
        </View>
      ))}
    </View>
  );
}

function ShiftSection({ shift }: { shift: ReportShift }) {
  return (
    <View style={styles.shiftBlock}>
      <View style={styles.shiftHeader} wrap={false}>
        <Text style={styles.shiftHeaderText}>
          {formatDate(shift.startAt)} — {shift.location} —{" "}
          {formatTime(shift.startAt)}–{formatTime(shift.endAt)}
        </Text>
        <Text style={styles.shiftSubText}>
          {shift.staffCount} staff in{" "}
          {shift.batches.length === 1
            ? "1 batch"
            : `${shift.batches.length} batches`}{" "}
          · base {formatPence(shift.baseRatePence)}/hr · supervisor{" "}
          {formatPence(shift.supervisorRatePence)}/hr
          {shift.description ? ` · ${shift.description}` : ""}
        </Text>
      </View>
      {shift.batches.map((batch) => (
        <BatchSection key={batch.batchId} batch={batch} />
      ))}
      <View style={styles.shiftTotal} wrap={false}>
        <Text>Shift total: {formatPence(shift.totalPence)}</Text>
      </View>
    </View>
  );
}

function ReportDocument({ data }: { data: ReportData }) {
  const title = data.companyName
    ? `${data.companyName} — wage report`
    : "Wage report";
  return (
    <Document title={`${title} ${data.from} to ${data.to}`}>
      <Page size="A4" style={styles.page}>
        {data.companyName && (
          <Text style={styles.company}>{data.companyName}</Text>
        )}
        <Text style={styles.title}>Wage report</Text>
        <Text style={styles.subtitle}>
          {data.from} to {data.to} · generated {formatDate(data.generatedAt)},{" "}
          {formatTime(data.generatedAt)}
        </Text>
        <Text style={styles.note}>
          Hours show total time on site including breaks. Pay is calculated on
          hours worked after deducting the break shown.
        </Text>

        {data.shifts.map((s) => (
          <ShiftSection key={s.id} shift={s} />
        ))}

        <View style={styles.grand} wrap={false}>
          <Text style={styles.grandText}>
            Grand total ({data.shifts.length}{" "}
            {data.shifts.length === 1 ? "shift" : "shifts"})
          </Text>
          <Text style={styles.grandText}>
            {formatPence(data.grandTotalPence)}
          </Text>
        </View>

        <Text style={styles.sectionTitle} break={data.shifts.length > 0}>
          Per-staff summary
        </Text>
        <View style={styles.headRow} fixed>
          <Cell head width={SUMMARY_COLUMNS.name}>
            Name
          </Cell>
          <Cell head width={SUMMARY_COLUMNS.phone}>
            Phone
          </Cell>
          <Cell head right width={SUMMARY_COLUMNS.shifts}>
            Shifts
          </Cell>
          <Cell head right width={SUMMARY_COLUMNS.hours}>
            Hours
          </Cell>
          <Cell head right width={SUMMARY_COLUMNS.base}>
            Base pay
          </Cell>
          <Cell head right width={SUMMARY_COLUMNS.additional}>
            Additional
          </Cell>
          <Cell head right width={SUMMARY_COLUMNS.total}>
            Total
          </Cell>
        </View>
        {data.staffSummary.map((s) => (
          <View key={s.staffId} style={styles.row} wrap={false}>
            <Cell width={SUMMARY_COLUMNS.name}>{s.name}</Cell>
            <Cell width={SUMMARY_COLUMNS.phone}>{s.phone ?? "—"}</Cell>
            <Cell right width={SUMMARY_COLUMNS.shifts}>
              {s.shiftCount}
            </Cell>
            <Cell right width={SUMMARY_COLUMNS.hours}>
              {formatMinutesAsHours(s.grossMinutes)}
            </Cell>
            <Cell right width={SUMMARY_COLUMNS.base}>
              {formatPence(s.basePence)}
            </Cell>
            <Cell right width={SUMMARY_COLUMNS.additional}>
              {s.additionalPence ? formatPence(s.additionalPence) : "—"}
            </Cell>
            <Cell right width={SUMMARY_COLUMNS.total}>
              {formatPence(s.totalPence)}
            </Cell>
          </View>
        ))}
        <View style={styles.grand} wrap={false}>
          <Text style={styles.grandText}>All staff</Text>
          <Text style={styles.grandText}>
            {formatPence(data.grandTotalPence)}
          </Text>
        </View>

        <View style={styles.footer} fixed>
          <Text>
            {data.companyName ? `${data.companyName} · ` : ""}
            {data.from} to {data.to}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

export async function renderReportPdf(data: ReportData): Promise<Buffer> {
  return renderToBuffer(<ReportDocument data={data} />);
}
