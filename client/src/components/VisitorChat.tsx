import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { ArrowUp, ChevronDown, MessageSquare, RefreshCw, Send } from "lucide-react";
import { useVisitorChat } from "@/hooks/useVisitorChat";
import "@/styles/visitor-chat.css";

const NAME_STORAGE_KEY = "kjhstock.visitor-chat.name";
const DESKTOP_QUERY = "(min-width: 1280px)";
const FORBIDDEN_TEXT = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/;
const characterCount = (value: string) => Array.from(value.normalize("NFC")).length;
const normalizeText = (value: string) => value.normalize("NFC").trim();
const hasInvalidNameCharacters = (value: string) => /[\r\n\t]/.test(value) || FORBIDDEN_TEXT.test(value);
type ChatMessage = ReturnType<typeof useVisitorChat>["messages"][number];

function readSavedName() {
  try {
    const name = normalizeText(window.localStorage.getItem(NAME_STORAGE_KEY) ?? "");
    return characterCount(name) <= 20 && !hasInvalidNameCharacters(name) ? name : "";
  } catch {
    return "";
  }
}

function NameForm({ name, onSave, onCancel }: {
  name: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(name);
  const [error, setError] = useState("");
  const id = useId();

  function saveName(event: FormEvent) {
    event.preventDefault();
    const nextName = normalizeText(value);
    if (characterCount(nextName) < 1 || characterCount(nextName) > 20) {
      setError("대화명을 1~20자로 입력해주세요.");
      return;
    }
    if (hasInvalidNameCharacters(nextName)) {
      setError("대화명에서 줄바꿈과 보이지 않는 특수문자를 지워주세요.");
      return;
    }
    try {
      window.localStorage.setItem(NAME_STORAGE_KEY, nextName);
    } catch {
      // A display name is still usable when browser storage is unavailable.
    }
    onSave(nextName);
  }

  return (
    <form className="visitor-chat-name-form" onSubmit={saveName}>
      <label htmlFor={id}>대화명</label>
      <input
        id={id}
        value={value}
        autoComplete="nickname"
        placeholder="표시할 이름을 입력하세요"
        aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
        aria-invalid={Boolean(error)}
        onChange={event => { setValue(event.target.value); setError(""); }}
      />
      <p id={`${id}-hint`} className="visitor-chat-meta">대화에 표시할 이름 · 1~20자</p>
      {error && <p id={`${id}-error`} className="visitor-chat-error" role="alert">{error}</p>}
      <div className="visitor-chat-actions">
        <button className="visitor-chat-button visitor-chat-primary" type="submit">이름 저장</button>
        {name && <button className="visitor-chat-button" type="button" onClick={onCancel}>취소</button>}
      </div>
    </form>
  );
}

function MessageItem({ message }: { message: ChatMessage }) {
  const date = new Date(message.createdAt);
  const validDate = Number.isFinite(date.getTime());
  const time = validDate
    ? date.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "시간 확인 불가";

  return (
    <li className="visitor-chat-message" data-message-id={message.id}>
      <div className="visitor-chat-message-heading">
        <span className="visitor-chat-message-name">{message.name}</span>
        <time dateTime={validDate ? message.createdAt : undefined} title={validDate ? date.toLocaleString("ko-KR") : undefined}>
          {time}
        </time>
      </div>
      <p>{message.body}</p>
    </li>
  );
}

function MessageList({ messages, status, expanded }: {
  messages: ChatMessage[];
  status: ReturnType<typeof useVisitorChat>["status"];
  expanded: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const atTopRef = useRef(true);
  const anchorRef = useRef<{ id: string; offset: number } | null>(null);
  const previousHeadRef = useRef<string | undefined>(undefined);
  const [hasNewMessages, setHasNewMessages] = useState(false);

  function captureAnchor() {
    const region = scrollRef.current;
    if (!region) return;
    atTopRef.current = region.scrollTop <= 16;
    if (atTopRef.current) setHasNewMessages(false);
    const top = region.getBoundingClientRect().top;
    const firstVisible = Array.from(region.querySelectorAll<HTMLElement>("[data-message-id]"))
      .find(item => item.getBoundingClientRect().bottom > top);
    anchorRef.current = firstVisible
      ? { id: firstVisible.dataset.messageId!, offset: firstVisible.getBoundingClientRect().top - top }
      : null;
  }

  useLayoutEffect(() => {
    const region = scrollRef.current;
    if (!region || !expanded) return;
    const nextHead = messages[0]?.id;
    const changedHead = previousHeadRef.current !== undefined && nextHead !== previousHeadRef.current;
    if (changedHead && !atTopRef.current) {
      const anchor = anchorRef.current;
      const existingItem = anchor && Array.from(region.querySelectorAll<HTMLElement>("[data-message-id]"))
        .find(item => item.dataset.messageId === anchor.id);
      if (anchor && existingItem) {
        region.scrollTop += existingItem.getBoundingClientRect().top - region.getBoundingClientRect().top - anchor.offset;
      }
      if (nextHead) setHasNewMessages(true);
    } else if (atTopRef.current) {
      region.scrollTop = 0;
    }
    previousHeadRef.current = nextHead;
    captureAnchor();
  }, [messages, expanded]);

  function showNewest() {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    setHasNewMessages(false);
    captureAnchor();
    scrollRef.current?.focus({ preventScroll: true });
  }

  const emptyText = status === "loading"
    ? "대화를 불러오는 중입니다."
    : status === "unconfigured"
      ? "서버가 연결되면 이곳에 대화가 표시됩니다."
      : status === "error"
        ? "대화를 불러오지 못했습니다. 다시 연결해주세요."
        : "아직 대화가 없습니다. 첫 이야기를 남겨보세요.";

  return (
    <div className="visitor-chat-conversation">
      {hasNewMessages && (
        <div className="visitor-chat-new-message" role="status">
          <button className="visitor-chat-button" type="button" onClick={showNewest}>
            <ArrowUp aria-hidden="true" />새 대화 보기
          </button>
        </div>
      )}
      <div className="visitor-chat-messages" ref={scrollRef} onScroll={captureAnchor} tabIndex={0} role="region" aria-label="방문자 대화, 최신순" aria-busy={status === "loading"}>
        {messages.length > 0
          ? <ol>{messages.map(message => <MessageItem key={message.id} message={message} />)}</ol>
          : <p className="visitor-chat-empty" role="status">{emptyText}</p>}
      </div>
    </div>
  );
}

function Composer({ name, disabled, sending, send }: {
  name: string;
  disabled: boolean;
  sending: boolean;
  send: (name: string, body: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState("");
  const [localSending, setLocalSending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [invalid, setInvalid] = useState(false);
  const lockedRef = useRef(false);
  const composingRef = useRef(false);
  const id = useId();
  const count = characterCount(normalizeText(draft));
  const busy = sending || localSending;

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (disabled || busy || lockedRef.current || !name) return;
    const body = normalizeText(draft);
    if (characterCount(body) < 1 || characterCount(body) > 500) {
      setInvalid(true);
      setFeedback("메시지를 1~500자로 입력해주세요.");
      return;
    }
    if (FORBIDDEN_TEXT.test(body)) {
      setInvalid(true);
      setFeedback("메시지에서 보이지 않는 특수문자를 지워주세요.");
      return;
    }
    lockedRef.current = true;
    setLocalSending(true);
    setInvalid(false);
    setFeedback("");
    const submittedDraft = draft;
    try {
      if (await send(name, body)) {
        setDraft(current => current === submittedDraft ? "" : current);
        setFeedback("메시지를 보냈습니다.");
      } else {
        setFeedback("전송하지 못했습니다. 작성한 내용을 유지했습니다.");
      }
    } catch {
      setFeedback("전송하지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      lockedRef.current = false;
      setLocalSending(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)
      && !composingRef.current && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <form className="visitor-chat-composer" onSubmit={submit}>
      <div className="visitor-chat-field-heading">
        <label htmlFor={id}>메시지</label>
        <span className={`visitor-chat-meta${count > 500 ? " visitor-chat-error" : ""}`}>{count}/500</span>
      </div>
      <textarea
        id={id}
        rows={3}
        value={draft}
        disabled={disabled || busy || !name}
        placeholder={name ? "함께 나눌 이야기를 적어주세요" : "대화명을 먼저 정해주세요"}
        aria-describedby={`${id}-hint${feedback ? ` ${id}-feedback` : ""}`}
        aria-invalid={invalid || count > 500}
        onChange={event => { setDraft(event.target.value); setFeedback(""); setInvalid(false); }}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => { composingRef.current = true; }}
        onCompositionEnd={() => { composingRef.current = false; }}
      />
      <p id={`${id}-hint`} className="visitor-chat-meta">Ctrl / ⌘ + Enter로 전송</p>
      <p className="visitor-chat-meta">이름과 대화는 방문자에게 공개됩니다.</p>
      {feedback && <p id={`${id}-feedback`} className={invalid ? "visitor-chat-error" : "visitor-chat-meta"} role="status">{feedback}</p>}
      <button className="visitor-chat-button visitor-chat-primary visitor-chat-send" type="submit" disabled={disabled || busy || !name || !normalizeText(draft) || count > 500}>
        <Send aria-hidden="true" />{busy ? "전송 중" : "보내기"}
      </button>
    </form>
  );
}

export function VisitorChat() {
  const { messages, status, error, sending, send, refresh } = useVisitorChat();
  const [name, setName] = useState(readSavedName);
  const [editingName, setEditingName] = useState(false);
  const [expanded, setExpanded] = useState(() => typeof window !== "undefined" && window.matchMedia(DESKTOP_QUERY).matches);

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_QUERY);
    const updateDisclosure = (event: MediaQueryListEvent) => setExpanded(event.matches);
    media.addEventListener("change", updateDisclosure);
    return () => media.removeEventListener("change", updateDisclosure);
  }, []);

  return (
    <aside className="visitor-chat-column" aria-label="방문자 대화">
      <details className="visitor-chat" open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}>
        <summary className="visitor-chat-summary">
          <MessageSquare aria-hidden="true" />
          <span className="visitor-chat-title">방문자 대화</span>
          <span className="visitor-chat-order">최신순</span>
          <ChevronDown className="visitor-chat-chevron" aria-hidden="true" />
        </summary>
        <div className="visitor-chat-content">
          {status === "unconfigured" && <p className="visitor-chat-connection" role="status">채팅 서버가 아직 연결되지 않았습니다.</p>}
          {(status === "error" || error) && (
            <div className="visitor-chat-connection visitor-chat-error" role="alert">
              <p>{error || "대화를 불러오지 못했습니다."}</p>
              <button className="visitor-chat-button" type="button" onClick={refresh}><RefreshCw aria-hidden="true" />다시 연결</button>
            </div>
          )}
          <div className="visitor-chat-writing">
            {!name || editingName ? (
              <NameForm name={name} onSave={nextName => { setName(nextName); setEditingName(false); }} onCancel={() => setEditingName(false)} />
            ) : (
              <div className="visitor-chat-identity">
                <span><span className="visitor-chat-meta">대화명</span><strong>{name}</strong></span>
                <button className="visitor-chat-button" type="button" onClick={() => setEditingName(true)} disabled={sending}>이름 변경</button>
              </div>
            )}
            <Composer name={name} disabled={editingName || status === "unconfigured" || status === "loading"} sending={sending} send={send} />
          </div>
          <MessageList messages={messages} status={status} expanded={expanded} />
        </div>
      </details>
    </aside>
  );
}

export default VisitorChat;
