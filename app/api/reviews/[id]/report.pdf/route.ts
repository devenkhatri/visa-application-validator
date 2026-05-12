// app/api/reviews/[id]/report.pdf/route.ts — GET: generate and stream PDF report
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { reviews, reviewResults } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { GapItem, ScoreBreakdown, AnalysisResult } from '@/lib/ai/types';

// React PDF — dynamically imported to avoid SSR issues
async function generatePDF(data: {
  review:  typeof reviews.$inferSelect;
  result:  typeof reviewResults.$inferSelect;
  checklist: { country: string; visa_type: string; flag: string };
}): Promise<Uint8Array> {
  const {
    Document, Page, Text, View, StyleSheet, renderToBuffer, Font,
  } = await import('@react-pdf/renderer');

  const { createElement: h } = await import('react');

  const styles = StyleSheet.create({
    page:        { padding: 40, fontFamily: 'Helvetica', fontSize: 11, color: '#1a1a2e' },
    title:       { fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
    subtitle:    { fontSize: 13, color: '#6b7280', marginBottom: 24 },
    section:     { marginBottom: 20 },
    heading:     { fontSize: 14, fontWeight: 'bold', marginBottom: 10, color: '#1e3a5f' },
    row:         { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#e5e7eb', paddingVertical: 6 },
    headerRow:   { flexDirection: 'row', backgroundColor: '#1e3a5f', paddingVertical: 6, paddingHorizontal: 4 },
    headerCell:  { color: '#ffffff', fontWeight: 'bold', flex: 1, fontSize: 10 },
    cell:        { flex: 1, fontSize: 9, paddingHorizontal: 4 },
    scoreBox:    { backgroundColor: '#f3f4f6', padding: 16, borderRadius: 8, marginBottom: 20, alignItems: 'center' },
    scoreBig:    { fontSize: 40, fontWeight: 'bold', color: '#1e3a5f' },
    verdict:     { fontSize: 14, marginTop: 4 },
    bullet:      { marginBottom: 4 },
    footer:      { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 8, color: '#9ca3af', textAlign: 'center' },
  });

  const gap       = data.result.gapAnalysis as unknown as GapItem[];
  const breakdown = data.result.scoreBreakdown as unknown as ScoreBreakdown;
  const result    = data.result;
  const review    = data.review;

  const verdictColors: Record<string, string> = {
    strong:       '#16a34a',
    moderate:     '#ca8a04',
    weak:         '#ea580c',
    insufficient: '#dc2626',
  };
  const verdictColor = verdictColors[result.verdict ?? 'insufficient'] ?? '#6b7280';

  const statusEmoji: Record<string, string> = {
    present:  '✓ Present',
    missing:  '✗ Missing',
    weak:     '⚠ Weak',
    expired:  '✗ Expired',
  };

  const doc = h(Document, {},
    h(Page, { size: 'A4', style: styles.page },
      // Header
      h(View, { style: styles.section },
        h(Text, { style: styles.title }, `${data.checklist.flag} ${data.checklist.country} — ${data.checklist.visa_type}`),
        h(Text, { style: styles.subtitle },
          `Applicant Nationality: ${review.nationality ?? 'Not specified'} | Generated: ${new Date().toLocaleDateString('en-GB')}`
        ),
      ),
      // Score
      h(View, { style: styles.scoreBox },
        h(Text, { style: styles.scoreBig }, `${result.overallScore ?? 0}/100`),
        h(Text, { style: { ...styles.verdict, color: verdictColor } },
          (result.verdict ?? 'unknown').toUpperCase()
        ),
      ),
      // Score breakdown
      h(View, { style: styles.section },
        h(Text, { style: styles.heading }, 'Score Breakdown'),
        ...(breakdown ? Object.entries(breakdown).map(([key, val]) =>
          h(View, { style: styles.row, key },
            h(Text, { style: { ...styles.cell, flex: 2 } },
              key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
            ),
            h(Text, { style: styles.cell }, `${val}/100`),
          )
        ) : []),
      ),
      // Gap analysis table
      h(View, { style: styles.section },
        h(Text, { style: styles.heading }, 'Gap Analysis'),
        h(View, { style: styles.headerRow },
          h(Text, { style: { ...styles.headerCell, flex: 2 } }, 'Document'),
          h(Text, { style: styles.headerCell }, 'Status'),
          h(Text, { style: styles.headerCell }, 'Severity'),
          h(Text, { style: { ...styles.headerCell, flex: 3 } }, 'Recommendation'),
        ),
        ...(gap ?? []).map((item, i) =>
          h(View, { style: { ...styles.row, backgroundColor: i % 2 === 0 ? '#f9fafb' : '#fff' }, key: i },
            h(Text, { style: { ...styles.cell, flex: 2 } }, item.item),
            h(Text, { style: styles.cell }, statusEmoji[item.status] ?? item.status),
            h(Text, { style: styles.cell }, item.severity),
            h(Text, { style: { ...styles.cell, flex: 3 } }, item.recommendation),
          )
        ),
      ),
      // Recommended actions
      h(View, { style: styles.section },
        h(Text, { style: styles.heading }, 'Recommended Actions'),
        ...((data.result as unknown as AnalysisResult).recommended_actions ?? []).map((action, i) =>
          h(Text, { style: styles.bullet, key: i }, `${i + 1}. ${action}`)
        ),
      ),
      // Footer
      h(Text, { style: styles.footer },
        'Generated by Visa AI Review System — This report is for guidance only and does not constitute legal advice.'
      ),
    )
  );

  return renderToBuffer(doc);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const review = await db.select().from(reviews).where(eq(reviews.id, id)).limit(1);
    if (!review[0]) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }
    if (review[0].status !== 'completed') {
      return NextResponse.json({ error: 'Review not yet completed' }, { status: 202 });
    }

    const result = await db.select().from(reviewResults).where(eq(reviewResults.reviewId, id)).limit(1);
    if (!result[0]) {
      return NextResponse.json({ error: 'Result not found' }, { status: 404 });
    }

    const { getChecklist } = await import('@/lib/checklists');
    const checklist = getChecklist(review[0].checklistId);

    const pdfBuffer = await generatePDF({ review: review[0], result: result[0], checklist });

    return new Response(Buffer.from(pdfBuffer), {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="visa-review-${id.slice(0, 8)}.pdf"`,
      },
    });
  } catch (err) {
    console.error('[GET /api/reviews/[id]/report.pdf]', err);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
