import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export function useTrips(params = {}) {
  return useQuery({
    queryKey: ['trips', params],
    queryFn: async () => {
      const { data } = await api.get('/api/v1/trips', { params });
      return data;
    },
  });
}

export function useTrip(id) {
  return useQuery({
    queryKey: ['trips', id],
    queryFn: async () => {
      const { data } = await api.get(`/api/v1/trips/${id}`);
      return data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post('/api/v1/trips', payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trips'] }),
  });
}

export function useUpdateTripStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }) => {
      const { data } = await api.patch(`/api/v1/trips/${id}/status`, { status });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trips'] }),
  });
}
