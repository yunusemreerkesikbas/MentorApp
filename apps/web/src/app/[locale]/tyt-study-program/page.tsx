import type { Metadata } from "next";
import {
  generateStudyProgramMetadata,
  StudyProgramLpTemplate,
} from "@/components/seo-lp/study-program-lp-template";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return generateStudyProgramMetadata("tyt", locale);
}

export default async function TytStudyProgramPage({ params }: PageProps) {
  const { locale } = await params;
  return <StudyProgramLpTemplate variant="tyt" locale={locale} />;
}
