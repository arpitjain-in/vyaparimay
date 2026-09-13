/**
 * CustomerList — the "Total Dues / Received / Outstanding" summary cards
 * were removed (they depended on store.invoices/paymentReceipts holding the
 * org's entire history, which no longer happens). This is a regression
 * check that the page still renders correctly without them and without
 * depending on that store data at all.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useStore } from '../../store/useStore';
import CustomerList from '../../components/Customers/CustomerList';

const loadCustomersPaginated = vi.fn();
const countInvoicesForDate = vi.fn().mockResolvedValue(0);

vi.mock('../../lib/db', () => ({
  FIXED_ORG_ID: 'test-org-id',
  signOut: vi.fn(),
  countInvoicesForDate: (...args: unknown[]) => countInvoicesForDate(...args),
  loadCustomersPaginated: (...args: unknown[]) => loadCustomersPaginated(...args),
}));
vi.mock('../../lib/db.demo', () => ({
  FIXED_ORG_ID: 'test-org-id',
  signOut: vi.fn(),
  countInvoicesForDate: vi.fn().mockResolvedValue(0),
}));

const CUSTOMER = {
  id: 'CUST-001', name: 'Ramesh Kumar', firmName: 'Ramesh Store',
  mobile: '9876543210', address1: '5 Gandhi Mkt', city: 'Jaipur',
  state: 'Rajasthan', pinCode: '302001', customerType: 'Retailer' as const,
  creditLimit: 50000, paymentTerms: '30 Days', openingBalance: 5000,
  createdOn: '01/01/2026', active: true,
};

function baseState() {
  useStore.setState({
    orgId: 'test-org-id',
    currentPage: 'customer-list',
    businessProfile: null,
    currentOrder: null,
    currentProforma: null,
    // Deliberately NOT populated — the page must not depend on these for
    // anything any more (invoices/paymentReceipts aren't eagerly loaded).
    invoices: [],
    paymentReceipts: [],
    customers: [],
  });
}

beforeEach(() => {
  loadCustomersPaginated.mockReset();
  countInvoicesForDate.mockClear();
  baseState();
});

describe('CustomerList', () => {
  it('renders the customer table from its own paginated fetch', async () => {
    loadCustomersPaginated.mockResolvedValue({ customers: [CUSTOMER], totalCount: 1 });

    render(<CustomerList />);
    await waitFor(() => expect(screen.getByText('Ramesh Kumar')).toBeInTheDocument());
    expect(loadCustomersPaginated).toHaveBeenCalledWith('test-org-id', 1, 25, '', false);
  });

  it('no longer renders the removed Total Dues / Received / Outstanding summary cards', async () => {
    loadCustomersPaginated.mockResolvedValue({ customers: [CUSTOMER], totalCount: 1 });

    render(<CustomerList />);
    await waitFor(() => expect(screen.getByText('Ramesh Kumar')).toBeInTheDocument());

    expect(screen.queryByText(/Total Dues/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Total Received/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Total Outstanding/i)).not.toBeInTheDocument();
  });
});
