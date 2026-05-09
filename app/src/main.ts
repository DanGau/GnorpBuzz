import { Game } from './game/Game';

const mount = document.getElementById('app');
if (!mount) throw new Error('Missing #app mount point');

const game = new Game();
await game.init(mount);
game.attachDebugInterface();
