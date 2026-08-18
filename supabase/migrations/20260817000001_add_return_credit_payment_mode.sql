-- ============================================================
--  Add "Return Credit" payment mode
--
--  New payment_receipts.mode value used when a customer returns
--  product and the value is credited against their invoice
--  balance instead of being an actual cash/bank payment. See
--  src/components/common/AddPaymentModal.tsx and the "Money
--  Received" reporting in src/components/Reports/ReportsPage.tsx,
--  which excludes this mode from cash-received totals.
-- ============================================================

alter type payment_mode_enum add value if not exists 'Return Credit';
