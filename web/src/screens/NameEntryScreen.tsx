import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { connectSocket } from '@/services/socket';

/** Name entry screen, prompting for a session-only display name before connecting for lobby access */
export const NameEntryScreen = () => {
  const [name, setName] = useState('');

  /** Connect with the trimmed name on submit, for entering the lobby */
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      return;
    }
    connectSocket(trimmed);
  };

  return (
    // A non-dismissable dialog blocks the app until a name is chosen
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enter your name</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <Input
            autoFocus
            placeholder="Your display name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Button type="submit" disabled={name.trim().length === 0}>
            Join Lobby
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
