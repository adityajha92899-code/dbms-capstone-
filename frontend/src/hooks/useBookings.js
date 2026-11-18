import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export function useBookings(params = {}) {
  return useQuery({
    queryKey: ['bookings', params],
    queryFn: async () => {
      const { data } = await api.get('/api/v1/bookings', { params });
      return data;
    },
  });
}

export function useCreateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post('/api/v1/bookings', payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookings'] }),
  });
}
