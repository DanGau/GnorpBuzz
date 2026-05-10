import { Game } from './game/Game';
import { UI } from './ui/UI';

const mount = document.getElementById('app');
if (!mount) throw new Error('Missing #app mount point');
const uiMount = document.getElementById('ui');
if (!uiMount) throw new Error('Missing #ui mount point');

const game = new Game();
await game.init(mount);
game.ui = new UI(game, uiMount);
game.attachDebugInterface();
