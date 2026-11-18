import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, Polyline, Marker } from 'react-leaflet';
import { toast } from 'sonner';
import api from '../../lib/api';
import { PageHeader } from '../../components/shared/PageHeader';
import { Button } from '../../components/ui/button';

export function NewBookingPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    pickup_location: '',
    delivery_location: '',
    pickup_datetime: '',
    cargo_weight_kg: 1000,
    cargo_description: '',
  });

  const liveQuote = Math.round(Number(form.cargo_weight_kg || 0) * 2.5 + 500);

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post('/api/v1/bookings', payload);
      return data;
    },
    onSuccess: () => {
      toast.success('Booking request submitted');
      qc.invalidateQueries({ queryKey: ['customer-bookings'] });
      navigate('/customer/dashboard');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to create booking'),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="New Transport Request"
        description="Complete the 3-step wizard to get an instant quote and schedule pickup."
      />

      {/* Stepper & Progress Bar */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className={step >= 1 ? 'text-accent-hover' : 'text-obsidian-400'}>1. Locations</span>
          <span className={step >= 2 ? 'text-accent-hover' : 'text-obsidian-400'}>2. Cargo</span>
          <span className={step >= 3 ? 'text-accent-hover' : 'text-obsidian-400'}>3. Review</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-obsidian-100">
          <div
            className="h-full bg-accent transition-all duration-300"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>
      </div>

      {step === 1 && (
        <div className="card space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium">Pickup Location</label>
              <input
                className="input"
                placeholder="e.g. Delhi, IN"
                value={form.pickup_location}
                onChange={(e) => setForm({ ...form, pickup_location: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Delivery Location</label>
              <input
                className="input"
                placeholder="e.g. Mumbai, IN"
                value={form.delivery_location}
                onChange={(e) => setForm({ ...form, delivery_location: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium">Pickup Date &amp; Time</label>
            <input
              type="datetime-local"
              className="input"
              value={form.pickup_datetime}
              onChange={(e) => setForm({ ...form, pickup_datetime: e.target.value })}
            />
          </div>

          <div className="h-48 overflow-hidden rounded-lg border border-obsidian-200">
            <MapContainer center={[23.5, 78.5]} zoom={4} className="h-full w-full z-0">
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Polyline
                positions={[
                  [28.6139, 77.209],
                  [19.076, 72.8777],
                ]}
                color="#F59E0B"
              />
              <Marker position={[28.6139, 77.209]} />
              <Marker position={[19.076, 72.8777]} />
            </MapContainer>
          </div>

          <div className="flex justify-end">
            <Button
              disabled={
                !form.pickup_location || !form.delivery_location || !form.pickup_datetime
              }
              onClick={() => setStep(2)}
            >
              Next →
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium">Cargo Weight (kg)</label>
            <input
              type="number"
              className="input"
              min={1}
              value={form.cargo_weight_kg}
              onChange={(e) => setForm({ ...form, cargo_weight_kg: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Cargo Description</label>
            <textarea
              className="input"
              rows={3}
              placeholder="Describe packaging, pallet count, or handling notes..."
              value={form.cargo_description}
              onChange={(e) => setForm({ ...form, cargo_description: e.target.value })}
            />
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-center justify-between">
            <span className="text-xs font-medium text-obsidian-700">Estimated Quote</span>
            <span className="font-mono text-xl font-bold text-obsidian-900">
              ₹{liveQuote.toLocaleString()}
            </span>
          </div>

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep(1)}>
              ← Back
            </Button>
            <Button
              disabled={!form.cargo_weight_kg || !form.cargo_description}
              onClick={() => setStep(3)}
            >
              Next →
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card space-y-4">
          <h2 className="text-base font-bold text-obsidian-900">Review Booking Summary</h2>
          <div className="space-y-2 rounded-lg bg-obsidian-50 p-4 text-sm">
            <p><span className="text-obsidian-500">Route:</span> {form.pickup_location} → {form.delivery_location}</p>
            <p><span className="text-obsidian-500">Pickup:</span> {form.pickup_datetime}</p>
            <p><span className="text-obsidian-500">Cargo:</span> {form.cargo_description} ({form.cargo_weight_kg} kg)</p>
            <p className="font-mono font-bold"><span className="font-sans font-normal text-obsidian-500">Estimated Quote:</span> ₹{liveQuote.toLocaleString()}</p>
          </div>

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep(2)}>
              ← Back
            </Button>
            <Button
              disabled={createMutation.isPending}
              onClick={() => createMutation.mutate(form)}
            >
              {createMutation.isPending ? 'Submitting...' : 'Submit Booking'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
