import { describe, expect, it } from 'vitest';
import { canTransitionParcelStatus, getAllowedNextStatuses } from '../utils/parcelStateMachine';

describe('Parcel Status State Machine', () => {
  it('allows valid lifecycle transitions', () => {
    expect(canTransitionParcelStatus('Expected', 'Received at hub')).toBe(true);
    expect(canTransitionParcelStatus('Received at hub', 'Scanned')).toBe(true);
    expect(canTransitionParcelStatus('Scanned', 'Verified')).toBe(true);
    expect(canTransitionParcelStatus('Verified', 'Stored')).toBe(true);
    expect(canTransitionParcelStatus('Stored', 'Delivery scheduled')).toBe(true);
    expect(canTransitionParcelStatus('Delivery scheduled', 'Out for delivery')).toBe(true);
    expect(canTransitionParcelStatus('Out for delivery', 'Delivered')).toBe(true);
  });

  it('rejects invalid backward or terminal transitions', () => {
    expect(canTransitionParcelStatus('Delivered', 'Expected')).toBe(false);
    expect(canTransitionParcelStatus('Cancelled', 'Stored')).toBe(false);
    expect(canTransitionParcelStatus('Returned', 'Out for delivery')).toBe(false);
    expect(getAllowedNextStatuses('Cancelled')).toEqual([]);
  });
});
