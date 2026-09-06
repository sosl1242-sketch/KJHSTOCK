# Visitor chat target

The existing KJHSTOCK market workspace is the visual reference. This bounded
extension uses the current DESIGN.md contract and existing Lucide icon family.
No new page, imagery, brand palette, or decorative motion is introduced.

## Layout

At 1280px and above the parent places a 288px chat column to the left of the
market, with a 24px gap. The panel opens initially and stays 24px from the top.
Below 1280px it becomes an initially collapsed native disclosure above the market.
The parent owns the outer grid. The chat panel has a white surface, a 1px line,
12px corners, and 16px inner spacing. The message region scrolls independently,
with 320px minimum and 640px maximum height (480px maximum on smaller screens).

## Hierarchy and copy

The summary reads “방문자 대화”, followed by “최신순” and a disclosure chevron.
Body text is 14px with 1.6 line height. Heading is 18px semibold; names are 14px
semibold; timestamps, hints, and character counts are 12px. All colors reference
the market surface, ink, muted, line, accent, accent-ink, tint, negative, and soft
tokens. Controls are at least 40px tall, with 8px corners and a 2px focus outline.

Name entry and the message composer sit above the conversation list, immediately
after the connection state. A saved display name has an “이름 변경”
control. Name input explains the 1~20 character requirement. Composer displays its
500 character limit and “Ctrl / ⌘ + Enter로 전송” hint. The primary action is
“보내기”; while awaiting the server it reads “전송 중”.
The note “이름과 대화는 방문자에게 공개됩니다.” stays visible by the composer.

Messages use real server names, timestamps and stable IDs, newest first. Each
message has a quiet separating rule rather than a speech bubble or avatar. The
list remains readable before entering a name. When the reader is away from the
top, newly received messages preserve the visible anchor and reveal “새 대화 보기”.

## States and behavior

- No configured endpoint: explicitly state that the chat server is not connected.
- Loading: truthful text, no synthetic conversations.
- Empty: explain that no messages have been posted yet.
- Error: preserve any received messages and offer “다시 연결”.
- Missing name: keep the composer disabled until a valid name is saved.
- Invalid name/message: associate concise validation with the relevant field.
- Sending: lock duplicate submissions; failed delivery preserves the draft.
- Keyboard: native disclosure, labelled fields, visible focus, and IME-safe shortcut.
- Local preference: nickname storage is best-effort and never a login claim.

## Review ownership

This worker supplies the component, stylesheet, and token-compliance evidence.
The parent integrates the grid and performs real-browser QA at 390, 768, and
1280px, including server-connected, empty, error, and send states.

## Implementation checks, 2026-09-06

- `node node_modules/typescript/bin/tsc --noEmit`: exit 0 after integration with
  the supplied hook.
- `ds-compliance.mjs DESIGN.md client/src/components/VisitorChat.tsx
  client/src/styles/visitor-chat.css`: exit 0.
- Independent read-only review identified forbidden nickname characters and
  inconsistent whitespace counting. Both were corrected: saved names, new names,
  and submitted messages follow server character rules; button state and shortcut
  use the same NFC-normalized, trimmed Unicode character count.
- Anti-slop source review: no new raw colors, emoji icons, shadows, gradients,
  decorative motion, sample conversations, online counts, or visible em-dashes.
- The new-message control overlays the existing scroll region so revealing it
  does not shift the reader's visible content. Existing message anchors are
  restored by stable message ID when a new head arrives.
- Browser screenshots and interactive verification remain with the integrating
  parent; this artifact is implementation evidence, not a browser pass claim.
