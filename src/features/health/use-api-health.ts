import { useQuery } from '@tanstack/react-query';

import { api, type components } from '@/api/client';

export type HealthReport = components['schemas']['HealthReportDto'];

export function useApiHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: async (): Promise<HealthReport> => {
      const { data, error, response } = await api.GET('/api/v1/health');
      if (data) return data;
      // A 503 still carries the report (it says which dependency is down).
      if (error && 'checks' in error) return error;
      throw new Error(error?.error.message ?? `Health check failed (${response.status})`);
    },
    refetchInterval: 15_000,
  });
}
