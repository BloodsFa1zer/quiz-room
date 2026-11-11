import type { Quiz } from '@quiz/shared';
import { createRoomState } from './engine';
import type { Room } from './types';

export interface RoomManager {
  /** Unique PIN: 6 digits, the first one is not zero. */
  createRoom(quiz: Quiz): Room;
  getRoom(pin: string): Room | undefined;
  deleteRoom(pin: string): void;
  listRooms(): Room[];
}

/** The Map lives inside the factory, so tests and the smoke script get independent instances. */
export function createRoomManager(): RoomManager {
  const rooms = new Map<string, Room>();

  function newPin(): string {
    let pin: string;
    do {
      pin = String(100_000 + Math.floor(Math.random() * 900_000));
    } while (rooms.has(pin));
    return pin;
  }

  return {
    createRoom(quiz) {
      const room = createRoomState(newPin(), quiz, Date.now());
      rooms.set(room.pin, room);
      return room;
    },
    getRoom(pin) {
      return rooms.get(pin);
    },
    deleteRoom(pin) {
      rooms.delete(pin);
    },
    listRooms() {
      return [...rooms.values()];
    },
  };
}
