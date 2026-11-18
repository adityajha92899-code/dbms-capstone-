import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export function useVehicles(params = {}) {
  return useQuery({
    queryKey: ['vehicles', params],
    queryFn: async () => {
      const { data } = await api.get('/api/v1/vehicles', { params });
      return data;
    },
  });
}

export function useCreateVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post('/api/v1/vehicles', payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vehicles'] }),
  });
}
