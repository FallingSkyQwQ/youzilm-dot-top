import { HttpError, type Env } from "../types";
const encoder = new TextEncoder();
function encode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
function decode(text: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(text.replaceAll("-", "+").replaceAll("_", "/")), c => c.charCodeAt(0));
}
async function key(secret: string) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
export type Session = { expires: number; csrf: string; kind: "admin" | "waline"; token?: string };
export async function signSession(session: Session, secret: string): Promise<string> {
  const payload = encode(encoder.encode(JSON.stringify(session)));
  const signature = await crypto.subtle.sign("HMAC", await key(secret), encoder.encode(payload));
  return payload + "." + encode(new Uint8Array(signature));
}
export async function verifySession(value: string | undefined, secret: string, kind: Session["kind"] = "admin"): Promise<Session | null> {
  if (!value || !secret) return null;
  try {
    const [payload, signature, extra] = value.split(".");
    if (!payload || !signature || extra) return null;
    if (!await crypto.subtle.verify("HMAC", await key(secret), decode(signature), encoder.encode(payload))) return null;
    const session = JSON.parse(new TextDecoder().decode(decode(payload))) as Session;
    return session.kind === kind && Number.isFinite(session.expires) && session.expires > Date.now() && typeof session.csrf === "string" ? session : null;
  } catch { return null; }
}
export function cookie(request: Request, name: string): string | undefined {
  return request.headers.get("cookie")?.split(";").map(s => s.trim()).find(s => s.startsWith(name + "="))?.slice(name.length + 1);
}
export function setCookie(request: Request, name: string, value: string, maxAge = 28800): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${name}=${value}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}
export function checkOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) throw new HttpError(403, "请求来源无效，请重新打开后台。");
}
export async function authenticate(request: Request, env: Env): Promise<Session> {
  const session = await verifySession(cookie(request, "blog_admin"), env.ADMIN_SESSION_SECRET);
  if (!session) throw new HttpError(401, "登录已过期，请重新登录。");
  if (!["GET", "HEAD"].includes(request.method)) {
    checkOrigin(request);
    if (request.headers.get("x-csrf-token") !== session.csrf) throw new HttpError(403, "请求校验失败，请刷新页面。");
  }
  return session;
}
export async function verifyPassword(input: string, expected: string): Promise<boolean> {
  const digest = (value: string) => crypto.subtle.digest("SHA-256", encoder.encode(value));
  const a = new Uint8Array(await digest(input)), b = new Uint8Array(await digest(expected));
  let different = 0;
  for (let i = 0; i < a.length; i++) different |= a[i] ^ b[i];
  return different === 0;
}
