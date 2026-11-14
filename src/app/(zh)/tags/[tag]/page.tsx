import type { Metadata } from "next";
import { getTags } from "@/lib/content";
import { tagMetadata } from "@/lib/page-meta";
import { TagPage } from "@/views/tag-page";

type Props = { params: Promise<{ tag: string }> };

export function generateStaticParams() {
  return getTags("zh").map((tag) => ({ tag: tag.key }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag } = await params;
  return tagMetadata("zh", tag);
}

export default async function Page({ params }: Props) {
  const { tag } = await params;
  return <TagPage locale="zh" tagKey={tag} />;
}
