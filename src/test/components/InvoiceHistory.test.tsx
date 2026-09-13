/**
 * InvoiceHistory — total-revenue reveal and cancel-by-object behavior
 *
 * Two behavior changes from the eager-loading refactor:
 *  - "Total Revenue" is no longer derived from store.invoices (not eagerly
 *    loaded any more) — it's fetched on demand via db.getInvoiceTotalRevenue
 *    once the password gate is passed.
 *  - cancelInvoice() now takes the full invoice object (looked up in the
 *    current page's `rows`), not just an id, since the store no longer holds
 *    the org's whole invoice history to look it up in.
 *
 * DeletePasswordModal is stubbed out here since its own password logic is
 * unchanged and unrelated to this refactor — the stub exposes a single
 * "Confirm" button wired straight to onConfirm.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { useStore } from '../../store/useStore';
import InvoiceHistory from '../../components/Invoices/InvoiceHistory';

vi.mock('../../components/Invoices/DeletePasswordModal', () => ({
  default: ({ onConfirm, onCancel, title }: { onConfirm: () => void; onCancel: () => void; title?: string }) => (
    <div>
      <span>{title ?? 'Cancel Invoice'}</span>
      <button onClick={onConfirm}>Confirm</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

const loadInvoicesPage = vi.fn();
const loadProformaInvoicesPage = vi.fn();
const getInvoiceTotalRevenue = vi.fn();
const countInvoicesForDate = vi.fn().mockResolvedValue(0);

vi.mock('../../lib/db', () => ({
  FIXED_ORG_ID: 'test-org-id',
  signOut: vi.fn(),
  countInvoicesForDate: (...args: unknown[]) => countInvoicesForDate(...args),
  loadInvoicesPage: (...args: unknown[]) => loadInvoicesPage(...args),
  loadProformaInvoicesPage: (...args: unknown[]) => loadProformaInvoicesPage(...args),
  getInvoiceTotalRevenue: (...args: unknown[]) => getInvoiceTotalRevenue(...args),
  cancelInvoiceInDb: vi.fn().mockResolvedValue(undefined),
  updateInvoicePaymentModeInDb: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../lib/db.demo', () => ({
  FIXED_ORG_ID: 'test-org-id',
  signOut: vi.fn(),
  countInvoicesForDate: vi.fn().mockResolvedValue(0),
  loadInvoicesPage: vi.fn(),
  loadProformaInvoicesPage: vi.fn(),
  getInvoiceTotalRevenue: vi.fn(),
}));

const CUSTOMER_SNAPSHOT = {
  name: 'Ramesh Kumar', firmName: 'Ramesh Store', mobile: '9876543210',
  address1: '5 Gandhi Mkt', city: 'Jaipur', state: 'Rajasthan', pinCode: '302001',
};

function makeInvoice(id: string, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id,
    invoiceNo: `INV/2627/05/0${id}`,
    docType: 'invoice',
    orgId: 'test-org-id',
    customerId: 'CUST-001',
    customerSnapshot: CUSTOMER_SNAPSHOT,
    invoiceDate: '09/05/2026',
    invoiceTime: '10:00:00',
    items: [],
    subtotal: 1000,
    cgstTotal: 25, sgstTotal: 25, igstTotal: 0, totalGST: 50,
    discountAmount: 0, transportCharges: 0, loadingCharges: 0,
    roundOff: 0, grandTotal: 1050, amountInWords: 'One Thousand Fifty Rupees Only',
    isInterState: false, paymentMode: 'Cash', cancelled: false,
    ...overrides,
  };
}

function baseState() {
  useStore.setState({
    orgId: 'test-org-id',
    currentPage: 'invoice-history',
    customers: [],
    currentOrder: null,
    currentProforma: null,
    businessProfile: null,
    invoices: [],
  });
}

beforeEach(() => {
  loadInvoicesPage.mockReset();
  loadProformaInvoicesPage.mockReset();
  getInvoiceTotalRevenue.mockReset();
  countInvoicesForDate.mockClear();
  baseState();
});

describe('InvoiceHistory — total revenue', () => {
  it('shows a spinner then the fetched total after the password gate is passed', async () => {
    const inv = makeInvoice('1');
    loadInvoicesPage.mockResolvedValue({ invoices: [inv], totalCount: 1 });
    getInvoiceTotalRevenue.mockResolvedValue(543210);

    render(<InvoiceHistory />);
    await waitFor(() => expect(screen.getByText(inv.invoiceNo)).toBeInTheDocument());

    // Password gate: click the locked "••••••" reveal button, then confirm.
    fireEvent.click(screen.getByTitle('Show total revenue'));
    fireEvent.click(screen.getByText('Confirm'));

    expect(getInvoiceTotalRevenue).toHaveBeenCalledWith('test-org-id');
    await waitFor(() => expect(screen.getByText('₹5,43,210')).toBeInTheDocument());
  });
});

describe('InvoiceHistory — cancel invoice', () => {
  it('passes the full invoice object (from the current page) to cancelInvoice, not just its id', async () => {
    const inv = makeInvoice('1');
    loadInvoicesPage.mockResolvedValue({ invoices: [inv], totalCount: 1 });
    const cancelInvoice = vi.fn();
    useStore.setState({ cancelInvoice });

    render(<InvoiceHistory />);
    await waitFor(() => expect(screen.getByText(inv.invoiceNo)).toBeInTheDocument());

    fireEvent.click(screen.getByTitle('Cancel'));
    fireEvent.click(screen.getByText('Confirm'));

    expect(cancelInvoice).toHaveBeenCalledTimes(1);
    expect(cancelInvoice).toHaveBeenCalledWith(expect.objectContaining({ id: inv.id, invoiceNo: inv.invoiceNo }));

    // The cancelled row is removed from view immediately (optimistic update),
    // without waiting on a fresh loadInvoicesPage round-trip.
    await waitFor(() => expect(screen.queryByText(inv.invoiceNo)).not.toBeInTheDocument());
  });
});
