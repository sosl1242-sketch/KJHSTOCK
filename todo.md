# KJHSTOCK TODO

- [x] DB 스키마 이식 (stocks 테이블 + marketRank 컬럼)
- [x] DB 마이그레이션 SQL 적용
- [x] 서버: shared/types.ts, shared/const.ts 이식
- [x] 서버: technicalIndicators.ts 이식
- [x] 서버: financials.ts 이식
- [x] 서버: stockPrice.ts 이식
- [x] 서버: priceAutoRefresh.ts 이식
- [x] 서버: kospiSeed.ts 이식
- [x] 서버: usStocks.ts 이식
- [x] 서버: cryptoFutures.ts 이식
- [x] 서버: scheduled.ts 이식
- [x] 서버: routers.ts 이식 (stocks, globalStocks, cryptoFutures 라우터)
- [x] 서버: db.ts 이식 (listStocks, upsertStock, deleteStock, updateStockPrice)
- [x] 클라이언트: index.css 스칸디나비안 미니멀 테마 적용
- [x] 클라이언트: index.html 폰트/타이틀 이식
- [x] 클라이언트: App.tsx 이식 (라우팅 + DashboardLayout)
- [x] 클라이언트: PasswordLogin.tsx 이식
- [x] 클라이언트: DashboardLayout.tsx 이식 (사이드바 + 비밀번호 인증)
- [x] 클라이언트: Home.tsx (국내주식 섹터분석) 이식
- [x] 클라이언트: GlobalStocks.tsx 이식 + 12개 보조지표 모달 + 장기 차트 완성
- [x] 클라이언트: CryptoSectors.tsx 이식 + 12개 보조지표 모달 + 장기 차트 완성
- [x] Vitest 테스트 이식 (technicalIndicators, financials, stocks, cryptoFutures, usStocks)
- [x] pnpm 의존성 추가 (recharts 등 누락 패키지)
- [x] TypeScript 검사 통과
- [x] 빌드 검증
- [x] 체크포인트 저장

## 버그 수정 (2026-05-13)
- [x] 크립토 페이지: USDT 선물 데이터 표시 및 보조지표 모달 완전 동작
- [x] 국내주식 페이지: 가격 이력 데이터 오류 수정 (Yahoo Finance range 3y→1y 수정, 타임아웃 증가)
- [x] 크립토 페이지: 클라이언트에서 Binance API 직접 호출 방식으로 전환 (서버 타임아웃 우회)

## 추가 개선 항목
- [x] 국내주식 상세 모달: range=2y(485개 캠듸)로 수정하여 2년 장기 차트 지원 확보 (range=3y는 API 버그로 0개 반환)

## 개선 요청 (2026-05-13 #2)
- [x] 해외주식·크립토: 최근 5일 가격 요약 차트 → 90일로 변경
- [x] 미국 대형주: 24개 → 199개로 확장 (AMZN 중복 제거로 199개)
- [x] TypeScript 검사 통과 (TWTR null 값 수정)
- [x] 프로덕션 빌드 검증 완료

## 버그 수정 (2026-05-13 #2)
- [x] Cannot read properties of undefined (reading 'find') 오류 수정 - stocks.list 등 4개 프로시저를 publicProcedure로 변경 (비밀번호 인증 환경에서 Manus OAuth 세션 없이도 접근 가능)

## 공개 접근 구조 전환 (2026-05-13 #3)
- [x] 비로그인 사용자 공개 접근 설정: 국내/해외/크립토 섹터분석, 테이블, 차트, 지표 조회 모두 공개 (DashboardLayout 수정)
- [x] 로그인 팝업/리다이렉트 제거: 비로그인 사용자 페이지 접근 시 로그인 강제 안 함
- [x] UI 조건부 렌더링: 비로그인 사용자에게 편집 패널, 저장/초기화/수정 버튼 숨김
- [x] API 분리: 공개 조회용 vs 관리자 수정용 라우터 분리 (publicProcedure vs adminProcedure)
- [x] DB 캐시 테이블 생성: stock_financial_cache, price_history_cache, us_stock_cache, crypto_futures_cache
- [x] 공개 조회 3개 API DB 캐싱: financialDetail, financialSummaries, technicalIndicators
- [x] 캐시 동기화 함수 작성: server/cacheSync.ts (syncStockFinancialCache, syncStockTechnicalCache)

## 공개 조회 API DB 캐싱 완료 (2026-05-13 #4)
- [x] DB 캐시 테이블 생성 및 마이그레이션 적용
- [x] DB 캐시 헬퍼 함수 추가 (server/db.ts)
- [x] 공개 조회 3개 라우터 DB 캐시 기반으로 수정:
  - [x] financialDetail: DB 캐시 우선, 없으면 실시간 조회
  - [x] financialSummaries: DB 캐시 우선, 없으면 error 반환
  - [x] technicalIndicators: DB 캐시 우선, 없으면 실시간 조회
- [x] 캐시 동기화 함수 작성 (server/cacheSync.ts)
- [x] TypeScript 검사 통과 (36개 테스트 모두 통과)

## 로컬 cron 기반 동기화로 전환 (2026-05-13 #5)
- [x] Vercel scheduled 라우트 제거
- [x] 로컬 cron runner 추가 (scripts/localCron.ts)
- [x] 로컬 cron 상태 함수 작성 (server/cacheAutoRefresh.ts)
- [x] TypeScript 검사 통과 (36개 테스트 모두 통과)
- [x] 관리자 패널에서 로컬 cron 상태 확인 기능 추가
- [x] 모든 기능 구현 완료 및 테스트 통과




## 크립토 DB 캠싱 완전 구옄 (2026-05-13 #6)
- [x] 크립토 technicalIndicators 라우터를 DB 캐시 기반으로 수정
- [x] 크립토 캐시 동기화 함수 추가 (server/cacheSync.ts - syncCryptoTechnicalCache)
- [x] 상위 15개 크립토 심볼 일 1회 자동 캐싱
- [x] priceHistoryCache에 크립토 데이터 저장 (market='CRYPTO')
- [x] TypeScript 검사 통과 (36개 테스트 모두 통과)
- [x] 크립토 초기 캠닜 데이터 로드: 서버 시작 시 동기적 로드 + 로컬 cron + 관리자 수동 로드


## 크립토 가격 스케일 오류 버그 (2026-05-13 #7)
- [x] Bitcoin 가격이 $80,000인데 차트가 $0.1~$0.2 범위로 그려지는 문제 진단
- [x] Recharts Y축 domain 자동 계산 문제 파악
- [x] Y축 범위를 동적으로 계산하여 설정 (minPrice, maxPrice, padding 10%)
- [x] 테스트 및 체크포인트 저장 (36개 테스트 모두 통과)
