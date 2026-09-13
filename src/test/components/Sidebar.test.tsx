/**
 * Sidebar — today's-sales badge
 *
 * Since the "Dashboard - Performance fix" refactor, the badge is no longer
 * derived from the org's entire invoice history sitting in the store — it's
 * a dedicated count-only query (db.countInvoicesForDate), refetched whenever
 * the current page changes. These tests cover that new data-fetching path.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useStore } from '../../store/useStore';
import Sidebar from '../../components/Layout/Sidebar';

const countInvoicesForDate = vi.fn();

vi.mock('../../lib/db', () => ({
  FIXED_ORG_ID: 'test-org-id',
  signOut: vi.fn(),
  countInvoicesForDate: (...args: unknown[]) => countInvoicesForDate(...args),
}));
vi.mock('../../lib/db.demo', () => ({
  FIXED_ORG_ID: 'test-org-id',
  signOut: vi.fn(),
  countInvoicesForDate: vi.fn(),
}));

function baseState() {
  useStore.setState({
    orgId: 'test-org-id',
    currentPage: 'dashboard',
    businessProfile: null,
    currentOrder: null,
    currentProforma: null,
  });
}

beforeEach(() => {
  countInvoicesForDate.mockReset();
  baseState();
});

describe('Sidebar — today\'s sales badge', () => {
  it('does not show a badge before the count resolves', async () => {
    countInvoicesForDate.mockReturnValue(new Promise(() => {})); // never resolves
    render(<Sidebar />);
    const invoicesItem = screen.getByText('Invoices').closest('button')!;
    expect(invoicesItem.textContent).toBe('Invoices');
  });

  it('fetches the count for today via db.countInvoicesForDate and renders it as a badge', async () => {
    countInvoicesForDate.mockResolvedValue(4);
    render(<Sidebar />);

    expect(countInvoicesForDate).toHaveBeenCalledWith('test-org-id', expect.any(String));

    await waitFor(() => {
      const invoicesItem = screen.getByText('Invoices').closest('button')!;
      expect(invoicesItem.textContent).toContain('4');
    });
  });

  it('hides the badge when the count is zero', async () => {
    countInvoicesForDate.mockResolvedValue(0);
    render(<Sidebar />);

    await waitFor(() => expect(countInvoicesForDate).toHaveBeenCalled());
    const invoicesItem = screen.getByText('Invoices').closest('button')!;
    expect(invoicesItem.textContent).toBe('Invoices');
  });

  it('does not query when there is no orgId yet', () => {
    useStore.setState({ orgId: null });
    render(<Sidebar />);
    expect(countInvoicesForDate).not.toHaveBeenCalled();
  });
});
