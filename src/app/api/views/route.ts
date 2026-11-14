import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

type Statement = {
  bind(...values: unknown[]): Statement;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
};

type ViewsDatabase = {
  prepare(query: string): Statement;
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function cleanPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const path = value.trim();
  if (!path.startsWith("/")) return null;
  if (path.length < 2 || path.length > 200) return null;
  if (path.includes("://") || path.includes("\\")) return null;
  return path;
}

function getDb(): ViewsDatabase | null {
  try {
    const env = getCloudflareContext().env as unknown as {
      VIEWS_DB?: ViewsDatabase;
    };
    return env.VIEWS_DB ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: Request): Promise<Response> {
  const path = cleanPath(new URL(request.url).searchParams.get("path"));
  if (!path) return json({ error: "invalid path" }, 400);

  const db = getDb();
  if (!db) return json({ count: 0, enabled: false });

  try {
    const row = await db
      .prepare("SELECT count FROM views WHERE path = ?1")
      .bind(path)
      .first<{ count: number }>();
    return json({ count: row?.count ?? 0, enabled: true });
  } catch {
    return json({ count: 0, enabled: false });
  }
}

export async function POST(request: Request): Promise<Response> {
  let path: string | null = null;
  try {
    const body = (await request.json()) as { path?: unknown };
    path = cleanPath(body.path);
  } catch {
    path = null;
  }
  if (!path) return json({ error: "invalid path" }, 400);

  const db = getDb();
  if (!db) return json({ count: 0, enabled: false });

  try {
    await db
      .prepare(
        `INSERT INTO views (path, count, updated_at)
         VALUES (?1, 1, datetime('now'))
         ON CONFLICT(path) DO UPDATE SET
           count = count + 1,
           updated_at = datetime('now')`,
      )
      .bind(path)
      .run();

    const row = await db
      .prepare("SELECT count FROM views WHERE path = ?1")
      .bind(path)
      .first<{ count: number }>();

    return json({ count: row?.count ?? 1, enabled: true });
  } catch {
    return json({ count: 0, enabled: false });
  }
}
