import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPost, getSlugs } from "@/lib/content";
import { postMetadata } from "@/lib/page-meta";
import { ArticlePage } from "@/views/article-page";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getSlugs("zh").map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return postMetadata("zh", slug);
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  if (!getPost("zh", slug)) notFound();
  return <ArticlePage locale="zh" slug={slug} />;
}
