import type { Metadata } from "next";
import { ProjectsPage } from "@/views/projects-page";
import { staticPageMetadata } from "@/lib/page-meta";

export const metadata: Metadata = staticPageMetadata("zh", "projects");

export default function Page() {
  return <ProjectsPage locale="zh" />;
}
