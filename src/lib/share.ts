// Share links carry a whole custom category in the URL fragment, so no server is involved and
// the words never reach one (browsers don't send the part after #).
//
//   https://www.tjeneritz.se/c#1.<base64url of deflate-raw JSON>
//
// The "1." is the format version. Adding optional fields keeps it at 1 (older apps ignore
// what they don't know); only a breaking change bumps it, and older apps then ask for an update.

// www is the canonical host: the bare domain redirects, and Android App Links don't follow redirects.
export const SHARE_LINK_BASE = "https://www.tjeneritz.se/c";
export const SHARE_PATH = "/c";

const FORMAT_VERSION = 1;
const MAX_NAME_LENGTH = 28;
const MAX_WORDS = 1000;
const MAX_WORD_LENGTH = 100;
// Real categories are a few KB at most; this stops a crafted link from inflating into megabytes.
const MAX_DECODED_BYTES = 256 * 1024;

export type SharedCategory = {
  name: string;
  easy: string[];
  hard: string[];
};

// Short keys keep links small: n = name, e = easy words, h = hard words.
type Payload = { n: string; e: string[]; h?: string[] };

export type DecodeResult =
  | { status: "ok"; category: SharedCategory }
  | { status: "newer" }
  | { status: "invalid" };

const toBase64Url = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

const fromBase64Url = (text: string) => {
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const deflate = async (text: string) => {
  const stream = new Blob([text])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

const inflate = async (bytes: Uint8Array) => {
  const reader = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"))
    .getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_DECODED_BYTES) {
      await reader.cancel();
      throw new Error("Shared category is too large");
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(
    await new Blob(chunks as BlobPart[]).arrayBuffer(),
  );
};

const cleanWords = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const words: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const word = item.trim().slice(0, MAX_WORD_LENGTH);
    if (!word || seen.has(word.toLowerCase())) continue;
    seen.add(word.toLowerCase());
    words.push(word);
    if (words.length === MAX_WORDS) break;
  }
  return words;
};

export const encodeCategory = async (category: SharedCategory) => {
  const payload: Payload = { n: category.name, e: category.easy };
  if (category.hard.length > 0) payload.h = category.hard;
  return `${FORMAT_VERSION}.${toBase64Url(await deflate(JSON.stringify(payload)))}`;
};

export const shareLinkFor = async (category: SharedCategory) =>
  `${SHARE_LINK_BASE}#${await encodeCategory(category)}`;

export const decodeCategory = async (code: string): Promise<DecodeResult> => {
  const match = /^(\d+)\.([A-Za-z0-9_-]+)$/.exec(code.trim());
  if (!match) return { status: "invalid" };
  const version = Number(match[1]);
  if (version > FORMAT_VERSION) return { status: "newer" };
  if (version !== FORMAT_VERSION) return { status: "invalid" };

  try {
    const parsed: unknown = JSON.parse(await inflate(fromBase64Url(match[2])));
    if (typeof parsed !== "object" || parsed === null) {
      return { status: "invalid" };
    }
    const { n, e, h } = parsed as Partial<Record<keyof Payload, unknown>>;
    const name =
      typeof n === "string" ? n.trim().slice(0, MAX_NAME_LENGTH) : "";
    const easy = cleanWords(e);
    const hard = cleanWords(h);
    if (!name || easy.length + hard.length === 0) return { status: "invalid" };
    return { status: "ok", category: { name, easy, hard } };
  } catch {
    return { status: "invalid" };
  }
};

// Pulls the code out of a full share link, or out of text that contains one (a pasted
// "Add … to Imposter: <link>" message). Returns null when there's no share link in it.
export const findShareCode = (text: string): string | null => {
  const match =
    /(?:https?:\/\/)?(?:www\.)?tjeneritz\.se\/c\/?#(\d+\.[A-Za-z0-9_-]+)/.exec(
      text,
    );
  return match?.[1] ?? null;
};

// Opened as a share link in the browser: returns the code once and cleans the address bar,
// so a reload doesn't offer the same import again.
export const takeShareCodeFromLocation = (): string | null => {
  if (typeof window === "undefined") return null;
  const { pathname, hash } = window.location;
  if (pathname.replace(/\/$/, "") !== SHARE_PATH || !hash) return null;
  window.history.replaceState(window.history.state, "", "/");
  // A mangled code still comes back, so the import sheet can say the link is broken.
  return hash.slice(1);
};
