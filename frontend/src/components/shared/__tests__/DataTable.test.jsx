import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DataTable } from '../DataTable';

const columns = [
  { key: 'reg_number', label: 'Reg#' },
  { key: 'make', label: 'Make' },
];

describe('DataTable', () => {
  it('renders rows when data is provided', () => {
    render(
      <DataTable
        columns={columns}
        data={[{ id: '1', reg_number: 'FF-1001-TX', make: 'Volvo' }]}
      />
    );
    expect(screen.getByText('FF-1001-TX')).toBeInTheDocument();
    expect(screen.getByText('Volvo')).toBeInTheDocument();
  });

  it('renders empty state when data is empty', () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        empty={{ title: 'No vehicles', description: 'Add a vehicle' }}
      />
    );
    expect(screen.getByText('No vehicles')).toBeInTheDocument();
  });

  it('renders skeleton loader when loading', () => {
    const { container } = render(<DataTable columns={columns} data={[]} loading />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });
});
