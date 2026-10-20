import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

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
  server.use(http.get(`${BASE}/auth/session`, () => HttpResponse.json(adminSession)));
}

describe('customers list', () => {
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
    expect(yuanhangRow).toHaveTextContent('2');
    expect(within(yuanhangRow!).getByRole('cell', { name: '$150.00' })).toHaveStyle({
      textAlign: 'center',
    });
    expect(within(yuanhangRow!).getByRole('cell', { name: '2' })).toHaveStyle({
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

  it('shows a retry state when the list cannot load', async () => {
    signedIn();
    server.use(http.get(`${BASE}/customers`, () => HttpResponse.error()));
    renderApp({ route: '/customers' });
    expect(await screen.findByText('Couldn’t load this information')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
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
