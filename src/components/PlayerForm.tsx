import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useTeamMutation } from '../lib/session';
import type { Player } from '../lib/types';
import { POSITIONS, POSITION_LABELS } from '../../shared/domain';
import { Button, ConfirmButton, Field, Input, Modal, Select, Textarea } from './ui';

export function PlayerFormModal({ player, onClose }: { player: Player | null; onClose: () => void }) {
  const navigate = useNavigate();
  const [v, setV] = useState({
    first_name: player?.first_name ?? '',
    last_name: player?.last_name ?? '',
    number: player?.number?.toString() ?? '',
    position: player?.position ?? 'C',
    shoots: player?.shoots ?? '',
    birth_year: player?.birth_year?.toString() ?? '',
    photo_url: player?.photo_url ?? '',
    status: player?.status ?? 'active',
    notes: player?.notes ?? '',
  });
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  const save = useTeamMutation((b) => (player ? api.patch(`${b}/players/${player.id}`, v) : api.post(`${b}/players`, v)), { toast: player ? 'Player updated' : 'Player added', onSuccess: onClose });
  const del = useTeamMutation((b) => api.del(`${b}/players/${player!.id}`), {
    toast: 'Player removed',
    onSuccess: () => {
      onClose();
      navigate('/players');
    },
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={player ? `Edit ${player.first_name} ${player.last_name}` : 'Add player'}
      footer={
        <>
          {player && (
            <div className="mr-auto">
              <ConfirmButton onConfirm={() => del.mutate(undefined)} confirmText="Delete player and history" icon={<Trash2 className="h-4 w-4" />}>
                Delete
              </ConfirmButton>
            </div>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={save.isPending} onClick={() => save.mutate(undefined)}>
            {player ? 'Save' : 'Add player'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name">
            <Input value={v.first_name} onChange={set('first_name')} />
          </Field>
          <Field label="Last name">
            <Input value={v.last_name} onChange={set('last_name')} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Number">
            <Input type="number" min={0} max={99} value={v.number} onChange={set('number')} />
          </Field>
          <Field label="Position">
            <Select value={v.position} onChange={set('position')}>
              {POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {POSITION_LABELS[p]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Shoots">
            <Select value={v.shoots} onChange={set('shoots')}>
              <option value="">—</option>
              <option value="L">Left</option>
              <option value="R">Right</option>
            </Select>
          </Field>
          <Field label="Birth year">
            <Input type="number" min={1950} max={2030} value={v.birth_year} onChange={set('birth_year')} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status">
            <Select value={v.status} onChange={set('status')}>
              <option value="active">Active</option>
              <option value="injured">Injured</option>
              <option value="inactive">Inactive</option>
            </Select>
          </Field>
          <Field label="Photo URL (optional)" hint="Photo uploads are not supported yet.">
            <Input type="url" placeholder="https://…" value={v.photo_url} onChange={set('photo_url')} />
          </Field>
        </div>
        <Field label="Notes">
          <Textarea value={v.notes} onChange={set('notes')} />
        </Field>
      </div>
    </Modal>
  );
}
