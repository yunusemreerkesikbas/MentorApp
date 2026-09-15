import type { MentorshipWeeklyReportShareDto } from "@mentor/types";
import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";

export type WeeklyReportPdfCopy = {
  title: string;
  version: string;
  period: string;
  preparedBy: string;
  preparedAt: string;
  current: string;
  previous: string;
  focus: string;
  sessions: string;
  activeDays: string;
  plan: string;
  completion: string;
  subjects: string;
  mocks: string;
  mockAttempts: string;
  mockAverage: string;
  shareTitle: string;
  note: string;
  missing: string;
  unclassified: string;
};

export async function downloadWeeklyReportPdf(
  report: MentorshipWeeklyReportShareDto,
  locale: string,
  copy: WeeklyReportPdfCopy,
): Promise<void> {
  const [{ default: pdfMake }, { default: fontVfs }] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  pdfMake.addVirtualFileSystem(fontVfs);
  await pdfMake.createPdf(buildWeeklyReportDocument(report, locale, copy)).download(
    weeklyReportFilename(report.studentDisplayName, report.period.startDate),
  );
}

export function weeklyReportFilename(studentName: string, weekStart: string): string {
  const slug = studentName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${slug || "ogrenci"}-haftalik-degerlendirme-${weekStart}.pdf`;
}

function buildWeeklyReportDocument(
  report: MentorshipWeeklyReportShareDto,
  locale: string,
  copy: WeeklyReportPdfCopy,
): TDocumentDefinitions {
  const number = new Intl.NumberFormat(locale);
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });
  const missing = copy.missing;
  const net = (value: number | null) => (value === null ? missing : number.format(value));
  const rate = (value: number | null) => (value === null ? missing : percent.format(value));
  const minutes = (value: number) => `${number.format(value)} ${locale === "tr" ? "dk" : "min"}`;
  const comparisonRows: TableCell[][] = [
    [copy.focus, minutes(report.snapshot.current.focusMinutes), minutes(report.snapshot.previous.focusMinutes)],
    [copy.sessions, number.format(report.snapshot.current.sessions), number.format(report.snapshot.previous.sessions)],
    [copy.activeDays, number.format(report.snapshot.current.activeDays), number.format(report.snapshot.previous.activeDays)],
    [copy.plan, `${report.snapshot.current.completedTasks} / ${report.snapshot.current.plannedTasks}`, `${report.snapshot.previous.completedTasks} / ${report.snapshot.previous.plannedTasks}`],
    [copy.completion, rate(report.snapshot.current.completionRate), rate(report.snapshot.previous.completionRate)],
  ];
  const subjectRows: TableCell[][] = report.snapshot.subjects.map((subject) => [
    subject.subjectRef ?? copy.unclassified,
    `${minutes(subject.currentFocusMinutes)}, ${number.format(subject.currentSessions)} ${copy.sessions.toLocaleLowerCase(locale)}`,
    `${minutes(subject.previousFocusMinutes)}, ${number.format(subject.previousSessions)} ${copy.sessions.toLocaleLowerCase(locale)}`,
  ]);
  const mockRows: TableCell[][] = [
    [copy.mockAttempts, number.format(report.snapshot.mocks.currentAttemptCount), number.format(report.snapshot.mocks.previousAttemptCount)],
    [copy.mockAverage, net(report.snapshot.mocks.currentAverageNet), net(report.snapshot.mocks.previousAverageNet)],
    ...report.snapshot.mocks.subjects.map((subject) => [subject.subjectRef, net(subject.currentAverageNet), net(subject.previousAverageNet)]),
  ];
  const content: Content[] = [
    { text: copy.version, color: "#3568c5", bold: true, fontSize: 9, marginBottom: 8 },
    { text: copy.title, style: "title" },
    { text: report.studentDisplayName, style: "student" },
    { text: copy.period, color: "#5f6672", marginBottom: 12 },
    { text: `${copy.preparedBy}\n${copy.preparedAt}`, color: "#5f6672", fontSize: 9, marginBottom: 18 },
    comparisonTable(copy, comparisonRows),
    sectionTitle(copy.subjects),
    subjectRows.length > 0 ? comparisonTable(copy, subjectRows) : { text: missing, color: "#5f6672", marginBottom: 14 },
    sectionTitle(copy.mocks),
    comparisonTable(copy, mockRows),
  ];
  if (report.coachEvaluation) {
    content.push({
      stack: [
        { text: copy.shareTitle, bold: true, marginBottom: 6 },
        { text: report.coachEvaluation, lineHeight: 1.35 },
      ],
      fillColor: "#f3f6fb",
      margin: [0, 16, 0, 0],
    });
  }
  content.push({ text: copy.note, color: "#5f6672", fontSize: 8, margin: [0, 18, 0, 0] });

  return {
    pageSize: "A4",
    pageMargins: [42, 42, 42, 42],
    defaultStyle: { font: "Roboto", fontSize: 10, color: "#25282d" },
    styles: {
      title: { fontSize: 21, bold: true, marginBottom: 5 },
      student: { fontSize: 14, bold: true, marginBottom: 4 },
      section: { fontSize: 12, bold: true, marginTop: 18, marginBottom: 7 },
    },
    content,
  };
}

function comparisonTable(copy: WeeklyReportPdfCopy, rows: TableCell[][]): Content {
  return {
    table: {
      headerRows: 1,
      widths: ["*", 95, 95],
      body: [["", copy.current, copy.previous], ...rows],
    },
    layout: "lightHorizontalLines",
    marginBottom: 8,
  };
}

function sectionTitle(text: string): Content {
  return { text, style: "section" };
}
