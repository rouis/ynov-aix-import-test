import { TicketMapper } from './ticket-mapper';

const base = {
  id: 't1',
  organizationId: 'o1',
  title: 'T',
  description: 'd',
  status: 'OPEN',
  priority: 'LOW',
  category: 'Email',
  requester_email: 'r@client.com',
  assigned_to_id: null,
  assignedTo: null,
  created_by_id: 'u1',
  created_at: new Date(),
  updated_at: new Date(),
  closed_at: null,
  technician_note: 'diagnostic en cours',
  createdBy: { id: 'u1', firstname: 'Bruno', lastname: 'Leclerc', email: 'b@msp.com' },
};

describe('TicketMapper.toResponse — note & reporter', () => {
  it('expose technician_note et reporter (depuis createdBy)', () => {
    const res = TicketMapper.toResponse(base as never);
    expect(res.technician_note).toBe('diagnostic en cours');
    expect(res.reporter).toEqual({ firstname: 'Bruno', lastname: 'Leclerc', email: 'b@msp.com' });
  });

  it('reporter null si createdBy absent, note null si absente', () => {
    const res = TicketMapper.toResponse({ ...base, createdBy: null, technician_note: null } as never);
    expect(res.reporter).toBeNull();
    expect(res.technician_note).toBeNull();
  });
});
