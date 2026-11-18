import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Truck } from 'lucide-react';
import { KpiCard } from '../KpiCard';

describe('KpiCard', () => {
  it('renders label, value, and positive trend pill', () => {
    render(
      <KpiCard
        label="Active Vehicles"
        value="18 / 20"
        trend={4.5}
        trendLabel="vs last month"
        icon={Truck}
      />
    );

    expect(screen.getByText('Active Vehicles')).toBeInTheDocument();
    expect(screen.getByText('18 / 20')).toBeInTheDocument();
    expect(screen.getByText('+4.5%')).toBeInTheDocument();
    expect(screen.getByText('vs last month')).toBeInTheDocument();
  });
});
