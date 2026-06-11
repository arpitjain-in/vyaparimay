---
name: project-truck-load-sheet
description: Truck Load Sheet feature — select multiple invoices on Invoice History to see consolidated SKU quantities for truck dispatch
metadata:
  type: project
---

Implemented a "Truck Load" mode on the Invoice History page (`src/components/Invoices/InvoiceHistory.tsx`) and a new `TruckLoadSheet` modal (`src/components/Invoices/TruckLoadSheet.tsx`).

**Why:** Flour mill dispatches multiple customer orders in a single truck. Staff needed a way to select the relevant invoices and get a consolidated count of each SKU to know what to load, instead of manually tallying across invoices.

**How it works:**
- "Truck Load" toggle button in Invoice History header activates selection mode
- Checkboxes appear on each non-cancelled invoice row; selected rows highlight in indigo
- Fixed bottom bar shows count and "View Load Sheet" button once any invoices are selected
- Load sheet aggregates all `items` across selected invoices by `skuId`, grouped by product
- Outer bag counts shown for pouches: `WF-5P` (5kg) = 6 pouches/bag, `WF-10P` (10kg) = 3 pouches/bag — displayed as `qty (outerBags)` using `Math.ceil`
- Print opens a new window with 80mm thermal printer-optimized HTML (`@page { size: 80mm auto; margin: 0 }`)
- Entirely read-only — no store mutations, no database writes; all state is local component state

**How to apply:** If outer bag ratios change or new pouch SKUs are added, update `OUTER_BAG_RATIO` in `TruckLoadSheet.tsx`.
