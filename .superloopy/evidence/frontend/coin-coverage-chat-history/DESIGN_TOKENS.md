# KJHSTOCK, clear market workspace

## 1. Atmosphere and signature
An uncluttered Korean market workspace. The Sheet is the first destination; charts,
reports and selected-contract analysis have their own views. Dense data is balanced
by generous section gutters, restrained weight and clear Korean labels.
DESIGN_VARIANCE=4, MOTION_INTENSITY=1, VISUAL_DENSITY=8.
The existing data charts are the visual assets; decorative photographs do not help
compare financial contracts. Preserve Lucide icons and real Recharts visualizations.

## 2. Color
| Token | Value | Purpose |
|---|---|---|
| --market-bg | #f5f7fa | Page |
| --market-surface | #ffffff | Sheet and panels |
| --market-ink | #172b3a | Primary text |
| --market-muted | #526477 | Secondary text |
| --market-line | #dbe3eb | Rules and borders |
| --market-accent | #087f8c | Selected controls, focus |
| --market-accent-ink | #066571 | Accent text, sufficient contrast on white |
| --market-tint | #eaf6f7 | Selected rows, hover |
| --market-positive | #047857 | Positive values |
| --market-negative | #be123c | Negative values |
| --market-soft | #f1f5f9 | Secondary surfaces |
| --market-warning | #92400e | Existing favorite and caution semantics |

Existing chart/report semantic palette retained (not new brand accents):
slate #f4f7fa #f8fafc #e2e8f0 #cbd5e1 #94a3b8 #64748b #475569 #334155 #1e293b #0f172a;
teal/cyan #0891b2 #06b6d4 #0e7490 #38bdf8;
gains #10b981 #059669 #34d399 #064e3b; losses #f43f5e #e11d48 #fb7185;
warnings #f59e0b #d97706 #fbbf24; chart comparison #6366f1 #8b5cf6.
These inherited categorical chart colors remain data encodings.

## 3. Typography
Noto Sans KR first, Segoe UI and system sans fallback. Korean labels have intentional
word breaks; numbers use tabular lining figures. Font size scale: 10, 11, 12, 13,
14, 16, 18, 20, 24, 28, 32, 36px. Main heading 28px/700/1.3, mobile 24px.
Section heading 18px/700/1.4; body 14px/400/1.6; table 13px/500/1.5;
column labels 12px/600; metadata 12px/400/1.5. Avoid ubiquitous black/900 weights.
Tracking: normal; brand 0.06em. Existing charts may retain 10/11px ticks.

## 4. Spacing
Base 4px. --space-1=4px, --space-2=8px, --space-3=12px, --space-4=16px,
--space-5=20px, --space-6=24px, --space-8=32px, --space-10=40px,
--space-12=48px, --space-16=64px. 2px allowed for focus offset and optical label gaps.
Main content max-width 1600px, page gutter 32px desktop, 24px tablet, 16px mobile.
Sheet height 560px desktop / 60vh mobile, row height 56px, header 44px.
Table min-width 1200px. Only the Sheet scrolls horizontally, with the name column
fixed at the leading edge. Name width 184px desktop / 156px mobile.
Breakpoints 640, 768, 1024, 1280px; existing charts may retain 1536px layout.

## 5. Components
Surface radius 12px, input/button 8px, badges 4px. Border 1px.
Research semantic rule and optical chart separation: --research-rule-width=2px.
Header: white, brand left, connection health and reload right.
Summary strip: four metrics divided by rules, 24px inset (16px mobile), no shadows.
Navigation: four view buttons, explicit selected underline, 44px targets.
Filters: visible labels, 40px controls, search spans remaining width. Clear filters
button resets search and filters while keeping user sorting. Favorite toggle remains.
Search and all Sheet filters stay visible at every breakpoint. A labelled
"종목 필터" section shows asset type, market, quote currency, signal and sorting,
with active filter count, favorite toggle and reset. Use five columns on desktop,
two on mobile, and a separate action row. Never hide filters in a disclosure.
Sheet headers: real buttons inside th with scope=col and aria-sort; inactive
ArrowUpDown, active ArrowUp/ArrowDown plus tint. Numeric headers align right.
First click uses a sensible per-field default, repeated click reverses. Missing
values always last. Sort full filtered dataset before pagination. 50 rows/page.
Name links open detail view; favorite buttons stop row selection.
Sheet overflow: retain the 1200px readable table and native scrolling. Add a
40px-high horizontal range with left/right 40px controls directly above the
table, using existing accent/line/surface tokens and 12px labels, 12px/16px inset.
Mouse dragging pans the table after 6px movement, with grab/grabbing cursors and
click suppression so rows, favorites and sort headers only activate on a click.
Touch keeps native pan and pinch zoom. The upper range, wheel and pointer scrolling
stay synchronized; missing overflow disables the range and direction controls.
Keep the name column and table heading sticky while reaching the last column.
Distinct keyboard focus outline 2px accent and offset 2px. Hover tint, selected tint + weight 700,
disabled opacity .5. Empty state explains cause and offers filter reset. Loading
state uses truthful text, failures expose retry. Prices never masquerade as zeros.
Research report: an editorial brief with market regime and its evidence first,
then market breadth, liquidity concentration and data coverage. The candidate
list leads to expanded evidence, 1h/4h closed-candle comparisons, and conditions
that support or invalidate the current view. Use existing tokens, quiet rules,
one accent and semantic rise/fall colors. No probability-like summary score.
Keep generation time, universe, refresh, export, partial/error state and method
visible or one clearly labelled disclosure away. No claim of live model inference.
Coin purpose: a quiet, always-visible text block inside the selected-contract
section, below its identity and above quote metrics. Heading 14px/600, summary
14px/400/1.6, source and reviewed date 12px. Use a top rule and 16px spacing,
existing muted/ink/accent tokens, and no extra card or decorative imagery.
Show a Korean purpose and token-role summary of at most 300 Unicode characters,
official source and review date. Unregistered or non-crypto assets have explicit
neutral text. A static description must remain independent of candle API loading.

## 6. Motion
Visitor chat extends the workspace with a 288px left column and 24px gap at
1280px and above. It sits under the shared header, is sticky 24px from the top,
and has its own message scroll region (maximum 640px, minimum 320px). The main
market column remains minmax(0, 1fr). Below 1280px, use a labelled disclosure
above the market content, collapsed initially, with a maximum 480px message area.
Chat uses the existing surface, line, ink, muted and accent tokens, 12px radius,
16px panel inset, 12px message gaps, 14px message text and 12px timestamp metadata.
Name entry precedes composing; names are 1–20 characters and messages 1–500.
Messages accumulate in chronological order, oldest above and newest below, with
stable IDs and real server timestamps. Keep the composer below the conversation.
Load the latest page initially and offer earlier pages above the list without
discarding messages already loaded. Preserve the visible reading position while
older pages prepend. Follow new messages only when the reader is near the bottom;
otherwise show a new-message button that returns to the latest conversation.
Use quiet date separators, the existing soft/tint surfaces for message bubbles,
14px body text and 12px name/time metadata. Do not infer identity from nicknames.
Connection, empty, retry and send failures are explicit. No sample conversations
or online counts appear in production. The nickname is a display name, not proof
of identity. Chat delivery errors never remove the unsent draft.

No decorative motion. Existing data charts keep animations disabled for stable
reading. Loader rotation only; reduced-motion disables spinner animation. Focus,
sorting and active view changes are immediate.

## 7. Depth
Borders and tonal surfaces. No new shadows, glows or gradients. Existing legacy
chart/report shadow-sm can be removed within this dashboard to maintain one system.
