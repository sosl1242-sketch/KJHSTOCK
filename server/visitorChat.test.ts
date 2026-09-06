import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createVisitorChatSession,
  mergeVisitorChatMessages,
  parseVisitorChatMessage,
  parseVisitorChatMessages,
  parseVisitorChatPage,
  resolveVisitorChatEndpoint,
  validateVisitorChatDraft,
  visitorChatCursor,
  type VisitorChatMessage,
} from "../client/src/lib/visitorChat";

const ENDPOINT = "https://chat.example/api/messages";
const CLIENT_ID = "00000000-0000-4000-8000-000000000001";
const REQUEST_ID = "00000000-0000-4000-8000-000000000002";
const NEXT_REQUEST_ID = "00000000-0000-4000-8000-000000000003";

function message(
  id = "one",
  createdAt = "2026-09-06T01:00:00.000Z"
): VisitorChatMessage {
  return { id, name: "방문자", body: "안녕하세요", createdAt };
}

function response(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function setupSession(fetcher = vi.fn<typeof fetch>()) {
  const onChange = vi.fn();
  const getClientId = vi.fn(() => CLIENT_ID);
  const createRequestId = vi.fn(() => REQUEST_ID);
  const session = createVisitorChatSession(ENDPOINT, {
    fetcher,
    onChange,
    getClientId,
    createRequestId,
  });
  return { session, fetcher, onChange, getClientId, createRequestId };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("visitor chat payloads", () => {
  it("trims edge whitespace and counts Unicode code points at both limits", () => {
    expect(
      validateVisitorChatDraft(
        ` ${"😀".repeat(20)} `,
        `\n${"가".repeat(500)}\n`
      )
    ).toEqual({ name: "😀".repeat(20), body: "가".repeat(500) });
    expect(() => validateVisitorChatDraft("😀".repeat(21), "내용")).toThrow(
      "1~20"
    );
    expect(() => validateVisitorChatDraft("닉네임", "😀".repeat(501))).toThrow(
      "1~500"
    );
    expect(validateVisitorChatDraft("가 나", "첫째 줄\n둘째 줄")).toEqual({
      name: "가 나",
      body: "첫째 줄\n둘째 줄",
    });
  });

  it("normalizes decomposed Unicode before applying name and body limits", () => {
    expect(
      validateVisitorChatDraft(
        ` ${"e\u0301".repeat(20)} `,
        `\n${"\u1100\u1161".repeat(500)}\n`
      )
    ).toEqual({ name: "é".repeat(20), body: "가".repeat(500) });
  });

  it.each([
    "\u0000",
    "\u000b",
    "\u007f",
    "\u200b",
    "\u200f",
    "\u202e",
    "\u2060",
    "\ufeff",
  ])("rejects invisible control %j in either name or body", control => {
    expect(() =>
      validateVisitorChatDraft(`가${control}나`, "메시지")
    ).toThrow();
    expect(() =>
      validateVisitorChatDraft("방문자", `첫째${control}둘째`)
    ).toThrow();
  });

  it("rejects multiline or tabbed names while preserving these characters in message bodies", () => {
    for (const separator of ["\r", "\n", "\t"]) {
      expect(() =>
        validateVisitorChatDraft(`가${separator}나`, "메시지")
      ).toThrow();
    }
    expect(validateVisitorChatDraft("방문자", "첫째\r\n둘째\t내용").body).toBe(
      "첫째\r\n둘째\t내용"
    );
  });

  it.each([
    [" ", "메시지"],
    ["이름", "\n\t"],
    [null, "메시지"],
    ["이름", { body: "내용" }],
  ])("rejects an invalid draft %j / %j", (name, body) => {
    expect(() => validateVisitorChatDraft(name, body)).toThrow();
  });

  it("orders by the UTC instant and ascending ID for equal times without mutating inputs", () => {
    const older = message("older", "2026-09-06T09:00:00+09:00");
    const newestB = message("b", "2026-09-06T02:00:00Z");
    const newestA = message("a", "2026-09-05T22:00:00-04:00");
    const input = Object.freeze([
      Object.freeze(older),
      Object.freeze(newestB),
      Object.freeze(newestA),
    ]);
    const parsed = parseVisitorChatMessages({ messages: input });
    expect(parsed.map(item => item.id)).toEqual(["older", "a", "b"]);
    expect(parsed.map(item => item.createdAt)).toEqual([
      "2026-09-06T00:00:00.000Z",
      "2026-09-06T02:00:00.000Z",
      "2026-09-06T02:00:00.000Z",
    ]);
    expect(input[0].createdAt).toBe("2026-09-06T09:00:00+09:00");
  });

  it("deduplicates server IDs and retains all loaded history beyond 100 messages", () => {
    const existing = Array.from({ length: 100 }, (_, index) =>
      message(
        String(index),
        new Date(Date.UTC(2026, 8, 6, 0, index)).toISOString()
      )
    );
    const updated = { ...existing[50], body: "수정된 본문" };
    const newest = message("latest", "2026-09-06T03:00:00Z");
    const merged = mergeVisitorChatMessages(existing, [updated, newest]);
    expect(merged).toHaveLength(101);
    expect(merged[100].id).toBe("latest");
    expect(merged[0].id).toBe("0");
    expect(merged.filter(item => item.id === "50")).toEqual([updated]);
    expect(existing[50].body).toBe("안녕하세요");
    expect(parseVisitorChatMessages({ messages: [updated, updated] })).toEqual([
      updated,
    ]);
  });

  it.each([
    null,
    [],
    { messages: "not an array" },
    { messages: [message(), null] },
    { messages: [{ ...message(), id: "with whitespace" }] },
    { messages: [{ ...message(), name: "" }] },
    { messages: [{ ...message(), body: "가".repeat(501) }] },
    { messages: [{ ...message(), createdAt: "2026-09-06T01:00:00" }] },
    { messages: [{ ...message(), createdAt: "2026-02-30T01:00:00Z" }] },
    { messages: [{ ...message(), createdAt: "2026-09-06T24:00:00Z" }] },
    { messages: [{ ...message(), createdAt: "2026-09-06T01:00:00+25:00" }] },
    { messages: Array.from({ length: 101 }, () => message()) },
  ])("rejects malformed payload %# as a whole", payload => {
    expect(() => parseVisitorChatMessages(payload)).toThrow("응답 형식");
  });

  it("only accepts a valid posted message envelope", () => {
    expect(parseVisitorChatMessage({ message: message() })).toEqual(message());
    expect(() => parseVisitorChatMessage({ messages: [message()] })).toThrow();
    expect(() =>
      parseVisitorChatMessage({ message: { ...message(), body: null } })
    ).toThrow();
  });

  it("requires a configured HTTP API and appends the protocol path", () => {
    expect(resolveVisitorChatEndpoint(undefined)).toBeNull();
    expect(resolveVisitorChatEndpoint("   ")).toBeNull();
    expect(resolveVisitorChatEndpoint("/relative")).toBeNull();
    expect(resolveVisitorChatEndpoint("javascript:alert(1)")).toBeNull();
    expect(
      resolveVisitorChatEndpoint("https://user:secret@example.com")
    ).toBeNull();
    expect(
      resolveVisitorChatEndpoint("https://example.com?token=secret")
    ).toBeNull();
    expect(
      resolveVisitorChatEndpoint(" https://chat.example/service/// ")
    ).toBe("https://chat.example/service/api/messages");
    expect(resolveVisitorChatEndpoint("http://localhost:3000")).toBe(
      "http://localhost:3000/api/messages"
    );
  });
});

describe("visitor chat sessions", () => {
  it("stays unconfigured without reading, generating identity, or pretending to send", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const getClientId = vi.fn(() => CLIENT_ID);
    const session = createVisitorChatSession(null, { fetcher, getClientId });
    await session.refresh();
    expect(await session.send("방문자", "메시지")).toBe(false);
    expect(session.getState()).toEqual({
      messages: [],
      status: "unconfigured",
      error: null,
      sending: false,
      hasOlder: false,
      loadingOlder: false,
      historyError: null,
      sentMessageIds: [],
    });
    expect(fetcher).not.toHaveBeenCalled();
    expect(getClientId).not.toHaveBeenCalled();
  });

  it("does not overlap reads or require a device identity to read", async () => {
    const task = deferred<Response>();
    const { session, fetcher, getClientId } = setupSession(
      vi.fn<typeof fetch>().mockReturnValue(task.promise)
    );
    const first = session.refresh();
    await session.refresh();
    await session.refresh();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(getClientId).not.toHaveBeenCalled();
    task.resolve(response({ messages: [message()] }));
    await first;
    expect(session.getState()).toEqual({
      messages: [message()],
      status: "ready",
      error: null,
      sending: false,
      hasOlder: false,
      loadingOlder: false,
      historyError: null,
      sentMessageIds: [],
    });
    session.dispose();
  });

  it("preserves existing messages on network, server, and malformed-payload failures", async () => {
    const { session, fetcher } = setupSession();
    fetcher
      .mockResolvedValueOnce(response({ messages: [message()] }))
      .mockRejectedValueOnce(new Error("internal network details"))
      .mockResolvedValueOnce(
        response(
          { error: "database password or HTML must not be displayed" },
          500
        )
      )
      .mockResolvedValueOnce(response({ messages: [{ id: "incomplete" }] }));
    await session.refresh();
    for (let index = 0; index < 3; index++) {
      await session.refresh();
      expect(session.getState().messages).toEqual([message()]);
      expect(session.getState().status).toBe("error");
      expect(session.getState().error).not.toMatch(/internal|password|HTML/);
    }
    session.dispose();
  });

  it("invalidates a slow GET before POST and keeps the confirmed message when the GET arrives late", async () => {
    const slowRead = deferred<Response>();
    const slowPost = deferred<Response>();
    const { session, fetcher } = setupSession();
    fetcher
      .mockReturnValueOnce(slowRead.promise)
      .mockReturnValueOnce(slowPost.promise);
    const readTask = session.refresh();
    const readSignal = fetcher.mock.calls[0][1]!.signal!;
    const sendTask = session.send("방문자", "안녕하세요");
    expect(readSignal.aborted).toBe(true);
    expect(session.getState().sending).toBe(true);
    expect(session.getState().messages).toEqual([]);
    await session.refresh();
    expect(await session.send("두 번째", "중복 클릭")).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(2);
    slowPost.resolve(response({ message: message("posted") }, 201));
    expect(await sendTask).toBe(true);
    slowRead.resolve(response({ messages: [message("stale")] }));
    await readTask;
    expect(session.getState().messages.map(item => item.id)).toEqual([
      "posted",
    ]);
    expect(session.getState().sending).toBe(false);
    session.dispose();
  });

  it("reuses a request ID after an ambiguous failure and allocates a new ID after success", async () => {
    const { session, fetcher, createRequestId } = setupSession();
    createRequestId
      .mockReturnValueOnce(REQUEST_ID)
      .mockReturnValueOnce(NEXT_REQUEST_ID);
    fetcher
      .mockRejectedValueOnce(new TypeError("response lost after commit"))
      .mockResolvedValueOnce(response({ message: message() }))
      .mockResolvedValueOnce(response({ message: message("another") }));
    expect(await session.send(" 방문자 ", " 안녕하세요 ")).toBe(false);
    expect(session.getState().messages).toEqual([]);
    expect(await session.send("방문자", "안녕하세요")).toBe(true);
    expect(await session.send("방문자", "안녕하세요")).toBe(true);
    const bodies = fetcher.mock.calls.map(([, init]) =>
      JSON.parse(init!.body as string)
    );
    expect(bodies[0]).toEqual({
      clientId: CLIENT_ID,
      requestId: REQUEST_ID,
      name: "방문자",
      body: "안녕하세요",
    });
    expect(bodies[1]).toEqual(bodies[0]);
    expect(bodies[2].requestId).toBe(NEXT_REQUEST_ID);
    expect(createRequestId).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      cache: "no-store",
    });
    session.dispose();
  });

  it("uses a new request ID when the user changes a failed draft", async () => {
    const { session, fetcher, createRequestId } = setupSession();
    createRequestId
      .mockReturnValueOnce(REQUEST_ID)
      .mockReturnValueOnce(NEXT_REQUEST_ID);
    fetcher
      .mockResolvedValueOnce(response({ error: "slow down" }, 429))
      .mockResolvedValueOnce(
        response({ message: { ...message(), body: "새 내용" } })
      );
    expect(await session.send("방문자", "안녕하세요")).toBe(false);
    expect(session.getState().error).toContain("너무 빠릅니다");
    expect(await session.send("방문자", "새 내용")).toBe(true);
    expect(JSON.parse(fetcher.mock.calls[1][1]!.body as string).requestId).toBe(
      NEXT_REQUEST_ID
    );
    session.dispose();
  });

  it("rejects invalid drafts before identity creation and does not add a malformed POST response", async () => {
    const { session, fetcher, getClientId } = setupSession();
    expect(await session.send("", "내용")).toBe(false);
    expect(getClientId).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
    fetcher.mockResolvedValueOnce(response({ message: { id: "only-an-id" } }));
    expect(await session.send("방문자", "내용")).toBe(false);
    expect(session.getState().messages).toEqual([]);
    expect(session.getState().error).toContain("응답 형식");
    expect(session.getState().sending).toBe(false);
    session.dispose();
  });

  it("times out requests after ten seconds and releases the read lock for recovery", async () => {
    vi.useFakeTimers();
    const { session, fetcher } = setupSession();
    fetcher
      .mockImplementationOnce(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init!.signal!.addEventListener(
              "abort",
              () => reject(init!.signal!.reason),
              { once: true }
            );
          })
      )
      .mockResolvedValueOnce(response({ messages: [] }));
    const task = session.refresh();
    await vi.advanceTimersByTimeAsync(9_999);
    expect(session.getState().status).toBe("loading");
    await vi.advanceTimersByTimeAsync(1);
    await task;
    expect(session.getState().status).toBe("error");
    expect(session.getState().error).toContain("응답 시간이 초과");
    await session.refresh();
    expect(session.getState().status).toBe("ready");
    expect(vi.getTimerCount()).toBe(0);
    session.dispose();
  });

  it("cancels hidden-page reads and ignores the cancelled result after a resumed read", async () => {
    const hiddenRead = deferred<Response>();
    const { session, fetcher } = setupSession();
    fetcher
      .mockReturnValueOnce(hiddenRead.promise)
      .mockResolvedValueOnce(response({ messages: [message("visible")] }));
    const task = session.refresh();
    session.cancelRefresh();
    expect(fetcher.mock.calls[0][1]!.signal!.aborted).toBe(true);
    await session.refresh();
    hiddenRead.resolve(response({ messages: [message("hidden")] }));
    await task;
    expect(session.getState().messages[0].id).toBe("visible");
    session.dispose();
  });

  it.each(["read", "send"] as const)(
    "aborts an active %s on disposal and never publishes a late result",
    async kind => {
      const pending = deferred<Response>();
      const { session, fetcher, onChange } = setupSession(
        vi.fn<typeof fetch>().mockReturnValue(pending.promise)
      );
      const task =
        kind === "read"
          ? session.refresh()
          : session.send("방문자", "안녕하세요");
      const signal = fetcher.mock.calls[0][1]!.signal!;
      session.dispose();
      expect(signal.aborted).toBe(true);
      onChange.mockClear();
      pending.resolve(
        response(
          kind === "read" ? { messages: [message()] } : { message: message() }
        )
      );
      await task;
      expect(onChange).not.toHaveBeenCalled();
      await session.refresh();
      expect(await session.send("방문자", "새 내용")).toBe(false);
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  );
});

describe("visitor chat browser identity", () => {
  it("reuses a valid stored UUID without creating or rewriting an identity", async () => {
    vi.resetModules();
    const getItem = vi.fn(() => CLIENT_ID);
    const setItem = vi.fn();
    const randomUUID = vi.fn(() => REQUEST_ID);
    vi.stubGlobal("localStorage", { getItem, setItem });
    vi.stubGlobal("crypto", { randomUUID });
    const { getVisitorChatClientId } = await import(
      "../client/src/lib/visitorChat"
    );
    expect(getVisitorChatClientId()).toBe(CLIENT_ID);
    expect(getVisitorChatClientId()).toBe(CLIENT_ID);
    expect(randomUUID).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });

  it("keeps a secure in-memory UUID when storage access fails", async () => {
    vi.resetModules();
    const randomUUID = vi.fn(() => CLIENT_ID);
    vi.stubGlobal("crypto", { randomUUID });
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new DOMException("Blocked", "SecurityError");
      },
      setItem: () => {
        throw new DOMException("Blocked", "SecurityError");
      },
    });
    const { getVisitorChatClientId } = await import(
      "../client/src/lib/visitorChat"
    );
    expect(getVisitorChatClientId()).toBe(CLIENT_ID);
    expect(getVisitorChatClientId()).toBe(CLIENT_ID);
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });

  it("replaces malformed storage with a browser-generated UUID", async () => {
    vi.resetModules();
    const setItem = vi.fn();
    vi.stubGlobal("crypto", { randomUUID: () => CLIENT_ID });
    vi.stubGlobal("localStorage", {
      getItem: () => "untrusted-not-a-uuid",
      setItem,
    });
    const { getVisitorChatClientId } = await import(
      "../client/src/lib/visitorChat"
    );
    expect(getVisitorChatClientId()).toBe(CLIENT_ID);
    expect(setItem).toHaveBeenCalledWith(
      "kjhstock.visitorChat.clientId.v1",
      CLIENT_ID
    );
  });
});

function history(start: number, count: number) {
  return Array.from({ length: count }, (_, index) => message(
    `message-${String(start + index).padStart(4, "0")}`,
    new Date(Date.UTC(2026, 8, 6) + (start + index) * 1000).toISOString()
  ));
}

function page(messages: VisitorChatMessage[], hasMore = false, direction: "before" | "after" = "before") {
  const sorted = mergeVisitorChatMessages([], messages);
  const boundary = direction === "before" ? sorted[0] : sorted[sorted.length - 1];
  return { messages, hasMore, nextCursor: hasMore ? visitorChatCursor(boundary) : null };
}

describe("visitor chat accumulated history", () => {
  it("validates page boundaries and remains compatible with the original envelope", () => {
    const messages = history(1, 2);
    expect(parseVisitorChatPage(page(messages, true)).nextCursor).toBe(visitorChatCursor(messages[0]));
    expect(parseVisitorChatPage(page(messages, true, "after"), "after").nextCursor).toBe(visitorChatCursor(messages[1]));
    expect(parseVisitorChatPage({ messages }).paginationSupported).toBe(false);
    for (const payload of [
      { messages, hasMore: "yes", nextCursor: null },
      { messages, hasMore: false, nextCursor: "unexpected" },
      { messages: [], hasMore: true, nextCursor: "0:!" },
      { messages, hasMore: true, nextCursor: visitorChatCursor(messages[1]) },
    ]) expect(() => parseVisitorChatPage(payload)).toThrow("응답 형식");
  });

  it("loads all older pages and drains more than 100 new arrivals without discarding history", async () => {
    const { session, fetcher } = setupSession();
    fetcher
      .mockResolvedValueOnce(response(page(history(151, 100).reverse(), true)))
      .mockResolvedValueOnce(response(page(history(51, 100).reverse(), true)))
      .mockResolvedValueOnce(response(page(history(1, 50).reverse())))
      .mockResolvedValueOnce(response(page(history(251, 100), true, "after")))
      .mockResolvedValueOnce(response(page(history(351, 100), true, "after")))
      .mockResolvedValueOnce(response(page(history(451, 25), false, "after")));
    await session.refresh();
    await session.loadOlder();
    await session.loadOlder();
    expect(session.getState().messages).toEqual(history(1, 250));
    expect(session.getState().hasOlder).toBe(false);
    await session.refresh();
    expect(session.getState().messages).toEqual(history(1, 475));
    const urls = fetcher.mock.calls.map(([url]) => new URL(String(url)));
    expect(urls[1].searchParams.get("before")).toBe(visitorChatCursor(history(151, 1)[0]));
    expect(urls[2].searchParams.get("before")).toBe(visitorChatCursor(history(51, 1)[0]));
    expect(urls.slice(3).map(url => url.searchParams.get("after"))).toEqual(
      [250, 350, 450].map(index => visitorChatCursor(history(index, 1)[0]))
    );
    expect(new Set(session.getState().messages.map(item => item.id)).size).toBe(475);
    session.dispose();
  });

  it("merges an older-page response with concurrent polling and deduplicates repeated older clicks", async () => {
    const older = deferred<Response>();
    const { session, fetcher } = setupSession();
    fetcher
      .mockResolvedValueOnce(response(page(history(101, 100), true)))
      .mockReturnValueOnce(older.promise)
      .mockResolvedValueOnce(response(page(history(201, 1), false, "after")));
    await session.refresh();
    const pending = session.loadOlder();
    await session.loadOlder();
    await session.refresh();
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(session.getState().loadingOlder).toBe(true);
    older.resolve(response(page(history(1, 100))));
    await pending;
    expect(session.getState().messages).toEqual(history(1, 201));
    expect(session.getState().loadingOlder).toBe(false);
    session.dispose();
  });

  it("keeps its contiguous poll cursor when a POST acknowledges a later message", async () => {
    const { session, fetcher } = setupSession();
    const sameNameElsewhere = history(1, 1)[0];
    const posted = history(4, 1)[0];
    fetcher
      .mockResolvedValueOnce(response(page([sameNameElsewhere])))
      .mockResolvedValueOnce(response({ message: posted }))
      .mockResolvedValueOnce(response(page(history(2, 3), false, "after")));
    await session.refresh();
    await session.send(posted.name, posted.body);
    expect(session.getState().sentMessageIds).toEqual([posted.id]);
    await session.refresh();
    expect(new URL(String(fetcher.mock.calls[2][0])).searchParams.get("after"))
      .toBe(visitorChatCursor(sameNameElsewhere));
    expect(session.getState().messages).toEqual(history(1, 4));
    session.dispose();
  });

  it("resumes from the last complete incremental page after a network failure", async () => {
    const { session, fetcher } = setupSession();
    fetcher
      .mockResolvedValueOnce(response(page(history(1, 100))))
      .mockResolvedValueOnce(response(page(history(101, 100), true, "after")))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(response(page(history(201, 50), false, "after")));
    await session.refresh();
    await session.refresh();
    expect(session.getState().messages).toEqual(history(1, 200));
    expect(session.getState().status).toBe("error");
    await session.refresh();
    expect(session.getState().messages).toEqual(history(1, 250));
    expect(session.getState().status).toBe("ready");
    expect(new URL(String(fetcher.mock.calls[3][0])).searchParams.get("after"))
      .toBe(visitorChatCursor(history(200, 1)[0]));
    session.dispose();
  });

  it("retries an older-page failure at the same position without changing the live connection state", async () => {
    const { session, fetcher } = setupSession();
    fetcher
      .mockResolvedValueOnce(response(page(history(101, 100), true)))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(response(page(history(1, 100))));
    await session.refresh();
    await session.loadOlder();
    expect(session.getState()).toMatchObject({ status: "ready", hasOlder: true, loadingOlder: false });
    expect(session.getState().historyError).toContain("연결하지 못했습니다");
    await session.loadOlder();
    expect(fetcher.mock.calls[1][0]).toEqual(fetcher.mock.calls[2][0]);
    expect(session.getState().messages).toEqual(history(1, 200));
    expect(session.getState().historyError).toBeNull();
    session.dispose();
  });

  it("rejects non-progressing incremental pages and preserves the retry cursor", async () => {
    const { session, fetcher } = setupSession();
    fetcher
      .mockResolvedValueOnce(response(page(history(1, 1))))
      .mockResolvedValueOnce(response(page(history(1, 1), true, "after")))
      .mockResolvedValueOnce(response(page(history(2, 1), false, "after")));
    await session.refresh();
    await session.refresh();
    expect(session.getState().status).toBe("error");
    expect(fetcher).toHaveBeenCalledTimes(2);
    await session.refresh();
    expect(fetcher.mock.calls[1][0]).toBe(fetcher.mock.calls[2][0]);
    expect(session.getState().messages).toEqual(history(1, 2));
    session.dispose();
  });

  it("catches all arrivals after an initially empty room", async () => {
    const { session, fetcher } = setupSession();
    fetcher
      .mockResolvedValueOnce(response(page([])))
      .mockResolvedValueOnce(response(page(history(1, 100), true, "after")))
      .mockResolvedValueOnce(response(page(history(101, 20), false, "after")));
    await session.refresh();
    await session.refresh();
    expect(new URL(String(fetcher.mock.calls[1][0])).searchParams.get("after")).toBe("0:!");
    expect(session.getState().messages).toEqual(history(1, 120));
    session.dispose();
  });

  it("aborts older-page work on disposal without publishing its late response", async () => {
    const older = deferred<Response>();
    const { session, fetcher, onChange } = setupSession();
    fetcher.mockResolvedValueOnce(response(page(history(101, 100), true))).mockReturnValueOnce(older.promise);
    await session.refresh();
    const pending = session.loadOlder();
    session.dispose();
    expect(fetcher.mock.calls[1][1]!.signal!.aborted).toBe(true);
    onChange.mockClear();
    older.resolve(response(page(history(1, 100))));
    await pending;
    expect(onChange).not.toHaveBeenCalled();
  });
});
