/**
 * InvoiceView — fetch-by-id behavior
 *
 * Regular invoices are no longer kept fully loaded in the store — InvoiceView
 * now fetches the single invoice it needs by id (db.getInvoiceById), while a
 * proforma invoice (still fully loaded via store.proformaInvoices) should
 * render immediately without hitting the network at all.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useStore } from '../../store/useStore';
import InvoiceView from '../../components/Invoices/InvoiceView';

const getInvoiceById = vi.fn();
const countInvoicesForDate = vi.fn().mockResolvedValue(0);

vi.mock('../../lib/db', () => ({
  FIXED_ORG_ID: 'test-org-id',
  signOut: vi.fn(),
  countInvoicesForDate: (...args: unknown[]) => countInvoicesForDate(...args),
  getInvoiceById: (...args: unknown[]) => getInvoiceById(...args),
  saveInvoice: vi.fn().mockResolvedValue(undefined),
  saveProformaInvoice: vi.fn().mockResolvedValue(undefined),
  savePackagingEntry: vi.fn().mockResolvedValue(undefined),
  saveReadyStockTransaction: vi.fn().mockResolvedValue(undefined),
  cancelInvoiceInDb: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../lib/db.demo', () => ({
  FIXED_ORG_ID: 'test-org-id',
  signOut: vi.fn(),
  countInvoicesForDate: vi.fn().mockResolvedValue(0),
  getInvoiceById: vi.fn(),
  saveInvoice: vi.fn().mockResolvedValue(undefined),
  saveProformaInvoice: vi.fn().mockResolvedValue(undefined),
}));

const RAJASTHAN_CUSTOMER = {
  id: 'CUST-001', name: 'Ramesh Kumar', firmName: 'Ramesh Store',
  mobile: '9876543210', address1: '5 Gandhi Mkt', city: 'Jaipur',
  state: 'Rajasthan', pinCode: '302001', customerType: 'Retailer' as const,
  creditLimit: 50000, paymentTerms: '30 Days', openingBalance: 0,
  createdOn: '01/01/2026', active: true,
};

function baseState() {
  useStore.setState({
    orgId: 'test-org-id',
    currentPage: 'invoice-view',
    customers: [RAJASTHAN_CUSTOMER],
    currentOrder: null,
    currentProforma: null,
    proformaInvoices: [],
    selectedInvoiceId: null,
    businessProfile: {
      name: 'Shikharji Foods', address1: '1 Test St', city: 'Jaipur',
      state: 'Rajasthan', pinCode: '302001', gstin: '08AAAAA0000A1Z5',
      fssai: '', mobile: '9999999999', gstEnabled: true,
    },
  });
}

/** Build a real, fully-shaped invoice via the store's own logic (same
 * approach as the store tests) rather than hand-rolling one that might
 * drift from the Invoice type. */
function buildInvoice(kind: 'invoice' | 'proforma') {
  useStore.getState().startNewOrder();
  useStore.getState().setOrderCustomer('CUST-001');
  useStore.getState().setOrderGst(true);
  useStore.getState().upsertCartItem('WF-26K', 1, 780);
  const inv = kind === 'proforma'
    ? useStore.getState().generateProformaInvoice('2026-05-09')
    : useStore.getState().generateInvoice('2026-05-09');
  return inv!;
}

beforeEach(() => {
  getInvoiceById.mockReset();
  countInvoicesForDate.mockClear();
  baseState();
  useStore.setState({
    readyStock: { 'WF-26K': 25 },
    packagingStock: { 'PKG-WF-26K': 100 },
    invoiceCounters: {},
    proformaCounters: {},
    invoices: [],
    proformaInvoices: [],
  });
});

describe('InvoiceView — regular invoice', () => {
  it('shows a loading state, then fetches the invoice by id', async () => {
    const inv = buildInvoice('invoice');
    getInvoiceById.mockResolvedValue(inv);
    useStore.setState({ selectedInvoiceId: inv.id });

    render(<InvoiceView />);
    expect(screen.getByText(/Loading invoice/i)).toBeInTheDocument();

    expect(getInvoiceById).toHaveBeenCalledWith('test-org-id', inv.id);
    await waitFor(() => expect(screen.getByText(inv.invoiceNo)).toBeInTheDocument());
  });

  it('shows "Invoice not found" when the fetch resolves to null', async () => {
    getInvoiceById.mockResolvedValue(null);
    useStore.setState({ selectedInvoiceId: 'nonexistent-id' });

    render(<InvoiceView />);
    await waitFor(() => expect(screen.getByText(/Invoice not found/i)).toBeInTheDocument());
  });
});

describe('InvoiceView — proforma invoice', () => {
  it('renders immediately from store.proformaInvoices without fetching', async () => {
    const proforma = buildInvoice('proforma');
    useStore.setState({ proformaInvoices: [proforma], selectedInvoiceId: proforma.id });

    render(<InvoiceView />);

    await waitFor(() => expect(screen.getByText(proforma.invoiceNo)).toBeInTheDocument());
    expect(getInvoiceById).not.toHaveBeenCalled();
  });
});
