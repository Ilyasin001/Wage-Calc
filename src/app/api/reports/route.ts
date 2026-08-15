import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { buildReportData } from "@/lib/report-data";
import { renderReportPdf } from "@/lib/report-pdf";

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(request: NextRequest) {
  // Proxy already guards this route; re-check for defense in depth (spec §7).
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }
  const { from, to } = parsed.data;
  if (from > to) {
    return NextResponse.json({ error: "Invalid range" }, { status: 400 });
  }

  const data = await buildReportData(from, to);
  const buffer = await renderReportPdf(data);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="wage-report_${from}_to_${to}.pdf"`,
    },
  });
}
