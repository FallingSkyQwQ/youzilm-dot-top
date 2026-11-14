/**
 * Minimal Markdown → HTML renderer for Workers
 * Handles common constructs + XSS sanitization
 */

const SAFE_HREF = /^(https?:|mailto:|#|\/)/i;

export function renderMarkdown(text: string): string {
	if (!text) return "";

	let html = text;

	// Escape HTML entities first (XSS prevention)
	html = escapeHtml(html);
	// Protect generated HTML and literal code from subsequent Markdown replacements.
	// NUL cannot occur in an HTML attribute; discard input NULs to prevent forged tokens.
	html = html.replace(/\0/g, "");
	const protectedHtml: string[] = [];
	const protect = (value: string) => `\0${protectedHtml.push(value) - 1}\0`;

	// Code blocks (``` ... ```)
	html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
		return protect(`<pre><code class="language-${lang || ""}">${code.replace(/\n$/, "")}</code></pre>`);
	});

	// Inline code
	html = html.replace(/`([^`]+)`/g, (_m, code) => protect(`<code>${code}</code>`));

	// Images ![alt](url)
	html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, src) => {
		if (!SAFE_HREF.test(src.trim())) return "";
		return protect(`<img src="${src}" alt="${alt}" loading="lazy" />`);
	});

	// Links [text](url)
	html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text, url) => {
		if (!SAFE_HREF.test(url.trim())) return text;
		return protect(`<a href="${url}" target="_blank" rel="ugc nofollow noreferrer noopener">${text}</a>`);
	});
	html = html.replace(/https?:\/\/[^\s<)"'\0]+/g, (url) =>
		protect(`<a href="${url}" target="_blank" rel="ugc nofollow noreferrer noopener">${url}</a>`));

	// Bold **text** or __text__
	html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
	html = html.replace(/__(.+?)__/g, "<strong>$1</strong>");

	// Italic *text* or _text_
	html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");
	html = html.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, "<em>$1</em>");

	// Strikethrough ~~text~~
	html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");

	// Blockquote (> text)
	html = html.replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>");
	// Merge consecutive blockquotes
	html = html.replace(/<\/blockquote>\n<blockquote>/g, "\n");

	// Headings (# to ######)
	html = html.replace(/^######\s+(.+)$/gm, "<h6>$1</h6>");
	html = html.replace(/^#####\s+(.+)$/gm, "<h5>$1</h5>");
	html = html.replace(/^####\s+(.+)$/gm, "<h4>$1</h4>");
	html = html.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>");
	html = html.replace(/^##\s+(.+)$/gm, "<h2>$1</h2>");
	html = html.replace(/^#\s+(.+)$/gm, "<h1>$1</h1>");

	// Horizontal rule
	html = html.replace(/^(-{3,}|\*{3,}|_{3,})$/gm, "<hr />");

	// Unordered lists
	html = html.replace(/^[*\-+]\s+(.+)$/gm, "<li>$1</li>");
	html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>");

	// Paragraphs: split by double newlines
	html = html
		.split(/\n{2,}/)
		.map((block) => {
			block = block.trim();
			if (!block) return "";
			// Don't wrap block-level elements
			if (/^<(h[1-6]|ul|ol|li|blockquote|pre|hr|p|div|table)/.test(block) ||
				(/^\0\d+\0$/.test(block) && protectedHtml[Number(block.slice(1, -1))].startsWith("<pre>"))) {
				return block;
			}
			return `<p>${block}</p>`;
		})
		.join("\n");

	// Line breaks in paragraphs
	html = html.replace(/(?<!\n)\n(?!\n)/g, "<br />\n");

	// Nested tokens can occur when a code span is used as link text.
	for (let pass = 0; pass <= protectedHtml.length && /\0\d+\0/.test(html); pass++) {
		html = html.replace(/\0(\d+)\0/g, (_m, index) => protectedHtml[Number(index)] || "");
	}
	return html.trim();
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}
