import { type FormEvent, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { createRoom, joinRoom } from '@/services/socket';
import { useSocketStore } from '@/stores/socketStore';

/** Lobby screen, listing open rooms and offering room creation for starting/joining a match */
export const LobbyScreen = () => {
  const rooms = useSocketStore((state) => state.rooms);
  const playerName = useSocketStore((state) => state.playerName);
  const [roomName, setRoomName] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  /** Create the room and close the dialog on submit, for hosting */
  const handleCreate = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = roomName.trim();
    if (trimmed.length === 0) {
      return;
    }
    createRoom(trimmed);
    setRoomName('');
    setDialogOpen(false);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header greets the player and anchors the lobby */}
      <header className="flex items-center justify-between border-b p-4">
        <h1 className="text-lg font-semibold">Online Tic-Tac-Toe</h1>
        <span className="text-sm text-muted-foreground">Hi, {playerName}</span>
      </header>

      {/* Scrollable room list fills the available space */}
      <main className="flex-1 space-y-3 overflow-y-auto p-4">
        {rooms.length === 0 ? (
          <p className="pt-10 text-center text-muted-foreground">No open rooms yet. Create one!</p>
        ) : (
          rooms.map((room) => (
            <Card key={room.id}>
              <CardContent className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{room.name}</p>
                  <p className="text-sm text-muted-foreground">Host: {room.hostName}</p>
                </div>
                <Button size="sm" onClick={() => joinRoom(room.id)}>
                  Join
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </main>

      {/* Create-room action pinned to the bottom for thumb reach */}
      <footer className="border-t p-4">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full">
              <Plus className="mr-2 h-4 w-4" /> Create Room
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a room</DialogTitle>
            </DialogHeader>
            <form className="flex flex-col gap-4" onSubmit={handleCreate}>
              <Input
                autoFocus
                placeholder="Room name"
                value={roomName}
                onChange={(event) => setRoomName(event.target.value)}
              />
              <Button type="submit" disabled={roomName.trim().length === 0}>
                Create
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </footer>
    </div>
  );
};
