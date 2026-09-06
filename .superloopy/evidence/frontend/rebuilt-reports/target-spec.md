# Rebuilt report upper-section target

Generated with built-in imagegen in one call. Reference: `report-reference.png`.
This reference covers the report introduction, market conclusion and beginning of
the observation list. All reference values are illustrative, never production data.

## Composition and copy

1. Existing KJHSTOCK masthead and four navigation tabs provide compact context.
   `분석 리포트` has a teal underline. Preserve the app's existing shell in code.
2. Left-aligned `시장 분석 리포트` title, followed by
   `시장 전체의 흐름과 관찰할 종목을 데이터로 정리합니다.`
   Right side: `새로고침`, `리포트 내보내기`, then a truthful data timestamp.
   The reference visibly marks `예시 데이터 · 디자인 레퍼런스`.
3. A broad white border-only surface holds the conclusion, explanation, breadth,
   and supporting metrics. Small muted label `시장 종합 판단` precedes the
   conclusion `상승 우세, 거래는 상위 종목에 집중`. Explanation:
   `상승 계약이 하락 계약보다 많지만, 거래대금의 절반 이상이 상위 5개 종목에 모여 있습니다.`
   `확산 여부와 유동성을 함께 확인할 구간입니다.`
   Production conclusion and sentences must derive from available market data.
4. Below a thin rule, `시장 참여 폭` has the covered contract count at right.
   One horizontal stacked bar encodes advancing, unchanged and declining counts;
   the legend repeats names, counts and percentages. The reference uses
   184 / 12 / 116 contracts (59.0% / 3.8% / 37.2%). No inference confidence.
5. Three compact metrics share the same surface and thin vertical separators:
   `24시간 거래대금` ($64.8B, `전체 계약 합산`),
   `상위 5개 거래 비중` (57.4%, `거래대금 집중도`), and
   `펀딩비 데이터` (286 / 312개, `적용 가능한 계약 확인`).
   Report funding coverage against the actual applicable-contract denominator.
6. Next section begins `우선 관찰할 종목`, with
   `선정 이유와 확인할 조건을 함께 읽어보세요.`
   A ranked ruled list has 순위 / 종목 / 관찰 이유 / 확인할 조건 columns.
   Reference BTCUSDT and ETHUSDT rows illustrate explanation density only.

## Tokens and layout

- Preserve DESIGN.md tokens: #f5f7fa page, #ffffff surfaces, #172b3a ink,
  #526477 secondary, #dbe3eb rules, #087f8c accent, #047857 advancing,
  #be123c declining. Neutral bar segment uses an existing slate token.
- Noto Sans KR; intended CSS sizes 28px title, 20px conclusion and metric values,
  16px subsection, 14px explanation, 12px metadata. Weights 400 / 600 / 700;
  tabular numbers. Raster rendering may scale these, so token sizes govern code.
- 32px desktop gutters, 24px panel insets, base-4 spacing, 12px surface radius,
  8px controls, 1px rules. No new shadows or decorative motion.
- The broad verdict panel is the composition anchor. Supporting metrics are
  inline columns in this panel, not disconnected equal cards.
- Keep 40px controls, visible focus and responsive wrapping. On narrow screens,
  actions wrap below the title, supporting metrics stack with horizontal rules,
  and ranked entries can become readable stacked rows while retaining labels.
- Do not reproduce raster artifacts, ellipsis decoration at image bottom, or
  sample figures in production. Do not add model badges, prediction probability,
  BUY/SELL certainty, sidebar, hero imagery, gradients or visual filler.

## Final generation prompt summary

One high-fidelity Korean editorial market research upper-section for KJHSTOCK:
title, timestamp and refresh/export actions; broad factual verdict and explanation;
market breadth bar with count legend; compact liquidity concentration and funding
coverage metrics; ranked observation list teaser. Slate/white/teal DESIGN.md system,
Noto Sans KR, accessible contrast, border-only depth. Explicit illustrative-data
label. No fake AI inference, confidence probability or compressed whole-page board.
