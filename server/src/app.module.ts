import { Module } from '@nestjs/common';
import { GameGateway } from './gateway/game.gateway';
import { RoomService } from './room/room.service';

/** Root module wiring the room service + socket gateway for the signaling server */
@Module({
  providers: [RoomService, GameGateway],
})
export class AppModule {}
