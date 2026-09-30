# imposterwho

A TypeScript REST API starter built with Express.

## Getting started

```sh
npm install
npm run dev
```

The server listens on port `3000` by default. Set `PORT` to use a different port.
Open `http://localhost:3000/` to create a game or join an active one from the player lobby. Game creation can generate a word and clue with Ollama, or use a pair entered in the form.

## Endpoints

- `GET /api/health` returns the service status.
- `GET /api/items` returns an empty JSON array as a starter resource endpoint.
- `POST /api/imposterwho/new` creates a game and returns its ID and player IDs. Send at least three names; optionally provide both `word` and `clue` to skip Ollama generation.
- `GET /api/imposterwho/games` lists active games and roster names without revealing player IDs or game content.
- `POST /api/imposterwho/join` accepts `{ "gameId": "...", "playerName": "..." }` and returns that roster player's role and secret.
- `GET /api/imposterwho/profile/:gameId/:playerId` returns that player's role and their clue (imposter) or word (crewmate).

Example game request:

```json
{
	"players": ["Alex", "Sam", "Riley"],
	"word": "volcano",
	"clue": "It can erupt"
}
```

When no word and clue are provided, the service generates them with Ollama. Configure `OLLAMA_HOST` and `OLLAMA_MODEL` to select the server and model. Games are held in memory and are lost when the service restarts. Player names identify roster entries but are not authenticated, so this lobby is intended for trusted groups.

Run `npm run build` to compile the service, then `npm start` to run the compiled output.