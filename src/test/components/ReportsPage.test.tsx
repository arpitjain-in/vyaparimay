/**
 * ReportsPage — scoped, per-tab data fetching
 *
 * Every report tab used to read from store.invoices/paymentReceipts (the
 * org's entire history, always fully loaded). Now each tab fetches its own
 * bounded window on mount via db.loadInvoicesInRange / db.loadPaymentReceiptsInRange
 * (or the dedicated server-side aggregates for Quarterly/Inactivity), and
 * shows a loading spinner until that resolves. These tests cover the
 * fetch-then-render path for the two highest-traffic tabs.
 *
 * DeletePasswordModal is stubbed (see InvoiceHistory.test.tsx for the same
 * rationale) purely to get past the tab's password gate.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { useStore } from '../../store/useStore';
import ReportsPage from '../../components/Reports/ReportsPage';

vi.mock('../../components/Invoices/DeletePasswordModal', () => ({
  default: ({ onConfirm }: { onConfirm: () => void }) => (
    <button onClick={onConfirm}>Confirm</button>
  ),
}));

const loadInvoicesInRange = vi.fn();
const loadPaymentReceiptsInRange = vi.fn();
const getCustomerOutstandingAsOf = vi.fn();
const getCustomerLastActivity = vi.fn();
const getCustomerOutstanding = vi.fn();
const countInvoicesForDate = vi.fn().mockResolvedValue(0);

vi.mock('../../lib/db', () => ({
  FIXED_ORG_ID: 'test-org-id',
  signOut: vi.fn(),
  countInvoicesForDate: (...args: unknown[]) => countInvoicesForDate(...args),
  loadInvoicesInRange: (...args: unknown[]) => loadInvoicesInRange(...args),
  loadPaymentReceiptsInRange: (...args: unknown[]) => loadPaymentReceiptsInRange(...args),
  getCustomerOutstandingAsOf: (...args: unknown[]) => getCustomerOutstandingAsOf(...args),
  getCustomerLastActivity: (...args: unknown[]) => getCustomerLastActivity(...args),
  getCustomerOutstanding: (...args: unknown[]) => getCustomerOutstanding(...args),
}));
vi.mock('../../lib/db.demo', () => ({
  FIXED_ORG_ID: 'test-org-id',
  signOut: vi.fn(),
  countInvoicesForDate: vi.fn().mockResolvedValue(0),
}));

function baseState() {
  useStore.setState({
    orgId: 'test-org-id',
    currentPage: 'reports',
    businessProfile: { name: 'Shikharji Foods' } as never,
    currentOrder: null,
    currentProforma: null,
    readyStock: {},
    packagingStock: {},
    packagingEntries: [],
    customers: [],
    expenses: [],
    salaryRecords: [],
  });
}

async function unlock() {
  render(<ReportsPage />);
  fireEvent.click(screen.getByText('Confirm'));
  await waitFor(() => expect(screen.getByText('Sales & Stock')).toBeInTheDocument());
}

beforeEach(() => {
  loadInvoicesInRange.mockReset().mockResolvedValue([]);
  loadPaymentReceiptsInRange.mockReset().mockResolvedValue([]);
  getCustomerOutstandingAsOf.mockReset().mockResolvedValue({});
  getCustomerLastActivity.mockReset().mockResolvedValue({});
  getCustomerOutstanding.mockReset().mockResolvedValue({});
  countInvoicesForDate.mockClear();
  baseState();
});

describe('ReportsPage — Overview tab (SalesSummaryTable)', () => {
  it('fetches a bounded window (not the whole history) and renders once loaded', async () => {
    await unlock();

    expect(loadInvoicesInRange).toHaveBeenCalledWith('test-org-id', expect.any(String), expect.any(String));
    expect(loadPaymentReceiptsInRange).toHaveBeenCalledWith('test-org-id', expect.any(String), expect.any(String));

    await waitFor(() => expect(screen.getByText('Today')).toBeInTheDocument());
  });
});

describe('ReportsPage — Quarterly Financial tab', () => {
  it('fetches the as-of-quarter-end outstanding aggregate instead of scanning full history', async () => {
    await unlock();
    fireEvent.click(screen.getByText('Quarterly Financial'));

    await waitFor(() => expect(getCustomerOutstandingAsOf).toHaveBeenCalledWith('test-org-id', expect.any(String)));
    expect(loadInvoicesInRange).toHaveBeenCalled();
    expect(loadPaymentReceiptsInRange).toHaveBeenCalled();
  });
});
