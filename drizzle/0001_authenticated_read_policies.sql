ALTER TABLE "crypto_futures_cache" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "price_history_cache" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_financial_cache" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stocks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "us_stock_cache" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "crypto_futures_cache" FROM anon;
REVOKE ALL ON TABLE "price_history_cache" FROM anon;
REVOKE ALL ON TABLE "stock_financial_cache" FROM anon;
REVOKE ALL ON TABLE "stocks" FROM anon;
REVOKE ALL ON TABLE "us_stock_cache" FROM anon;
REVOKE ALL ON TABLE "users" FROM anon;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON TABLE "crypto_futures_cache" TO authenticated;
GRANT SELECT ON TABLE "price_history_cache" TO authenticated;
GRANT SELECT ON TABLE "stock_financial_cache" TO authenticated;
GRANT SELECT ON TABLE "stocks" TO authenticated;
GRANT SELECT ON TABLE "us_stock_cache" TO authenticated;
GRANT SELECT ON TABLE "users" TO authenticated;

DROP POLICY IF EXISTS "authenticated can read crypto futures cache" ON "crypto_futures_cache";
CREATE POLICY "authenticated can read crypto futures cache"
  ON "crypto_futures_cache"
  FOR SELECT
  TO authenticated
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "authenticated can read price history cache" ON "price_history_cache";
CREATE POLICY "authenticated can read price history cache"
  ON "price_history_cache"
  FOR SELECT
  TO authenticated
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "authenticated can read stock financial cache" ON "stock_financial_cache";
CREATE POLICY "authenticated can read stock financial cache"
  ON "stock_financial_cache"
  FOR SELECT
  TO authenticated
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "authenticated can read stocks" ON "stocks";
CREATE POLICY "authenticated can read stocks"
  ON "stocks"
  FOR SELECT
  TO authenticated
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "authenticated can read us stock cache" ON "us_stock_cache";
CREATE POLICY "authenticated can read us stock cache"
  ON "us_stock_cache"
  FOR SELECT
  TO authenticated
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "users can read own profile" ON "users";
CREATE POLICY "users can read own profile"
  ON "users"
  FOR SELECT
  TO authenticated
  USING ("openId" = auth.uid()::text);
