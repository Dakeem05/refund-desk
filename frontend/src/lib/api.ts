import type {
  CustomerRefundResult,
  DashboardStats,
  DemoScenario,
  Paginated,
  RefundDetail,
  RefundListItem,
  VerifiedOrder,
} from './types';
import { getAdminKey } from './adminKey';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details: string[] = [],
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}, admin = false): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (admin) headers.set('x-admin-key', getAdminKey() ?? '');

  let response: Response;
  try {
    response = await fetch(`/api${path}`, { ...init, headers });
  } catch {
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0);
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    // Nest returns either a string or an array of validation messages
    const raw = body?.message;
    const details = Array.isArray(raw) ? raw : [];
    const message =
      response.status === 429
        ? "You're sending requests a bit fast. Please wait a minute and try again."
        : typeof raw === 'string'
          ? raw
          : (details[0] ?? 'Something went wrong. Please try again.');
    throw new ApiError(message, response.status, details);
  }
  return body as T;
}

const post = (body: unknown, headers?: HeadersInit): RequestInit => ({
  method: 'POST',
  body: JSON.stringify(body),
  headers,
});

export const supportApi = {
  verifyOrder: (email: string, orderNumber: string) =>
    request<VerifiedOrder>('/support/orders/verify', post({ email, orderNumber })),

  submitRefund: (
    payload: { email: string; orderNumber: string; message: string; itemIds?: string[] },
    idempotencyKey: string,
  ) =>
    request<CustomerRefundResult>(
      '/support/refund-requests',
      post(payload, { 'Idempotency-Key': idempotencyKey }),
    ),

  getRequest: (reference: string, email: string) =>
    request<CustomerRefundResult>(
      `/support/refund-requests/${encodeURIComponent(reference)}?email=${encodeURIComponent(email)}`,
    ),

  demoScenarios: () => request<DemoScenario[]>('/support/demo-scenarios'),

  policy: () => request<{ version: string; markdown: string }>('/policy'),
};

export interface ListParams {
  status?: string;
  flagged?: boolean;
  search?: string;
  page?: number;
}

export const adminApi = {
  session: () =>
    request<{ ok: true; ai: { provider: string; model: string } }>('/admin/session', {}, true),

  stats: () => request<DashboardStats>('/admin/stats', {}, true),

  list: (params: ListParams) => {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.flagged) query.set('flagged', 'true');
    if (params.search) query.set('search', params.search);
    query.set('page', String(params.page ?? 1));
    return request<Paginated<RefundListItem>>(`/admin/refund-requests?${query}`, {}, true);
  },

  detail: (id: string) => request<RefundDetail>(`/admin/refund-requests/${id}`, {}, true),

  resolve: (
    id: string,
    body: {
      decision: 'APPROVED' | 'DENIED';
      note: string;
      customerNote?: string;
      reviewer: string;
    },
  ) => request<RefundDetail>(`/admin/refund-requests/${id}/resolve`, post(body), true),
};
