-- ============================================================
--  Add "Exchange of Wheat" payment mode
--
--  New payment_receipts.mode value used when a customer supplies
--  wheat and is credited flour in return (after deducting our
--  profit margin) instead of an actual cash/bank payment. See
--  src/components/common/AddPaymentModal.tsx and the "Money
--  Received" reporting in src/components/Reports/ReportsPage.tsx,
--  which excludes this mode from cash-received totals (same
--  treatment as "Return Credit", added in the previous migration).
-- ============================================================

alter type payment_mode_enum add value if not exists 'Exchange of Wheat';
