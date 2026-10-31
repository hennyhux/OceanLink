import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '@/mocks/server';
import { renderApp } from '@/test/renderApp';

const BASE = '/api/v1';

const adminSession = {
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'admin@example.com',
    name: 'Ada Admin',
    role: 'admin',
    is_active: true,
    preferred_language: 'en',
    must_change_password: false,
  },
  session: {
    idle_expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
    absolute_expires_at: new Date(Date.now() + 8 * 3_600_000).toISOString(),
  },
};

function signedIn() {
  server.use(
    http.get(`${BASE}/auth/session`, () => HttpResponse.json(adminSession)),
    http.get(`${BASE}/invoices`, () =>
      HttpResponse.json({ items: [], page: 1, page_size: 100, total: 0 }),
    ),
  );
}

function useMobileLayout() {
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    matches: query.includes('max-width'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
}

describe('customers list', () => {
  it.each(['desktop', 'mobile'])('shows positive balances in red on %s', async (layout) => {
    signedIn();
    if (layout === 'mobile') useMobileLayout();
    renderApp({ route: '/customers' });

    const link = await screen.findByRole('link', { name: '远航货运有限公司' });
    const customer = link.closest(layout === 'mobile' ? 'li' : 'tr')!;
    expect(within(customer).getByText('$150.00').closest('.MuiChip-root')).toHaveClass(
      'MuiChip-colorError',
    );
    const zeroLink = screen.getByRole('link', { name: 'Pacific Haul LLC' });
    const zeroCustomer = zeroLink.closest(layout === 'mobile' ? 'li' : 'tr')!;
    expect(within(zeroCustomer).getByText('$0.00').closest('.MuiChip-root')).toHaveClass(
      'MuiChip-colorDefault',
    );
  });

  it('lists active customers and hides inactive ones by default', async () => {
    signedIn();
    renderApp({ route: '/customers' });

    expect(await screen.findByRole('link', { name: '远航货运有限公司' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pacific Haul LLC' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '金桥物流' })).not.toBeInTheDocument();
    const yuanhangLink = screen.getByRole('link', { name: '远航货运有限公司' });
    const yuanhangRow = yuanhangLink.closest('tr');
    expect(yuanhangRow).not.toBeNull();
    expect(yuanhangRow).toHaveTextContent('$150.00');
    expect(yuanhangRow).toHaveTextContent('Overdue: $50.00');
    expect(within(yuanhangRow!).queryByRole('cell', { name: '2' })).toBeNull();
    expect(screen.queryByRole('columnheader', { name: 'Active trucks' })).not.toBeInTheDocument();
    expect(within(yuanhangRow!).getByRole('cell', { name: /^\$150\.00/ })).toHaveStyle({
      textAlign: 'center',
    });
    expect(within(yuanhangRow!).getByRole('cell', { name: '1234567' })).toHaveStyle({
      textAlign: 'center',
    });
  });

  it('shows each customer’s full contact details in the table', async () => {
    signedIn();
    renderApp({ route: '/customers' });

    await screen.findByRole('link', { name: '远航货运有限公司' });
    // Whole values, not pieces of them.
    expect(screen.getByText('王建国')).toBeInTheDocument();
    expect(screen.getByText('(555) 010-1001')).toBeInTheDocument();
    expect(screen.getByText('dispatch@yuanhang.example')).toBeInTheDocument();
    expect(screen.getByText('Maria Lopez')).toBeInTheDocument();
  });

  it('keeps the mobile customer card compact and wraps long names', async () => {
    signedIn();
    useMobileLayout();
    const longName = 'North American Regional Freight and Logistics Company LLC';
    const longEmail = 'dispatch.operations.north-american-freight@example-logistics.com';
    server.use(
      http.get(`${BASE}/customers`, () =>
        HttpResponse.json({
          items: [
            {
              id: 'c1111111-1111-4111-8111-111111111111',
              version: 1,
              type: 'business',
              display_name: longName,
              contact_name: 'Alex Morgan',
              phone: '(555) 010-2000',
              email: longEmail,
              usdot_number: '7654321',
              address_line1: null,
              address_line2: null,
              city: null,
              state: null,
              postal_code: null,
              notes: null,
              is_active: true,
              created_at: '2026-10-01T00:00:00Z',
              updated_at: '2026-10-01T00:00:00Z',
              net_balance: { amount: 0, currency: 'USD' },
              overdue_balance: { amount: 0, currency: 'USD' },
              truck_count: 2,
            },
          ],
          page: 1,
          page_size: 20,
          total: 1,
        }),
      ),
    );
    renderApp({ route: '/customers', language: 'en' });

    expect(await screen.findByRole('heading', { name: 'Customers' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Add customer' })).toHaveLength(1);
    expect(screen.getByRole('searchbox', { name: 'Search customers' })).toBeInTheDocument();
    expect(await screen.findByText('1 result')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const customerCard = screen.getByRole('link', { name: longName }).closest('li');
    expect(within(customerCard!).getByRole('link', { name: '(555) 010-2000' })).toHaveAttribute(
      'href',
      'tel:(555) 010-2000',
    );
    expect(within(customerCard!).queryByText('Alex Morgan')).not.toBeInTheDocument();
    expect(within(customerCard!).queryByText(longEmail)).not.toBeInTheDocument();
    expect(within(customerCard!).getByText('Outstanding balance:')).toBeInTheDocument();
    expect(within(customerCard!).getByText('$0.00')).toBeInTheDocument();
    expect(within(customerCard!).queryByText('Active trucks:')).not.toBeInTheDocument();
    expect(within(customerCard!).queryByText('2', { exact: true })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Add customer' })).toHaveLength(1);
  });

  it('shows the requested compact Chinese mobile filter and active status labels', async () => {
    signedIn();
    useMobileLayout();
    renderApp({ route: '/customers', language: 'zh-CN' });

    expect(await screen.findByRole('link', { name: '远航货运有限公司' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: '显示停用客户' })).toBeInTheDocument();
    expect(screen.getAllByText('已启用').length).toBeGreaterThan(0);
  });

  it('keeps inactive filtering and empty results available in the mobile layout', async () => {
    signedIn();
    useMobileLayout();
    const user = userEvent.setup();
    renderApp({ route: '/customers', language: 'en' });

    await screen.findByRole('link', { name: 'Pacific Haul LLC' });
    await user.click(screen.getByRole('checkbox', { name: 'Show inactive customers' }));
    expect(await screen.findByRole('link', { name: '金桥物流' })).toBeInTheDocument();

    const search = screen.getByRole('searchbox', { name: 'Search customers' });
    await user.type(search, 'no-such-customer');
    expect(await screen.findByText('No customers match')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Show inactive customers' })).toBeInTheDocument();
  });

  it('shows the selected customer name and active status without a redundant badge', async () => {
    signedIn();
    useMobileLayout();
    const user = userEvent.setup();
    renderApp({ route: '/customers' });

    await user.click(await screen.findByRole('link', { name: '远航货运有限公司' }));

    expect(
      await screen.findByRole('heading', { name: '远航货运有限公司', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Selected customer')).not.toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('shows inactive customers when the box is ticked', async () => {
    signedIn();
    const user = userEvent.setup();
    renderApp({ route: '/customers' });

    await screen.findByRole('link', { name: '远航货运有限公司' });
    await user.click(screen.getByRole('checkbox', { name: 'Show inactive customers' }));
    expect(await screen.findByRole('link', { name: '金桥物流' })).toBeInTheDocument();
  });

  it('searches by Chinese name, English name, and USDOT number', async () => {
    signedIn();
    const user = userEvent.setup();
    renderApp({ route: '/customers' });
    const search = await screen.findByRole('searchbox', { name: 'Search customers' });

    await user.type(search, '李强');
    expect(await screen.findByRole('link', { name: '李强' })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: 'Pacific Haul LLC' })).not.toBeInTheDocument(),
    );

    await user.clear(search);
    await user.type(search, 'pacific');
    expect(await screen.findByRole('link', { name: 'Pacific Haul LLC' })).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, '3456789');
    expect(await screen.findByRole('link', { name: 'Dmitri Volkov' })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: 'Pacific Haul LLC' })).not.toBeInTheDocument(),
    );
  });

  it('shows a no-results state with a hint', async () => {
    signedIn();
    const user = userEvent.setup();
    renderApp({ route: '/customers' });
    const search = await screen.findByRole('searchbox', { name: 'Search customers' });
    await user.type(search, 'zzzz-no-such-customer');
    expect(await screen.findByText('No customers match')).toBeInTheDocument();
  });

  it('filters the customer list to accounts with a confirmed overdue balance', async () => {
    signedIn();
    const user = userEvent.setup();
    renderApp({ route: '/customers', language: 'en' });

    await screen.findByRole('link', { name: '远航货运有限公司' });
    await user.click(screen.getByRole('checkbox', { name: 'Show overdue customers' }));

    expect(await screen.findByText('1 result')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '远航货运有限公司' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Pacific Haul LLC' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '远航货运有限公司' }).closest('tr')).toHaveTextContent(
      'Overdue: $50.00',
    );
  });

  it('shows a retry state when the list cannot load', async () => {
    signedIn();
    server.use(http.get(`${BASE}/customers`, () => HttpResponse.error()));
    renderApp({ route: '/customers' });
    expect(await screen.findByText('Couldn’t load this information')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

describe('customer detail', () => {
  it.each(['desktop', 'mobile'])(
    'paginates all manual charges independently and resets both pages on search on %s',
    async (layout) => {
      signedIn();
      if (layout === 'mobile') useMobileLayout();
      const user = userEvent.setup();
      const customerId = 'c0000001-0000-4000-8000-000000000001';
      const invoiceRequests: URLSearchParams[] = [];
      const paymentRequests: URLSearchParams[] = [];
      const invoices = Array.from({ length: 125 }, (_, index) => ({
        id: `manual-${index + 1}`,
        invoice_number: `INV-${index + 1}`,
        description: `Manual charge ${index + 1}`,
        issued_on: '2026-10-24',
        due_on: '2026-10-24',
        total: { amount: 1000, currency: 'USD' },
      }));
      server.use(
        http.get(`${BASE}/invoices`, ({ request }) => {
          const params = new URL(request.url).searchParams;
          invoiceRequests.push(params);
          const page = Number(params.get('page'));
          const pageSize = Number(params.get('page_size'));
          const matching = params.get('q') ? invoices.slice(0, 1) : invoices;
          return HttpResponse.json({
            items: matching.slice((page - 1) * pageSize, page * pageSize),
            page,
            page_size: pageSize,
            total: matching.length,
          });
        }),
        http.get(`${BASE}/payments`, ({ request }) => {
          const params = new URL(request.url).searchParams;
          paymentRequests.push(params);
          return HttpResponse.json({
            items: [],
            page: Number(params.get('page')),
            page_size: 20,
            total: 40,
          });
        }),
      );
      renderApp({ route: `/customers/${customerId}?page=2`, language: 'en' });

      await screen.findByRole('region', { name: 'One-time adjustments' });
      const charges = () => within(screen.getByRole('region', { name: 'One-time adjustments' }));
      expect(charges().getAllByRole('listitem')).toHaveLength(20);
      expect(charges().getByRole('button', { name: 'Previous page' })).toBeDisabled();
      expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();

      for (let page = 2; page <= 7; page++) {
        await user.click(charges().getByRole('button', { name: 'Next page' }));
        await screen.findByText(`Manual charge ${(page - 1) * 20 + 1}`);
        expect(charges().getByText(`Page ${page} of 7`)).toBeInTheDocument();
      }
      expect(charges().getAllByRole('listitem')).toHaveLength(5);
      expect(charges().getByText('Manual charge 125')).toBeInTheDocument();
      expect(charges().getByRole('button', { name: 'Next page' })).toBeDisabled();
      expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
      expect(paymentRequests.every((params) => params.get('page') === '2')).toBe(true);
      expect(invoiceRequests.map((params) => params.get('page'))).toEqual([
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
      ]);
      expect(
        invoiceRequests.every(
          (params) =>
            params.get('page_size') === '20' &&
            params.get('customer_id') === customerId &&
            params.get('source_type') === 'manual',
        ),
      ).toBe(true);

      await user.click(charges().getByRole('button', { name: 'Previous page' }));
      await screen.findByText('Manual charge 101');
      expect(charges().getByText('Page 6 of 7')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Search and filters' }));
      await user.type(screen.getByRole('textbox', { name: 'Search reference' }), 'INV-1');
      await user.click(screen.getByRole('button', { name: 'Search' }));
      await waitFor(() => {
        expect(invoiceRequests.at(-1)?.get('q')).toBe('INV-1');
        expect(invoiceRequests.at(-1)?.get('page')).toBe('1');
        expect(paymentRequests.at(-1)?.get('q')).toBe('INV-1');
        expect(paymentRequests.at(-1)?.get('page')).toBe('1');
      });
      expect(await screen.findByText('Manual charge 1')).toBeInTheDocument();
      expect(charges().queryByRole('button', { name: 'Next page' })).not.toBeInTheDocument();
      expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    },
  );

  it('renders manual invoices using the API total field', async () => {
    signedIn();
    const customerId = 'c0000001-0000-4000-8000-000000000001';
    server.use(
      http.get(`${BASE}/invoices`, () =>
        HttpResponse.json({
          items: [
            {
              id: 'i0000001-0000-4000-8000-000000000001',
              version: 2,
              invoice_number: 'INV-2026-000001',
              customer_id: customerId,
              customer_snapshot: {},
              status: 'issued',
              issued_on: '2026-10-24',
              due_on: '2026-10-24',
              total: { amount: 5550, currency: 'USD' },
              source_type: 'manual',
              description: 'Gate repair',
              remaining_balance: { amount: 5550, currency: 'USD' },
              lines: [],
            },
          ],
          page: 1,
          page_size: 100,
          total: 1,
        }),
      ),
    );
    renderApp({ route: `/customers/${customerId}`, language: 'en' });

    expect(await screen.findByText('Gate repair')).toBeInTheDocument();
    expect(screen.getByText('$55.50')).toBeInTheDocument();
  });

  it('keeps long identity, account action, contact details, and multiple vehicles readable on mobile', async () => {
    signedIn();
    useMobileLayout();
    const user = userEvent.setup();
    const customerId = 'c0000001-0000-4000-8000-000000000001';
    const longName = 'North American Regional Freight and Logistics Company LLC';
    const email = 'dispatch.operations.north-american-freight@example-logistics.com';
    server.use(
      http.get(`${BASE}/customers/${customerId}`, () =>
        HttpResponse.json({
          id: customerId,
          version: 1,
          type: 'business',
          display_name: longName,
          contact_name: 'Maria Lopez',
          phone: '(555) 010-1001',
          email,
          usdot_number: '1234567',
          address_line1: '100 Harbor Way',
          address_line2: null,
          city: 'Oakland',
          state: 'CA',
          postal_code: '94607',
          notes: null,
          is_active: true,
          created_at: '2026-09-01T12:00:00Z',
          updated_at: '2026-09-01T12:00:00Z',
        }),
      ),
    );
    renderApp({ route: `/customers/${customerId}`, language: 'en' });

    expect(await screen.findByRole('heading', { name: longName, level: 1 })).toBeInTheDocument();
    expect(screen.queryByText('Selected customer')).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Record payment' }));
    const paymentDialog = await screen.findByRole('dialog', { name: 'Record payment' });
    await user.click(within(paymentDialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Maria Lopez')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '(555) 010-1001' })).toHaveAttribute(
      'href',
      'tel:(555) 010-1001',
    );
    expect(screen.queryByRole('link', { name: email })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'More contact details' }));
    expect(await screen.findByRole('link', { name: email })).toBeVisible();

    const headings = screen.getAllByRole('heading').map((heading) => heading.textContent);
    expect(headings.indexOf('Customer account')).toBeLessThan(
      headings.indexOf('Transaction history'),
    );
    expect(headings.indexOf('Transaction history')).toBeLessThan(headings.indexOf('Vehicles'));
    expect(headings.indexOf('Vehicles')).toBeLessThan(headings.indexOf('Contact'));
    expect(screen.getByRole('link', { name: 'Unit 12' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Unit 14' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review monthly charges' })).toBeInTheDocument();
  });

  it('shows empty Chinese transaction history and keeps search/filter controls expandable', async () => {
    signedIn();
    useMobileLayout();
    const user = userEvent.setup();
    const customerId = 'c0000001-0000-4000-8000-000000000002';
    renderApp({ route: `/customers/${customerId}`, language: 'zh-CN' });

    expect(await screen.findByRole('heading', { name: '交易记录' })).toBeInTheDocument();
    expect(await screen.findByText('没有找到符合条件的交易记录。')).toBeInTheDocument();
    expect(screen.getByText('Maria Lopez')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '(555) 010-1002' })).toBeInTheDocument();
    const searchFilters = screen.getByRole('button', { name: '搜索和筛选' });
    expect(searchFilters).toHaveAttribute('aria-expanded', 'false');
    await user.click(searchFilters);
    expect(searchFilters).toHaveAttribute('aria-expanded', 'true');
    await user.type(screen.getByRole('textbox', { name: '搜索收款编号' }), 'NO-MATCH');
    await user.click(screen.getByRole('button', { name: '搜索' }));
    expect(await screen.findByRole('group', { name: '当前筛选条件' })).toBeInTheDocument();
    expect(screen.getByText('搜索收款编号: NO-MATCH')).toBeInTheDocument();
    expect(searchFilters).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('customer create', () => {
  it('requires a name and shows the message next to the field', async () => {
    signedIn();
    const user = userEvent.setup();
    renderApp({ route: '/customers/new' });

    await screen.findByRole('heading', { name: 'Add customer' });
    await user.click(screen.getByRole('button', { name: 'Add customer' }));
    expect(await screen.findByText('Please fill in this field.')).toBeInTheDocument();
  });

  it('validates email and USDOT format on the client, in the chosen language', async () => {
    signedIn();
    const user = userEvent.setup();
    renderApp({ route: '/customers/new', language: 'zh-CN' });

    await screen.findByRole('heading', { name: '添加客户' });
    await user.type(screen.getByLabelText(/公司名称/), '测试公司');
    await user.type(screen.getByLabelText(/邮箱/), 'not-an-email');
    await user.type(screen.getByLabelText(/USDOT 号码/), 'ABC');
    await user.click(screen.getByRole('button', { name: '添加客户' }));

    expect(await screen.findByText('请输入正确的邮箱地址。')).toBeInTheDocument();
    expect(screen.getByText('USDOT 号码应为 1 到 8 位数字。')).toBeInTheDocument();
    expect(screen.getByLabelText(/公司名称/)).toHaveValue('测试公司');
  });

  it('maps unknown server field errors to a generic translated message', async () => {
    signedIn();
    server.use(
      http.post(`${BASE}/customers`, () =>
        HttpResponse.json(
          {
            code: 'VALIDATION_FAILED',
            message: 'invalid',
            field_errors: { city: ['City is not served'] },
          },
          { status: 422 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderApp({ route: '/customers/new' });

    await screen.findByRole('heading', { name: 'Add customer' });
    await user.type(screen.getByLabelText(/Business name/), 'Server Co');
    await user.click(screen.getByRole('button', { name: 'Add customer' }));

    // The collapsed section opens and the field shows a translated message, not raw server text.
    expect(await screen.findByText('Please check this field.')).toBeInTheDocument();
    expect(screen.queryByText('City is not served')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/City/)).toHaveFocus();
  });

  it('creates a customer and lands on the detail page with a confirmation', async () => {
    signedIn();
    const user = userEvent.setup();
    renderApp({ route: '/customers/new' });

    await screen.findByRole('heading', { name: 'Add customer' });
    await user.type(screen.getByLabelText(/Business name/), '新海运输');
    await user.type(screen.getByLabelText(/Contact person/), '张伟');
    await user.type(screen.getByLabelText(/Phone/), '(555) 222-3333');
    await user.type(screen.getByLabelText(/USDOT number/), '7654321');
    await user.click(screen.getByRole('button', { name: 'Add customer' }));

    expect(await screen.findByRole('heading', { name: '新海运输', level: 1 })).toBeInTheDocument();
    expect(await screen.findByText('Customer added.')).toBeInTheDocument();
    expect(screen.getByText('7654321')).toBeInTheDocument();
  });

  it('switches the name label when the type is individual', async () => {
    signedIn();
    const user = userEvent.setup();
    renderApp({ route: '/customers/new' });

    await screen.findByRole('heading', { name: 'Add customer' });
    await user.click(screen.getByRole('radio', { name: 'Individual' }));
    expect(screen.getByLabelText(/Full name/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Contact person/)).not.toBeInTheDocument();
  });

  it('shows a duplicate USDOT error next to the field and keeps entries', async () => {
    signedIn();
    const user = userEvent.setup();
    renderApp({ route: '/customers/new' });

    await screen.findByRole('heading', { name: 'Add customer' });
    await user.type(screen.getByLabelText(/Business name/), 'Dup Co');
    await user.type(screen.getByLabelText(/USDOT number/), '1234567');
    await user.click(screen.getByRole('button', { name: 'Add customer' }));

    expect(
      await screen.findByText('Another active customer already has this USDOT number.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Business name/)).toHaveValue('Dup Co');
    expect(screen.getByLabelText(/USDOT number/)).toHaveFocus();
  });

  it('keeps entries and shows a network message when the save fails', async () => {
    signedIn();
    server.use(http.post(`${BASE}/customers`, () => HttpResponse.error()));
    const user = userEvent.setup();
    renderApp({ route: '/customers/new' });

    await screen.findByRole('heading', { name: 'Add customer' });
    await user.type(screen.getByLabelText(/Business name/), 'Net Fail Co');
    await user.click(screen.getByRole('button', { name: 'Add customer' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t save');
    expect(screen.getByLabelText(/Business name/)).toHaveValue('Net Fail Co');
  });

  it('asks before leaving with unsaved changes', async () => {
    signedIn();
    const user = userEvent.setup();
    renderApp({ route: '/customers/new' });

    await screen.findByRole('heading', { name: 'Add customer' });
    await user.type(screen.getByLabelText(/Business name/), 'Half typed');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    const dialog = await screen.findByRole('dialog', { name: 'Leave this page?' });
    await user.click(within(dialog).getByRole('button', { name: 'Keep editing' }));
    // MUI keeps the page aria-hidden until the dialog finishes closing.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByLabelText(/Business name/)).toHaveValue('Half typed');

    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    const dialog2 = await screen.findByRole('dialog', { name: 'Leave this page?' });
    await user.click(within(dialog2).getByRole('button', { name: 'Leave without saving' }));
    expect(await screen.findByRole('heading', { name: 'Customers', level: 1 })).toBeInTheDocument();
  });
});

describe('customer edit', () => {
  const id = 'c0000001-0000-4000-8000-000000000002';

  it('loads existing values, saves changes, and shows them on the detail page', async () => {
    signedIn();
    const user = userEvent.setup();
    renderApp({ route: `/customers/${id}/edit` });

    const phone = await screen.findByLabelText(/Phone/);
    expect(phone).toHaveValue('(555) 010-1002');
    await user.clear(phone);
    await user.type(phone, '(555) 999-0000');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Changes saved.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '(555) 999-0000' })).toBeInTheDocument();
  });

  it('explains a stale version and offers a reload', async () => {
    signedIn();
    server.use(
      http.patch(`${BASE}/customers/${id}`, () =>
        HttpResponse.json({ code: 'STALE_VERSION', message: 'stale' }, { status: 412 }),
      ),
    );
    const user = userEvent.setup();
    renderApp({ route: `/customers/${id}/edit` });

    const phone = await screen.findByLabelText(/Phone/);
    await user.type(phone, '1');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Someone else changed this record')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });

  it('keeps typed edits when the reload itself fails', async () => {
    signedIn();
    server.use(
      http.patch(`${BASE}/customers/${id}`, () =>
        HttpResponse.json({ code: 'STALE_VERSION', message: 'stale' }, { status: 412 }),
      ),
    );
    const user = userEvent.setup();
    renderApp({ route: `/customers/${id}/edit` });

    const phone = await screen.findByLabelText(/Phone/);
    await user.type(phone, '1');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Someone else changed this record');

    server.use(http.get(`${BASE}/customers/${id}`, () => HttpResponse.error()));
    await user.click(screen.getByRole('button', { name: 'Reload' }));

    // The form stays with what was typed, and a message says the reload did not work.
    expect(await screen.findByText(/Couldn’t load the latest version/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Phone/)).toHaveValue('(555) 010-10021');
  });

  it('shows not found for an unknown customer', async () => {
    signedIn();
    renderApp({ route: '/customers/does-not-exist' });
    expect(await screen.findByText('Customer not found')).toBeInTheDocument();
  });

  it('deactivates after confirmation, confirms it, and can reactivate', async () => {
    signedIn();
    const user = userEvent.setup();
    renderApp({ route: `/customers/${id}` });

    await screen.findByRole('heading', { name: 'Pacific Haul LLC', level: 1 });
    await user.click(screen.getByRole('button', { name: 'Deactivate customer' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }));

    expect(await screen.findByText('Customer deactivated.')).toBeInTheDocument();
    expect(await screen.findByText(/This customer is inactive/)).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Reactivate customer' }));
    expect(await screen.findByText('Customer reactivated.')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Deactivate customer' })).toBeInTheDocument();
  });
});
