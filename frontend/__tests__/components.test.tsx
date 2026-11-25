import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from '../components/parcels/StatusBadge';
import { EmptyState } from '../components/ui/Primitives';

describe('PARCELBRIDGE UI Components', () => {
  it('renders parcel StatusBadge with status text', () => {
    render(<StatusBadge status="Delivery scheduled" />);
    expect(screen.getByText('Delivery scheduled')).toBeInTheDocument();
  });

  it('renders EmptyState title and description', () => {
    render(<EmptyState title="No parcels" description="Incoming parcels will appear here." />);
    expect(screen.getByText('No parcels')).toBeInTheDocument();
    expect(screen.getByText('Incoming parcels will appear here.')).toBeInTheDocument();
  });
});
