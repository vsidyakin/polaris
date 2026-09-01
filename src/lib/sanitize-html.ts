/**
 * Allowlist sanitiser for the job-description HTML that Rippling returns.
 *
 * Why this exists
 * ---------------
 * The ATS hands back rich text authored in Rippling's own editor, and it comes
 * with that editor's presentation baked in: every paragraph carries an inline
 * `style` with Rippling's font stack (`Basel Grotesk`), sizes are in points, and
 * each block is prefixed with a stray `<meta>` tag. Dropped into a page as-is it
 * imports Rippling's typography into ours and overrides the site's type scale.
 *
 * So we keep the structure and throw the presentation away: tags come from a
 * fixed allowlist, every attribute is dropped except a validated `href`, and the
 * result inherits `.job-body`'s styling like any other prose on the site.
 *
 * This runs at build time, on copy written by our own HR team, so it is not the
 * last line of defence against a hostile author. It is still written as an
 * allowlist rather than a blocklist: an unrecognised tag is never emitted, so a
 * change at Rippling's end cannot introduce markup we did not plan for.
 */

/** Emitted as-is (attributes still stripped). */
const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "hr",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "s",
  "sub",
  "sup",
  "ul",
  "ol",
  "li",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "a",
  "code",
]);

/** Tag discarded, children kept — presentational or document-level wrappers. */
const UNWRAP_TAGS = new Set([
  "span",
  "div",
  "font",
  "meta",
  "html",
  "head",
  "body",
  "section",
  "article",
  "header",
  "footer",
  "main",
  "aside",
  "nav",
  "figure",
  "figcaption",
  "center",
  "small",
  "big",
  "tt",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "td",
  "th",
  "caption",
  "colgroup",
  "col",
  "dl",
  "dt",
  "dd",
  "label",
  "abbr",
  "cite",
  "mark",
  "o:p",
]);

/** Tag *and* everything inside it discarded. */
const DROP_TREE_TAGS = new Set([
  "script",
  "style",
  "iframe",
  "frame",
  "frameset",
  "object",
  "embed",
  "applet",
  "noscript",
  "template",
  "svg",
  "math",
  "form",
  "input",
  "button",
  "select",
  "option",
  "textarea",
  "link",
  "title",
  "base",
  "audio",
  "video",
  "source",
  "track",
  "canvas",
  "map",
  "area",
  "img",
  "picture",
]);

/** Self-closing in the output. */
const VOID_TAGS = new Set(["br", "hr"]);

/* The page already owns its <h1>. A heading promoted out of the description
   would compete with the job title, so the top level starts at <h2>. */
const RENAME: Record<string, string> = { h1: "h2" };

/**
 * URL forms a description link may use: an explicit safe scheme, a rooted site
 * path, or a fragment. `//host` is excluded deliberately — it reads as a relative
 * path but resolves to another origin, so it is the one shape that can send a
 * candidate off-site while looking local.
 */
const SAFE_HREF = /^(?:https?:\/\/|mailto:|tel:|#|\/(?!\/))/i;

/**
 * Escapes `&` only where it is not already an entity reference, so copy that
 * arrives pre-escaped (`&quot;`, `&#324;` — Rippling emits both) survives a
 * round trip instead of becoming `&amp;quot;`.
 */
const escapeText = (text: string): string =>
  text.replace(/&(?!#?[a-zA-Z0-9]+;)/g, "&amp;").replace(/</g, "&lt;");

/** Matches a comment or one tag, tolerating `>` inside quoted attribute values. */
const TAG = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9:_-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;

const HREF = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;

/** The validated, escaped href for an `<a>`, or null if it cannot be trusted. */
function safeHref(attrs: string): string | null {
  const match = HREF.exec(attrs);
  if (!match) return null;

  const raw = (match[1] ?? match[2] ?? match[3] ?? "").trim();
  /* Control characters are how `java\nscript:` gets past a scheme check. */
  if (!raw || /[\u0000-\u0020\u007f]/.test(raw)) return null;
  if (!SAFE_HREF.test(raw)) return null;

  return escapeText(raw).replace(/"/g, "&quot;");
}

/**
 * Reduces Rippling's rich text to the allowlist above.
 *
 * Returns a fragment safe to hand to `set:html`: no attributes beyond a
 * validated `href`, no unbalanced tags, and no tag outside `ALLOWED_TAGS`.
 */
export function sanitizeJobHtml(input: string | null | undefined): string {
  if (!input) return "";

  let out = "";
  /** Tags we have opened. `emitted: false` marks one swallowed but still
      balanced — an `<a>` whose href failed validation — so its closing tag is
      matched and dropped rather than leaking into the output. */
  const stack: { tag: string; emitted: boolean }[] = [];
  /** Depth inside a dropped subtree; text and tags are skipped while > 0. */
  let dropDepth = 0;
  let dropTag = "";
  let cursor = 0;

  TAG.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TAG.exec(input)) !== null) {
    const text = input.slice(cursor, match.index);
    cursor = TAG.lastIndex;

    if (!dropDepth && text) out += escapeText(text);
    if (match[0].startsWith("<!--")) continue;

    const closing = match[1] === "/";
    const tag = (RENAME[match[2].toLowerCase()] ?? match[2].toLowerCase()) as string;
    const attrs = match[3] ?? "";

    /* Inside a dropped subtree: track its nesting, emit nothing. */
    if (dropDepth) {
      if (tag === dropTag) dropDepth += closing ? -1 : 1;
      continue;
    }

    if (DROP_TREE_TAGS.has(tag)) {
      /* Void members of this set (img, input, link) never open a subtree. */
      if (!closing && !/\/\s*$/.test(attrs) && !["img", "input", "link", "base", "source", "track", "area", "col"].includes(tag)) {
        dropDepth = 1;
        dropTag = tag;
      }
      continue;
    }

    if (UNWRAP_TAGS.has(tag) || !ALLOWED_TAGS.has(tag)) continue;

    if (VOID_TAGS.has(tag)) {
      if (!closing) out += `<${tag} />`;
      continue;
    }

    if (!closing) {
      if (tag === "a") {
        const href = safeHref(attrs);
        if (href) {
          /* A link that leaves the site opens in a new tab, so the posting stays
             put behind it. One that stays on the site — a rooted path or an
             in-page fragment — navigates normally: a new tab for a jump within
             the same page is just a stray window. */
          const external = !href.startsWith("/") && !href.startsWith("#");
          out += external
            ? `<a href="${href}" target="_blank" rel="noopener noreferrer">`
            : `<a href="${href}">`;
          stack.push({ tag, emitted: true });
        } else {
          stack.push({ tag, emitted: false });
        }
        continue;
      }
      out += `<${tag}>`;
      stack.push({ tag, emitted: true });
      continue;
    }

    /* Closing tag: find its opener, closing anything left open inside it. A
       closer with no opener on the stack is stray markup and is dropped. */
    let i = stack.length - 1;
    while (i >= 0 && stack[i].tag !== tag) i--;
    if (i < 0) continue;
    for (let j = stack.length - 1; j >= i; j--) {
      if (stack[j].emitted) out += `</${stack[j].tag}>`;
    }
    stack.length = i;
  }

  if (!dropDepth && cursor < input.length) out += escapeText(input.slice(cursor));
  for (let j = stack.length - 1; j >= 0; j--) {
    if (stack[j].emitted) out += `</${stack[j].tag}>`;
  }

  return (
    out
      /* The editor pads blocks with empty paragraphs and hard breaks; they are
         spacing in Rippling's renderer, not content, and `.job-body` sets its
         own rhythm. */
      .replace(/<p>(?:\s|<br \/>)*<\/p>/g, "")
      .replace(/(?:<br \/>\s*){3,}/g, "<br /><br />")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** Plain text from sanitised HTML, for meta descriptions and search entries. */
export function htmlToText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}
