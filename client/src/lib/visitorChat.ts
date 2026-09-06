export type VisitorChatMessage = {
  id: string;
  name: string;
  body: string;
  createdAt: string;
};

export type VisitorChatStatus = "loading" | "ready" | "error" | "unconfigured";

export type VisitorChatState = {
  messages: VisitorChatMessage[];
  status: VisitorChatStatus;
  error: string | null;
  sending: boolean;
  hasOlder: boolean;
  loadingOlder: boolean;
  historyError: string | null;
  sentMessageIds: string[];
};

export type VisitorChatDraft = { name: string; body: string };

const CLIENT_ID_KEY = "kjhstock.visitorChat.clientId.v1";
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INVISIBLE_CONTROLS =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/;
const REQUEST_TIMEOUT_MS = 10_000;
const PAGE_SIZE = 100;
let memoryClientId: string | undefined;

class VisitorChatError extends Error {}

const invalidPayload = () =>
  new VisitorChatError(
    "채팅 서버의 응답 형식이 올바르지 않습니다. 잠시 후 다시 시도해 주세요."
  );

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateVisitorChatDraft(
  name: unknown,
  body: unknown
): VisitorChatDraft {
  const normalizedName =
    typeof name === "string" ? name.normalize("NFC").trim() : "";
  const normalizedBody =
    typeof body === "string" ? body.normalize("NFC").trim() : "";
  if (!normalizedName || Array.from(normalizedName).length > 20) {
    throw new VisitorChatError("닉네임은 1~20자로 입력해 주세요.");
  }
  if (!normalizedBody || Array.from(normalizedBody).length > 500) {
    throw new VisitorChatError("메시지는 1~500자로 입력해 주세요.");
  }
  if (
    INVISIBLE_CONTROLS.test(normalizedName) ||
    /[\r\n\t]/.test(normalizedName)
  ) {
    throw new VisitorChatError(
      "닉네임에는 줄바꿈이나 보이지 않는 제어 문자를 사용할 수 없습니다."
    );
  }
  if (INVISIBLE_CONTROLS.test(normalizedBody)) {
    throw new VisitorChatError(
      "메시지에는 보이지 않는 제어 문자를 사용할 수 없습니다."
    );
  }
  return { name: normalizedName, body: normalizedBody };
}

/** Require an explicit timezone; calendar overflow must not become a valid date. */
function parseTimestamp(value: unknown): string {
  if (typeof value !== "string") throw invalidPayload();
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/.exec(
      value
    );
  if (!match) throw invalidPayload();
  const [
    ,
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText,
    zone,
  ] = match;
  const [year, month, day, hour, minute, second] = [
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText,
  ].map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > days[month - 1] ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  )
    throw invalidPayload();
  if (
    zone !== "Z" &&
    (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4, 6)) > 59)
  )
    throw invalidPayload();
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw invalidPayload();
  return new Date(time).toISOString();
}

function parseMessage(value: unknown): VisitorChatMessage {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !value.id ||
    value.id.length > 128 ||
    /\s|[\u0000-\u001f\u007f]/.test(value.id)
  )
    throw invalidPayload();
  let draft: VisitorChatDraft;
  try {
    draft = validateVisitorChatDraft(value.name, value.body);
  } catch {
    throw invalidPayload();
  }
  return { id: value.id, ...draft, createdAt: parseTimestamp(value.createdAt) };
}

/** Incoming records replace the same ID; accumulated history stays chronological. */
export function mergeVisitorChatMessages(
  existing: readonly VisitorChatMessage[],
  incoming: readonly VisitorChatMessage[]
): VisitorChatMessage[] {
  const byId = new Map(existing.map(message => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return Array.from(byId.values()).sort(
      (a, b) =>
        Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    );
}

export function parseVisitorChatMessages(
  payload: unknown
): VisitorChatMessage[] {
  if (
    !isRecord(payload) ||
    !Array.isArray(payload.messages) ||
    payload.messages.length > PAGE_SIZE
  )
    throw invalidPayload();
  return mergeVisitorChatMessages([], payload.messages.map(parseMessage));
}

export function visitorChatCursor(message: VisitorChatMessage): string {
  return `${Date.parse(message.createdAt)}:${message.id}`;
}

export type VisitorChatPage = {
  messages: VisitorChatMessage[];
  hasMore: boolean;
  nextCursor: string | null;
  paginationSupported: boolean;
};

export function parseVisitorChatPage(
  payload: unknown,
  direction: "before" | "after" = "before"
): VisitorChatPage {
  const messages = parseVisitorChatMessages(payload);
  if (!isRecord(payload)) throw invalidPayload();
  // Keep the existing service usable during a rolling backend/frontend update.
  if (!("hasMore" in payload) && !("nextCursor" in payload))
    return { messages, hasMore: false, nextCursor: null, paginationSupported: false };
  if (typeof payload.hasMore !== "boolean") throw invalidPayload();
  const boundary = direction === "before" ? messages[0] : messages[messages.length - 1];
  if (payload.hasMore
    ? !boundary || payload.nextCursor !== visitorChatCursor(boundary)
    : payload.nextCursor !== null) throw invalidPayload();
  return { messages, hasMore: payload.hasMore, nextCursor: payload.nextCursor as string | null,
    paginationSupported: true };
}

export function parseVisitorChatMessage(payload: unknown): VisitorChatMessage {
  if (!isRecord(payload)) throw invalidPayload();
  return parseMessage(payload.message);
}

export function resolveVisitorChatEndpoint(base: unknown): string | null {
  if (typeof base !== "string" || !base.trim()) return null;
  try {
    const url = new URL(base.trim());
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return null;
    url.pathname = `${url.pathname.replace(/\/+$/, "")}/api/messages`;
    return url.toString();
  } catch {
    return null;
  }
}

function randomUUID(): string {
  if (typeof globalThis.crypto?.randomUUID !== "function") {
    throw new VisitorChatError(
      "이 브라우저에서는 메시지 전송을 준비할 수 없습니다. HTTPS 연결과 브라우저 버전을 확인해 주세요."
    );
  }
  return globalThis.crypto.randomUUID();
}

/** Reading chat never calls this; identity is only created for an actual send. */
export function getVisitorChatClientId(): string {
  if (memoryClientId) return memoryClientId;
  try {
    const saved = globalThis.localStorage?.getItem(CLIENT_ID_KEY);
    if (saved && UUID.test(saved)) return (memoryClientId = saved);
  } catch {
    // Storage can be disabled; keep the cryptographic ID for this page session.
  }
  memoryClientId = randomUUID();
  try {
    globalThis.localStorage?.setItem(CLIENT_ID_KEY, memoryClientId);
  } catch {
    // Private browsing or quota errors must not prevent chat from working.
  }
  return memoryClientId;
}

function errorMessage(error: unknown, controller: AbortController): string {
  if (
    controller.signal.aborted &&
    controller.signal.reason?.name === "TimeoutError"
  ) {
    return "채팅 서버 응답 시간이 초과됐습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (error instanceof VisitorChatError) return error.message;
  return "채팅 서버에 연결하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.";
}

async function request(
  endpoint: string,
  init: RequestInit,
  controller: AbortController,
  fetcher: typeof fetch
): Promise<unknown> {
  const timeout = setTimeout(
    () =>
      controller.abort(
        new DOMException("Chat request timed out", "TimeoutError")
      ),
    REQUEST_TIMEOUT_MS
  );
  try {
    const response = await fetcher(endpoint, {
      ...init,
      signal: controller.signal,
      credentials: "omit",
      cache: "no-store",
    });
    controller.signal.throwIfAborted();
    if (!response.ok) {
      if (response.status === 429)
        throw new VisitorChatError(
          "메시지 요청이 너무 빠릅니다. 잠시 기다린 뒤 다시 시도해 주세요."
        );
      if (response.status === 400 || response.status === 422)
        throw new VisitorChatError(
          "채팅 서버가 요청을 거절했습니다. 닉네임과 메시지를 확인해 주세요."
        );
      throw new VisitorChatError(
        "채팅 서버에서 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요."
      );
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      controller.signal.throwIfAborted();
      throw invalidPayload();
    }
    controller.signal.throwIfAborted();
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

type VisitorChatSessionOptions = {
  onChange?: (state: VisitorChatState) => void;
  fetcher?: typeof fetch;
  getClientId?: () => string;
  createRequestId?: () => string;
};

/** One session owns network work so a cancelled or older GET cannot undo a send. */
export function createVisitorChatSession(
  endpoint: string | null,
  options: VisitorChatSessionOptions = {}
) {
  let state: VisitorChatState = {
    messages: [],
    status: endpoint ? "loading" : "unconfigured",
    error: null,
    sending: false,
    hasOlder: false,
    loadingOlder: false,
    historyError: null,
    sentMessageIds: [],
  };
  let disposed = false;
  let readVersion = 0;
  let reading: AbortController | null = null;
  let readingOlder: AbortController | null = null;
  let sending: AbortController | null = null;
  let newestCursor: string | null = null;
  let oldestCursor: string | null = null;
  let paginationSupported = false;
  let pendingDraft: (VisitorChatDraft & { requestId: string }) | null = null;
  const fetcher = options.fetcher ?? globalThis.fetch;

  const update = (patch: Partial<VisitorChatState>) => {
    if (disposed) return;
    state = { ...state, ...patch };
    options.onChange?.(state);
  };

  const cancelRefresh = () => {
    readVersion++;
    reading?.abort();
    reading = null;
  };

  const refresh = async (): Promise<void> => {
    if (disposed || !endpoint || reading || sending) return;
    const controller = new AbortController();
    reading = controller;
    const version = ++readVersion;
    try {
      let hasMore = false;
      do {
        const after = paginationSupported ? newestCursor : null;
        const url = new URL(endpoint);
        if (after) url.searchParams.set("after", after);
        const payload = await request(url.toString(), { method: "GET" }, controller, fetcher);
        const page = parseVisitorChatPage(payload, after ? "after" : "before");
        if (disposed || version !== readVersion) return;
        if (after && !page.paginationSupported) throw invalidPayload();
        const last = page.messages[page.messages.length - 1];
        if (after && page.messages.some(message => {
          const [time, id] = [Number(after.slice(0, after.indexOf(":"))), after.slice(after.indexOf(":") + 1)];
          return Date.parse(message.createdAt) < time ||
            (Date.parse(message.createdAt) === time && message.id <= id);
        })) throw invalidPayload();
        paginationSupported = page.paginationSupported;
        if (!after) {
          oldestCursor = page.messages[0] ? visitorChatCursor(page.messages[0]) : null;
        }
        // A POST acknowledgement must never move this cursor: only a contiguous
        // GET page proves that all earlier arrivals have been received.
        newestCursor = last ? visitorChatCursor(last) : (newestCursor ?? "0:!");
        update({
          messages: mergeVisitorChatMessages(state.messages, page.messages),
          status: "ready", error: null,
          ...(!after ? { hasOlder: page.hasMore } : {}),
        });
        hasMore = Boolean(after && page.hasMore);
      } while (hasMore);
    } catch (error) {
      if (!disposed && version === readVersion)
        update({ status: "error", error: errorMessage(error, controller) });
    } finally {
      if (reading === controller) reading = null;
    }
  };

  const loadOlder = async (): Promise<void> => {
    if (disposed || !endpoint || readingOlder || !state.hasOlder || !oldestCursor) return;
    const controller = new AbortController();
    readingOlder = controller;
    const before = oldestCursor;
    update({ loadingOlder: true, historyError: null });
    try {
      const url = new URL(endpoint);
      url.searchParams.set("before", before);
      const payload = await request(url.toString(), { method: "GET" }, controller, fetcher);
      const page = parseVisitorChatPage(payload);
      if (disposed || readingOlder !== controller) return;
      if (!page.paginationSupported) throw invalidPayload();
      const boundary = state.messages.find(message => visitorChatCursor(message) === before);
      if (!boundary || page.messages.some(message =>
        Date.parse(message.createdAt) > Date.parse(boundary.createdAt) ||
        (Date.parse(message.createdAt) === Date.parse(boundary.createdAt) && message.id >= boundary.id)
      )) throw invalidPayload();
      oldestCursor = page.messages[0] ? visitorChatCursor(page.messages[0]) : oldestCursor;
      update({ messages: mergeVisitorChatMessages(state.messages, page.messages),
        hasOlder: page.hasMore, historyError: null });
    } catch (error) {
      if (!disposed && readingOlder === controller)
        update({ historyError: errorMessage(error, controller) });
    } finally {
      if (readingOlder === controller) {
        readingOlder = null;
        update({ loadingOlder: false });
      }
    }
  };

  const send = async (name: string, body: string): Promise<boolean> => {
    if (disposed || !endpoint || sending) return false;
    let draft: VisitorChatDraft;
    let clientId: string;
    try {
      draft = validateVisitorChatDraft(name, body);
      clientId = (options.getClientId ?? getVisitorChatClientId)();
      if (
        !pendingDraft ||
        pendingDraft.name !== draft.name ||
        pendingDraft.body !== draft.body
      ) {
        pendingDraft = {
          ...draft,
          requestId: (options.createRequestId ?? randomUUID)(),
        };
      }
    } catch (error) {
      update({
        error:
          error instanceof VisitorChatError
            ? error.message
            : "메시지 전송을 준비하지 못했습니다. 다시 시도해 주세요.",
      });
      return false;
    }
    const payload = { clientId, ...pendingDraft };
    cancelRefresh();
    const controller = new AbortController();
    sending = controller;
    update({ sending: true, error: null });
    try {
      const result = await request(
        endpoint,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
        controller,
        fetcher
      );
      const message = parseVisitorChatMessage(result);
      if (disposed) return false;
      pendingDraft = null;
      update({
        messages: mergeVisitorChatMessages(state.messages, [message]),
        sentMessageIds: Array.from(new Set([...state.sentMessageIds, message.id])),
        status: "ready",
        error: null,
      });
      return true;
    } catch (error) {
      if (!disposed)
        update({ status: "error", error: errorMessage(error, controller) });
      // A response may be lost after the server stored the message. Reuse its ID.
      return false;
    } finally {
      if (sending === controller) sending = null;
      update({ sending: false });
    }
  };

  return {
    getState: () => state,
    refresh,
    loadOlder,
    send,
    cancelRefresh,
    dispose: () => {
      disposed = true;
      cancelRefresh();
      sending?.abort();
      sending = null;
      readingOlder?.abort();
      readingOlder = null;
    },
  };
}
