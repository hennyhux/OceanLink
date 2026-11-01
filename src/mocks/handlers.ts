import type { HttpHandler } from 'msw';

import { authHandlers } from './handlers/auth';
import { billingHandlers } from './handlers/billing';
import { customerHandlers } from './handlers/customers';
import { paymentHandlers } from './handlers/payments';
import { vehicleHandlers } from './handlers/vehicles';

export const handlers: HttpHandler[] = [
  ...authHandlers,
  ...customerHandlers,
  ...vehicleHandlers,
  ...billingHandlers,
  ...paymentHandlers,
];
