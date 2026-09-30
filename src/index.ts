import { randomInt, randomUUID } from 'node:crypto';
import express from 'express';
import { Ollama } from 'ollama';
import { fileURLToPath } from 'node:url';

type Role = 'imposter' | 'crewmate';

interface Player {
  id: string;
  name: string;
  role: Role;
}

interface GameContent {
  word: string;
  clue: string;
}

interface Game extends GameContent {
  players: Player[];
}

const app = express();
const port = Number(process.env.PORT ?? 3000);
const ollama = new Ollama({
  host: process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434',
});
const games = new Map<string, Game>();
const lobbyPage = fileURLToPath(new URL('../public/index.html', import.meta.url));

app.use(express.json());

app.get('/', (_request, response) => {
  response.sendFile(lobbyPage);
});

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.get('/api/items', (_request, response) => {
  response.json([]);
});

app.post('/api/imposterwho/new', async (request, response) => {
  const { players: playerNames, word, clue } = request.body ?? {};

  if (
    !Array.isArray(playerNames) ||
    playerNames.length < 3 ||
    playerNames.some((name: unknown) => typeof name !== 'string' || !name.trim())
  ) {
    response.status(400).json({ error: 'Provide at least three non-empty player names.' });
    return;
  }

  const uniqueNames = new Set(playerNames.map((name: string) => name.trim().toLowerCase()));
  if (uniqueNames.size !== playerNames.length) {
    response.status(400).json({ error: 'Player names must be unique within a game.' });
    return;
  }

  let content: GameContent;
  if (word !== undefined || clue !== undefined) {
    if (typeof word !== 'string' || !word.trim() || typeof clue !== 'string' || !clue.trim()) {
      response.status(400).json({ error: 'Provide both a non-empty word and clue.' });
      return;
    }
    content = { word: word.trim(), clue: clue.trim() };
  } else {
    try {
      const generated = await ollama.chat({
        model: process.env.OLLAMA_MODEL ?? 'gemma4-64k:latest',
        format: 'json',
        messages: [
          {
            role: 'user',
            content: 'Create a word and a one word, related clue for an imposter party game. Return JSON with string fields "word" and "clue". The clue must not contain the word.',
          },
        ],
      });
      const parsed: unknown = JSON.parse(generated.message.content);
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !('word' in parsed) ||
        typeof parsed.word !== 'string' ||
        !parsed.word.trim() ||
        !('clue' in parsed) ||
        typeof parsed.clue !== 'string' ||
        !parsed.clue.trim()
      ) {
        throw new Error('Ollama returned invalid game content.');
      }
      content = { word: parsed.word.trim(), clue: parsed.clue.trim() };
    } catch {
      response.status(503).json({ error: 'Could not generate game content. Check the Ollama service or provide a word and clue.' });
      return;
    }
  }

  const imposterIndex = randomInt(playerNames.length);
  const gameId = randomUUID();
  const game: Game = {
    ...content,
    players: playerNames.map((name: string, index: number) => ({
      id: randomUUID(),
      name: name.trim(),
      role: index === imposterIndex ? 'imposter' : 'crewmate',
    })),
  };
  games.set(gameId, game);

  response.status(201).json({
    gameId,
    players: game.players.map(({ id, name }) => ({ id, name })),
  });
});

app.get('/api/imposterwho/games', (_request, response) => {
  response.json({
    games: Array.from(games, ([gameId, game]) => ({
      gameId,
      players: game.players.map(({ name }) => name),
    })),
  });
});

app.post('/api/imposterwho/join', (request, response) => {
  const { gameId, playerName } = request.body ?? {};
  if (typeof gameId !== 'string' || typeof playerName !== 'string' || !playerName.trim()) {
    response.status(400).json({ error: 'Provide a game ID and player name.' });
    return;
  }

  const game = games.get(gameId);
  if (!game) {
    response.status(404).json({ error: 'Game not found.' });
    return;
  }

  const player = game.players.find(({ name }) => name.toLowerCase() === playerName.trim().toLowerCase());
  if (!player) {
    response.status(404).json({ error: 'Player not found in this game.' });
    return;
  }

  if (player.role === 'imposter') {
    response.json({ playerId: player.id, playerName: player.name, role: player.role, clue: game.clue });
    return;
  }

  response.json({ playerId: player.id, playerName: player.name, role: player.role, word: game.word });
});

app.get('/api/imposterwho/profile/:gameId/:playerId', (request, response) => {
  const game = games.get(request.params.gameId);
  if (!game) {
    response.status(404).json({ error: 'Game not found.' });
    return;
  }

  const player = game.players.find(({ id }) => id === request.params.playerId);
  if (!player) {
    response.status(404).json({ error: 'Player not found.' });
    return;
  }

  if (player.role === 'imposter') {
    response.json({ playerId: player.id, playerName: player.name, role: player.role, clue: game.clue });
    return;
  }

  response.json({ playerId: player.id, playerName: player.name, role: player.role, word: game.word });
});

app.use((_request, response) => {
  response.status(404).json({ error: 'Not found' });
});

app.listen(port, () => {
  console.log(`REST API listening on http://localhost:${port}`);
});