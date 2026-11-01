import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderApp, signIn, useViewport } from '@/test/renderApp';

describe('sign in', () => {
  it('sends a signed-out visitor to sign in, then back to the page they wanted', async () => {
    const user = userEvent.setup();
    const { router } = renderApp({ route: '/customers?q=pac' });

    await screen.findByRole('heading', { name: 'Sign in', level: 1 });
    expect(router.state.location.search).toContain('returnTo=%2Fcustomers%3Fq%3Dpac');
    await user.type(screen.getByLabelText(/^Email/), 'admin@example.com');
    await user.type(screen.getByLabelText(/^Password/), 'admin-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { name: 'Customers', level: 1 })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?q=pac');
  });

  it('explains a wrong password and an inactive account without leaving the page', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/login' });
    await screen.findByRole('heading', { name: 'Sign in', level: 1 });

    await user.type(screen.getByLabelText(/^Email/), 'admin@example.com');
    await user.type(screen.getByLabelText(/^Password/), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Email or password is incorrect.')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password/)).toHaveValue('');

    await user.clear(screen.getByLabelText(/^Email/));
    await user.type(screen.getByLabelText(/^Email/), 'inactive@example.com');
    await user.type(screen.getByLabelText(/^Password/), 'inactive-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(
      await screen.findByText('This account is turned off. Ask an admin.'),
    ).toBeInTheDocument();
  });

  it('signs out and drops cached business data', async () => {
    await signIn();
    const user = userEvent.setup();
    const { queryClient } = renderApp({ route: '/customers' });
    await screen.findByRole('link', { name: 'Pacific Haul LLC' });

    await user.click(screen.getByRole('button', { name: /Account menu for Ada Admin/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }));
    expect(await screen.findByRole('heading', { name: 'Sign in', level: 1 })).toBeInTheDocument();
    expect(queryClient.getQueryCache().findAll({ queryKey: ['customers'] })).toHaveLength(0);
  });
});

describe('app shell', () => {
  it('marks the current page in the sidebar and shows where you are', async () => {
    await signIn();
    renderApp({ route: '/vehicles' });
    await screen.findByRole('heading', { name: 'Vehicles', level: 1 });

    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Vehicles' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Customers' })).not.toHaveAttribute(
      'aria-current',
    );
    const crumbs = screen.getByRole('navigation', { name: 'You are here' });
    expect(await within(crumbs).findByText('Vehicles')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main',
    );
  });

  it('shows Settings to admins only, and blocks staff who type the address', async () => {
    await signIn('operator');
    renderApp({ route: '/settings' });
    expect(
      await screen.findByRole('heading', { name: 'You do not have access to this page' }),
    ).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument();
  });

  it('switches the whole interface to Chinese', async () => {
    await signIn();
    const user = userEvent.setup();
    renderApp({ route: '/' });
    await screen.findByRole('heading', { name: 'Overview', level: 1 });

    await user.click(screen.getByRole('button', { name: '中文' }));
    expect(await screen.findByRole('heading', { name: '概览', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: '主菜单' })).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: '需要处理' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('zh-CN');
  });

  it('uses a drawer and a floating add button on narrow screens', async () => {
    await signIn();
    useViewport(600);
    const user = userEvent.setup();
    renderApp({ route: '/customers' });
    await screen.findByRole('heading', { name: 'Customers', level: 1 });

    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
    // The add action is a round button with a name, not a labeled header button.
    expect(await screen.findByRole('link', { name: 'Add customer' })).toHaveClass('MuiFab-root');
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(await screen.findByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });

  it('shows a back link instead of breadcrumbs on a phone', async () => {
    await signIn();
    useViewport(390);
    renderApp({ route: '/customers/c0000001-0000-4000-8000-000000000002' });
    await screen.findByRole('heading', { name: 'Pacific Haul LLC', level: 1 });
    const back = await screen.findByRole('link', { name: 'Customers' });
    expect(back).toHaveAttribute('href', '/customers');
    expect(screen.queryByRole('navigation', { name: 'You are here' })).not.toBeInTheDocument();
  });

  it('keeps old bookmarks working and shows a friendly not-found page', async () => {
    await signIn();
    const { router } = renderApp({ route: '/vehicles/v0000001-0000-4000-8000-000000000002/edit' });
    expect(await screen.findByRole('heading', { name: 'Unit 14', level: 1 })).toBeInTheDocument();
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/vehicles/v0000001-0000-4000-8000-000000000002'),
    );

    await router.navigate('/nothing-here');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('shows honest placeholders for pages without a backend yet', async () => {
    await signIn();
    renderApp({ route: '/invoices' });
    expect(await screen.findByText(/This page is not available yet\./)).toBeInTheDocument();
  });
});
