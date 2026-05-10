/**
 * Store — Inventory tests
 * Tests: addPackagingEntry, addReadyStockEntry (+ auto-packaging deduction),
 *        adjustReadyStock, editReadyStockTransaction, deleteReadyStockTransaction,
 *        adjustStock, setReorderLevel, getReadyStockStatus, getStockStatus
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useStore } from '../../store/useStore';

vi.mock('../../lib/db', () => ({
  FIXED_ORG_ID: 'test-org-id',
  savePackagingEntry: vi.fn().mockResolvedValue(undefined),
  saveReadyStockTransaction: vi.fn().mockResolvedValue(undefined),
  saveStockTransaction: vi.fn().mockResolvedValue(undefined),
  saveReorderLevel: vi.fn().mockResolvedValue(undefined),
  updateReadyStockTransactionInDb: vi.fn().mockResolvedValue(undefined),
  deleteReadyStockTransactionInDb: vi.fn().mockResolvedValue(undefined),
  clearAllPackagingData: vi.fn().mockResolvedValue(undefined),
  saveProductionLog: vi.fn().mockResolvedValue(undefined),
  savePrice: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../lib/db.demo', () => ({ FIXED_ORG_ID: 'test-org-id' }));

function resetStore() {
  useStore.setState({
    orgId: 'test-org-id',
    isInitialized: true,
    packagingStock: {
      'PKG-WF-26K': 100, 'PKG-WF-5P': 100, 'PKG-WF-10P': 100,
      'PKG-WF-5H': 100,  'PKG-WF-10H': 100,
      'PKG-BS-40K': 100, 'PKG-BS-500G': 100, 'PKG-DL-500G': 100, 'PKG-BR-40K': 100,
    },
    packagingEntries: [],
    readyStock: {
      'WF-26K': 25, 'WF-5P': 60, 'WF-10P': 30,
      'WF-5H': 20, 'WF-10H': 15, 'WF-25K': 10,
      'BS-40K': 8, 'BS-500G': 200, 'DL-500G': 150, 'BR-40K': 12,
    },
    readyStockTransactions: [],
    rawMaterialStock: { 'RM-WF': 2000, 'RM-BS': 800, 'RM-DL': 400, 'RM-BR': 500 },
    stockTransactions: [],
    reorderLevels: { raw: {}, packaging: {}, ready: {} },
    productionLogs: [],
    lastSyncBatchTime: null,
  });
}

beforeEach(resetStore);

// ─── addPackagingEntry ────────────────────────────────────────────────────────

describe('addPackagingEntry', () => {
  it('increases packaging stock on "purchase" entry', () => {
    useStore.getState().addPackagingEntry({
      date: '09/05/2026',
      materialId: 'PKG-WF-26K',
      materialName: '25/26 kg Bags',
      entryType: 'purchase',
      quantity: 50,
    });
    expect(useStore.getState().packagingStock['PKG-WF-26K']).toBe(150);
  });

  it('decreases packaging stock on "used" entry', () => {
    useStore.getState().addPackagingEntry({
      date: '09/05/2026',
      materialId: 'PKG-WF-26K',
      materialName: '25/26 kg Bags',
      entryType: 'used',
      quantity: 30,
    });
    expect(useStore.getState().packagingStock['PKG-WF-26K']).toBe(70);
  });

  it('stock never goes below 0 on "used" entry', () => {
    useStore.setState({ packagingStock: { 'PKG-WF-26K': 5 } });
    useStore.getState().addPackagingEntry({
      date: '09/05/2026',
      materialId: 'PKG-WF-26K',
      materialName: '25/26 kg Bags',
      entryType: 'used',
      quantity: 100,
    });
    expect(useStore.getState().packagingStock['PKG-WF-26K']).toBe(0);
  });

  it('decreases packaging stock on "damaged" entry', () => {
    useStore.getState().addPackagingEntry({
      date: '09/05/2026',
      materialId: 'PKG-WF-5P',
      materialName: '5 kg Pouches',
      entryType: 'damaged',
      quantity: 10,
    });
    expect(useStore.getState().packagingStock['PKG-WF-5P']).toBe(90);
  });

  it('appends to packagingEntries ledger', () => {
    useStore.getState().addPackagingEntry({
      date: '09/05/2026',
      materialId: 'PKG-WF-26K',
      materialName: '25/26 kg Bags',
      entryType: 'purchase',
      quantity: 50,
    });
    expect(useStore.getState().packagingEntries).toHaveLength(1);
  });
});

// ─── addReadyStockEntry (THE CRITICAL BUG-FIXED FUNCTION) ────────────────────

describe('addReadyStockEntry — increases ready stock AND auto-deducts packaging', () => {
  it('increases ready stock by the given quantity', () => {
    useStore.getState().addReadyStockEntry('WF-26K', 10, 'Production batch', '09/05/2026');
    expect(useStore.getState().readyStock['WF-26K']).toBe(35); // 25 + 10
  });

  it('auto-deducts the linked packaging material by the same qty', () => {
    useStore.getState().addReadyStockEntry('WF-26K', 10, 'Production batch', '09/05/2026');
    // WF-26K uses PKG-WF-26K
    expect(useStore.getState().packagingStock['PKG-WF-26K']).toBe(90); // 100 - 10
  });

  it('does NOT touch packaging of other materials', () => {
    useStore.getState().addReadyStockEntry('WF-26K', 10, undefined, '09/05/2026');
    expect(useStore.getState().packagingStock['PKG-WF-5P']).toBe(100); // unchanged
  });

  it('creates a packaging entry (used) in the ledger', () => {
    useStore.getState().addReadyStockEntry('WF-26K', 10, 'Production', '09/05/2026');
    const pkgEntries = useStore.getState().packagingEntries;
    expect(pkgEntries).toHaveLength(1);
    expect(pkgEntries[0].entryType).toBe('used');
    expect(pkgEntries[0].materialId).toBe('PKG-WF-26K');
    expect(pkgEntries[0].quantity).toBe(10);
  });

  it('creates a ready-stock ADD transaction', () => {
    useStore.getState().addReadyStockEntry('WF-26K', 10, 'Batch A', '09/05/2026');
    const txns = useStore.getState().readyStockTransactions;
    expect(txns).toHaveLength(1);
    expect(txns[0].type).toBe('ADD');
    expect(txns[0].quantity).toBe(10);
    expect(txns[0].previousStock).toBe(25);
    expect(txns[0].newStock).toBe(35);
  });

  it('works for 5 kg Pouch (PKG-WF-5P)', () => {
    useStore.getState().addReadyStockEntry('WF-5P', 40, 'Production', '09/05/2026');
    expect(useStore.getState().readyStock['WF-5P']).toBe(100);      // 60 + 40
    expect(useStore.getState().packagingStock['PKG-WF-5P']).toBe(60); // 100 - 40
  });

  it('works for 10 kg Handle Bag (PKG-WF-10H)', () => {
    useStore.getState().addReadyStockEntry('WF-10H', 5, 'Production', '09/05/2026');
    expect(useStore.getState().readyStock['WF-10H']).toBe(20);       // 15 + 5
    expect(useStore.getState().packagingStock['PKG-WF-10H']).toBe(95); // 100 - 5
  });

  it('packaging never goes below 0 even if stock is insufficient', () => {
    useStore.setState({ packagingStock: { 'PKG-WF-26K': 5 } });
    useStore.getState().addReadyStockEntry('WF-26K', 100, 'Large batch', '09/05/2026');
    expect(useStore.getState().packagingStock['PKG-WF-26K']).toBe(0);
  });

  it('WF-25K and WF-26K share the same packaging material (PKG-WF-26K)', () => {
    useStore.getState().addReadyStockEntry('WF-25K', 5, 'Production', '09/05/2026');
    // both share PKG-WF-26K
    expect(useStore.getState().packagingStock['PKG-WF-26K']).toBe(95); // 100 - 5
  });
});

// ─── adjustReadyStock ─────────────────────────────────────────────────────────

describe('adjustReadyStock', () => {
  it('adds quantity when positive delta (manual correction upward)', () => {
    useStore.getState().adjustReadyStock('WF-26K', 5, 'Correction');
    expect(useStore.getState().readyStock['WF-26K']).toBe(30); // 25 + 5
  });

  it('deducts quantity when negative delta (wastage/loss correction)', () => {
    useStore.getState().adjustReadyStock('WF-26K', -3, 'Damaged');
    expect(useStore.getState().readyStock['WF-26K']).toBe(22); // 25 - 3
  });

  it('does NOT deduct packaging (adjustReadyStock is correction-only)', () => {
    useStore.getState().adjustReadyStock('WF-26K', -10, 'Correction');
    expect(useStore.getState().packagingStock['PKG-WF-26K']).toBe(100); // unchanged
  });

  it('floors at 0 on large negative delta', () => {
    useStore.getState().adjustReadyStock('WF-26K', -1000, 'Huge loss');
    expect(useStore.getState().readyStock['WF-26K']).toBe(0);
  });

  it('creates correct transaction type based on sign', () => {
    useStore.getState().adjustReadyStock('WF-26K', -3, 'Damage');
    const txn = useStore.getState().readyStockTransactions[0];
    expect(txn.type).toBe('DEDUCT');
    expect(txn.quantity).toBe(3);
  });

  it('creates ADD transaction for positive adjustment', () => {
    useStore.getState().adjustReadyStock('WF-26K', 5, 'Recount');
    const txn = useStore.getState().readyStockTransactions[0];
    expect(txn.type).toBe('ADD');
  });
});

// ─── editReadyStockTransaction ────────────────────────────────────────────────

describe('editReadyStockTransaction', () => {
  it('updates the transaction quantity and adjusts current stock accordingly', () => {
    useStore.getState().addReadyStockEntry('WF-26K', 10, 'Batch A', '09/05/2026');
    const txn = useStore.getState().readyStockTransactions[0];
    // ready stock is now 35 (25+10). Edit qty from 10 → 15 (delta +5)
    useStore.getState().editReadyStockTransaction(txn.id, 15, 'Corrected');
    expect(useStore.getState().readyStock['WF-26K']).toBe(40); // 35 + 5
    const updated = useStore.getState().readyStockTransactions[0];
    expect(updated.quantity).toBe(15);
    expect(updated.reason).toBe('Corrected');
  });

  it('does nothing for an unknown transaction id', () => {
    const before = useStore.getState().readyStock['WF-26K'];
    useStore.getState().editReadyStockTransaction('non-existent-id', 99, undefined);
    expect(useStore.getState().readyStock['WF-26K']).toBe(before);
  });
});

// ─── deleteReadyStockTransaction ──────────────────────────────────────────────

describe('deleteReadyStockTransaction', () => {
  it('removes the transaction and reverses its effect on stock (ADD)', () => {
    useStore.getState().addReadyStockEntry('WF-26K', 10, 'Batch A', '09/05/2026');
    // stock = 35
    const txn = useStore.getState().readyStockTransactions[0];
    useStore.getState().deleteReadyStockTransaction(txn.id);
    // ADD of 10 removed → stock should go back down by 10
    expect(useStore.getState().readyStock['WF-26K']).toBe(25);
    expect(useStore.getState().readyStockTransactions).toHaveLength(0);
  });

  it('removes the transaction and reverses its effect on stock (DEDUCT)', () => {
    useStore.getState().adjustReadyStock('WF-26K', -5, 'Loss');
    // stock = 20
    const txn = useStore.getState().readyStockTransactions[0];
    useStore.getState().deleteReadyStockTransaction(txn.id);
    // DEDUCT of 5 removed → stock goes back up by 5
    expect(useStore.getState().readyStock['WF-26K']).toBe(25);
  });

  it('does nothing for an unknown transaction id', () => {
    useStore.getState().deleteReadyStockTransaction('non-existent');
    expect(useStore.getState().readyStock['WF-26K']).toBe(25);
  });
});

// ─── adjustStock (raw / packaging corrections) ────────────────────────────────

describe('adjustStock', () => {
  it('adds to raw material stock with positive qty', () => {
    useStore.getState().adjustStock('raw', 'RM-WF', 500, 'Wheat purchase');
    expect(useStore.getState().rawMaterialStock['RM-WF']).toBe(2500);
  });

  it('deducts from raw material stock with negative qty', () => {
    useStore.getState().adjustStock('raw', 'RM-WF', -200, 'Used in milling');
    expect(useStore.getState().rawMaterialStock['RM-WF']).toBe(1800);
  });

  it('adds to packaging stock', () => {
    useStore.getState().adjustStock('packaging', 'PKG-WF-26K', 50, 'Purchase');
    expect(useStore.getState().packagingStock['PKG-WF-26K']).toBe(150);
  });

  it('floors at 0', () => {
    useStore.getState().adjustStock('raw', 'RM-WF', -99999, 'Huge loss');
    expect(useStore.getState().rawMaterialStock['RM-WF']).toBe(0);
  });

  it('creates a stock transaction record', () => {
    useStore.getState().adjustStock('raw', 'RM-WF', 100, 'Purchase');
    expect(useStore.getState().stockTransactions).toHaveLength(1);
  });
});

// ─── getReadyStockStatus / getStockStatus ─────────────────────────────────────

describe('getReadyStockStatus', () => {
  it('returns "out" when stock is 0', () => {
    useStore.setState({ readyStock: { 'WF-26K': 0 } });
    expect(useStore.getState().getReadyStockStatus('WF-26K')).toBe('out');
  });

  it('returns "adequate" when stock is above reorder level', () => {
    useStore.setState({
      readyStock: { 'WF-26K': 25 },
      reorderLevels: { raw: {}, packaging: {}, ready: { 'WF-26K': 10 } },
    });
    expect(useStore.getState().getReadyStockStatus('WF-26K')).toBe('adequate');
  });

  it('returns "low" when stock is at or below reorder level', () => {
    useStore.setState({
      readyStock: { 'WF-26K': 10 },
      reorderLevels: { raw: {}, packaging: {}, ready: { 'WF-26K': 10 } },
    });
    expect(useStore.getState().getReadyStockStatus('WF-26K')).toBe('low');
  });

  it('returns "adequate" when no reorder level is set and stock > 0', () => {
    useStore.setState({
      readyStock: { 'WF-26K': 5 },
      reorderLevels: { raw: {}, packaging: {}, ready: {} },
    });
    expect(useStore.getState().getReadyStockStatus('WF-26K')).toBe('adequate');
  });
});

describe('getStockStatus (packaging)', () => {
  it('returns "out" when packaging stock is 0', () => {
    useStore.setState({ packagingStock: { 'PKG-WF-26K': 0 } });
    expect(useStore.getState().getStockStatus('packaging', 'PKG-WF-26K')).toBe('out');
  });

  it('returns "low" at reorder level', () => {
    useStore.setState({
      packagingStock: { 'PKG-WF-26K': 20 },
      reorderLevels: { raw: {}, packaging: { 'PKG-WF-26K': 20 }, ready: {} },
    });
    expect(useStore.getState().getStockStatus('packaging', 'PKG-WF-26K')).toBe('low');
  });

  it('returns "adequate" above reorder level', () => {
    useStore.setState({
      packagingStock: { 'PKG-WF-26K': 50 },
      reorderLevels: { raw: {}, packaging: { 'PKG-WF-26K': 20 }, ready: {} },
    });
    expect(useStore.getState().getStockStatus('packaging', 'PKG-WF-26K')).toBe('adequate');
  });
});

// ─── updatePrice ──────────────────────────────────────────────────────────────

describe('updatePrice', () => {
  it('updates price for a given SKU', () => {
    useStore.getState().updatePrice('WF-26K', 800);
    expect(useStore.getState().priceList['WF-26K']).toBe(800);
  });

  it('does not affect other SKU prices', () => {
    const before = useStore.getState().priceList['WF-5P'];
    useStore.getState().updatePrice('WF-26K', 800);
    expect(useStore.getState().priceList['WF-5P']).toBe(before);
  });
});
