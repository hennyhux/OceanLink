import { createContext, useContext } from 'react';

export interface ToastApi {
  // For confirmed successes only. Errors stay on the page.
  success: (message: string) => void;
}

export const ToastContext = createContext<ToastApi>({ success: () => undefined });

export function useToast(): ToastApi {
  return useContext(ToastContext);
}
