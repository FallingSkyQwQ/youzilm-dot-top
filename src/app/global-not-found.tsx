import "@/styles/globals.css";
import { notoSerif } from "@/lib/fonts";
import { themeScript } from "@/lib/theme-script";

export const metadata = {
  title: "404 · 柚子的blog",
  description: "页面不存在。",
};

export default function GlobalNotFound() {
  return (
    <html
      lang="zh-CN"
      className={notoSerif.variable}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <main className="wrap not-found">
          <p className="eyebrow">404</p>
          <h1>页面不存在</h1>
          <p>这个地址没有对应的页面。可能是链接写错了，也可能是页面已经被移走。</p>
          <p className="not-found__en">
            There is no page at this address. The link may be wrong, or the page may have
            moved.
          </p>
          <p className="not-found__links">
            {/* A global 404 bypasses root layouts; full navigation restores the locale layout. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/">回到首页</a>
            <span aria-hidden="true"> · </span>
            <a href="/en">Back home</a>
            <span aria-hidden="true"> · </span>
            <a href="/en/search">Search</a>
          </p>
        </main>
      </body>
    </html>
  );
}
