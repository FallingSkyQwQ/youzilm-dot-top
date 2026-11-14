import test from "node:test";
import assert from "node:assert/strict";
import { highlightSearchText, searchExcerpt, type SearchRecord } from "../src/lib/search";

const record: SearchRecord = { id: "test", kind: "post", lang: "zh", sourceLang: "zh", slug: "test", title: "搜索测试", summary: "摘要没有关键词。", date: "2026-11-14", tags: [], url: "/posts/test", content: "前言。".repeat(100) + "正文包含 GitHub 保存内容的说明。" + "结尾。".repeat(100) };

test("search excerpts show a body match outside the summary with readable context", () => {
  const excerpt = searchExcerpt(record, "github");
  assert.match(excerpt, /GitHub 保存内容/);
  assert(excerpt.startsWith("…") && excerpt.endsWith("…"));
  assert(excerpt.length <= 162);
  assert.equal(searchExcerpt({ ...record, summary: "使用 GitHub 保存内容。" }, "github"), "使用 GitHub 保存内容。");
});

test("search highlights Chinese and literal punctuation without creating HTML", () => {
  const parts = highlightSearchText("<script>正文 C++ c++</script>", "正文 C++");
  assert.deepEqual(parts.filter(part => part.matched).map(part => part.text), ["正文", "C++", "c++"]);
  assert.equal(parts.map(part => part.text).join(""), "<script>正文 C++ c++</script>");
  assert.deepEqual(highlightSearchText("Hello", ""), [{ text: "Hello", matched: false }]);
});
