import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { paymentsApi } from '@/features/payments/api';
import { CUSTOMER_IDS, db, today } from '@/mocks/db';
import { server } from '@/mocks/server';
import { renderApp, signIn, useViewport } from '@/test/renderApp';

const region = () => screen.getByRole('region', { name: 'Search across OceanLink' });
const input = () => within(region()).getByRole('searchbox', { name: 'Search across OceanLink' });
const group = (name: RegExp) => within(region()).getByRole('region', { name });

describe('dashboard global search', () => {
  it('searches all three APIs after typing stops, keeps the query in the URL, and opens a receipt', async () => {
    await signIn();
    await paymentsApi.record(
      {
        customer_id: CUSTOMER_IDS.pacific,
        amount: { amount: 12500, currency: 'USD' },
        effective_on: today(),
        method: 'cash',
        reference: 'PACIFIC-125',
        notes: null,
      },
      'search-payment',
    );
    const requests: string[] = [];
    server.use(
      ...['customers', 'vehicles', 'payments'].map((path) =>
        http.get(`/api/v1/${path}`, ({ request }) => {
          const q = new URL(request.url).searchParams.get('q');
          if (q) requests.push(`${path}:${q}`);
          return undefined;
        }),
      ),
    );
    const user = userEvent.setup();
    const { router } = renderApp({ route: '/' });
    await screen.findByRole('heading', { name: 'Overview' });
    expect(screen.getByRole('region', { name: 'Needs attention' })).toBeInTheDocument();
    expect(requests).toEqual([]);
    await user.type(input(), 'Pacific');
    expect(requests).toEqual([]);
    const search = region();
    const customer = await within(search).findByRole('link', { name: 'Pacific Haul LLC' });
    expect(customer).toHaveAttribute('href', `/customers/${CUSTOMER_IDS.pacific}`);
    expect(within(search).getByRole('link', { name: 'Unit 7' })).toHaveAttribute(
      'href',
      '/vehicles/v0000001-0000-4000-8000-000000000004',
    );
    const receipt = await within(search).findByRole('button', {
      name: 'View receipt: Pacific Haul LLC, $125.00',
    });
    expect(requests.sort()).toEqual(['customers:Pacific', 'payments:Pacific', 'vehicles:Pacific']);
    expect(router.state.location.search).toBe('?q=Pacific');
    // The dashboard steps aside while results are showing.
    expect(screen.queryByRole('region', { name: 'Needs attention' })).not.toBeInTheDocument();
    expect(await within(search).findByText('4 matches for "Pacific"')).toBeInTheDocument();
    // One of one needs no link to the full list.
    expect(within(search).queryByRole('link', { name: /Show all/ })).not.toBeInTheDocument();
    await user.click(receipt);
    const dialog = await screen.findByRole('dialog', { name: 'Payment receipt' });
    expect(await within(dialog).findByText('PACIFIC-125')).toBeInTheDocument();
  });

  it('finds payment references and inactive customers and vehicles', async () => {
    await signIn();
    const user = userEvent.setup();
    renderApp({ route: '/?q=WIRE-1001' });
    await screen.findByRole('region', { name: 'Search across OceanLink' });
    const receipt = await within(region()).findByRole('button', {
      name: 'View receipt: 远航货运有限公司, $300.00',
    });
    expect(receipt).toHaveTextContent('WIRE-1001');
    expect(receipt).toHaveTextContent('$300.00');
    await user.clear(input());
    await user.type(input(), 'OLD 1234');
    const vehicle = await within(region()).findByRole('link', { name: 'OLD 1234' });
    expect(vehicle).toHaveAttribute('href', '/vehicles/v0000001-0000-4000-8000-000000000006');
    expect(vehicle).toHaveTextContent('Inactive');
    await user.clear(input());
    await user.type(input(), '金桥');
    const customer = await within(region()).findByRole('link', { name: '金桥物流' });
    expect(customer).toHaveTextContent('Inactive');
  });

  it('limits each group to five results with the true total and navigates to the full filtered list', async () => {
    await signIn();
    const template = db.customers[0]!;
    for (let index = 0; index < 7; index += 1) {
      db.customers.push({
        ...template,
        id: `search-${index}`,
        display_name: `Search fleet ${index}`,
        usdot_number: null,
      });
    }
    const user = userEvent.setup();
    const { router } = renderApp({ route: '/?q=Search%20fleet' });
    await screen.findByRole('region', { name: 'Search across OceanLink' });
    const customers = await within(region()).findByRole('region', { name: 'Customers (7)' });
    expect(within(customers).getAllByRole('listitem')).toHaveLength(5);
    await user.click(
      within(customers).getByRole('link', { name: 'Show all 7 matches in Customers' }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe('/customers'));
    expect(router.state.location.search).toBe('?q=Search+fleet&inactive=1');
  });

  it('only shows groups with matches and lets the filter buttons narrow to one group', async () => {
    await signIn();
    const user = userEvent.setup();
    const { router } = renderApp({ route: '/?q=Pacific' });
    await screen.findByRole('region', { name: 'Search across OceanLink' });
    await within(region()).findByRole('region', { name: 'Customers (1)' });
    expect(within(region()).getByRole('region', { name: 'Vehicles (2)' })).toBeInTheDocument();
    expect(within(region()).queryByRole('region', { name: /Payments/ })).not.toBeInTheDocument();
    const filters = within(region()).getByRole('group', { name: 'Narrow results to' });
    expect(within(filters).getByRole('button', { name: 'Payments (0)' })).toBeDisabled();
    expect(within(filters).getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(within(filters).getByRole('button', { name: 'Vehicles (2)' }));
    expect(router.state.location.search).toBe('?q=Pacific&in=vehicles');
    expect(within(region()).queryByRole('region', { name: /Customers/ })).not.toBeInTheDocument();
    expect(within(region()).getByRole('region', { name: 'Vehicles (2)' })).toBeInTheDocument();
    await user.click(within(filters).getByRole('button', { name: 'All' }));
    expect(router.state.location.search).toBe('?q=Pacific');
    expect(await within(region()).findByRole('region', { name: 'Customers (1)' })).toBeVisible();
  });

  it('shows one empty state with a way to add the customer, and clearing brings the dashboard back', async () => {
    await signIn();
    const user = userEvent.setup();
    const { router } = renderApp({ route: '/?q=no-such-record' });
    await screen.findByRole('region', { name: 'Search across OceanLink' });
    expect(
      await within(region()).findByText('No matches for "no-such-record"'),
    ).toBeInTheDocument();
    expect(within(region()).getByRole('link', { name: 'Add customer' })).toHaveAttribute(
      'href',
      '/customers/new',
    );
    expect(within(region()).queryByRole('group', { name: 'Narrow results to' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Needs attention' })).not.toBeInTheDocument();
    await user.click(within(region()).getByRole('button', { name: 'Back to dashboard' }));
    expect(input()).toHaveValue('');
    expect(router.state.location.search).toBe('');
    expect(await screen.findByRole('region', { name: 'Needs attention' })).toBeInTheDocument();
    expect(within(region()).queryByText(/No matches/)).not.toBeInTheDocument();
  });

  it('searches right away on Enter, clears on Escape, and focuses the box with "/"', async () => {
    await signIn();
    const user = userEvent.setup();
    const { router } = renderApp({ route: '/' });
    await screen.findByRole('heading', { name: 'Overview' });
    await user.keyboard('/');
    expect(input()).toHaveFocus();
    await user.keyboard('Pacific{Enter}');
    expect(router.state.location.search).toBe('?q=Pacific');
    expect(await within(region()).findByRole('link', { name: 'Pacific Haul LLC' })).toBeVisible();
    await user.keyboard('{Escape}');
    expect(input()).toHaveValue('');
    expect(router.state.location.search).toBe('');
    // Typing "/" inside the box must not be hijacked.
    await user.keyboard('a/b');
    expect(input()).toHaveValue('a/b');
  });

  it('keeps successful groups visible when one API fails and retries that group', async () => {
    await signIn();
    let failed = true;
    server.use(
      http.get('/api/v1/customers', ({ request }) => {
        if (new URL(request.url).searchParams.get('q') && failed) {
          return HttpResponse.json(
            { code: 'INTERNAL_ERROR', message: 'Search failed', request_id: 'search-problem' },
            { status: 500 },
          );
        }
        return undefined;
      }),
    );
    const user = userEvent.setup();
    renderApp({ route: '/?q=Pacific' });
    await screen.findByRole('region', { name: 'Search across OceanLink' });
    expect(await within(region()).findByText('Could not search Customers')).toBeInTheDocument();
    expect(within(region()).getByText('Problem number: search-problem')).toBeInTheDocument();
    expect(within(region()).getByText('Some results could not be loaded.')).toBeInTheDocument();
    expect(await within(region()).findByRole('link', { name: 'Unit 7' })).toBeInTheDocument();
    failed = false;
    await user.click(within(group(/^Customers/)).getByRole('button', { name: 'Try again' }));
    expect(
      await within(region()).findByRole('link', { name: 'Pacific Haul LLC' }),
    ).toBeInTheDocument();
    expect(within(region()).queryByText('Some results could not be loaded.')).toBeNull();
  });

  it('works in Chinese on a narrow screen and links a result to its customer', async () => {
    await signIn();
    useViewport(390);
    const user = userEvent.setup();
    const { router } = renderApp({ route: '/?q=金桥', language: 'zh-CN' });
    const search = await screen.findByRole('region', { name: '搜索 OceanLink' });
    expect(await within(search).findByText('“金桥”共有 2 条匹配记录')).toBeInTheDocument();
    const customer = within(search).getByRole('link', { name: '金桥物流' });
    expect(customer).toHaveTextContent('已停用');
    await user.click(customer);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/customers/${CUSTOMER_IDS.jinqiao}`),
    );
  });
});
