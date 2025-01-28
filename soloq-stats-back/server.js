const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = 3000;

// Autoriser le CORS
app.use(cors());
app.use(express.json());

// API Key Riot
const RIOT_API_KEY = '';

// Endpoint pour récupérer le PUUID avec RiotID (nom + tagLine)
app.get('/riotid/:gameName/:tagLine', async (req, res) => {
  const { gameName, tagLine } = req.params;
  try {
    const response = await axios.get(
      `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${gameName}/${tagLine}`,
      { headers: { 'X-Riot-Token': RIOT_API_KEY } }
    );
    res.json(response.data);  // Retourne le PUUID
  } catch (error) {
    console.error('Erreur API Riot (PUUID) :', error.response?.data || error.message);
    res.status(error.response?.status || 500).send(error.response?.data || error.message);
  }
});

/// Endpoint pour récupérer les infos du summoner par PUUID
app.get('/summoner/by-puuid/:puuid', async (req, res) => {
  const { puuid } = req.params;
  console.log('Requête reçue pour le PUUID:', puuid);
  try {
    const response = await axios.get(
      `https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`,
      { headers: { 'X-Riot-Token': RIOT_API_KEY } }
    );
    const summonerData = response.data;
    console.log('Données du summoner :', summonerData);

    const rankResponse = await axios.get(
      `https://euw1.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerData.id}`,
      { headers: { 'X-Riot-Token': RIOT_API_KEY } }
    );

    res.json({
      summoner: summonerData,
      rank: rankResponse.data
    });
  } catch (error) {
    console.error('Erreur API Riot (Summoner ou Rank) :', error.response?.data || error.message);
    res.status(error.response?.status || 500).send(error.response?.data || error.message);
  }
});

// Endpoint pour récupérer l'historique des matchs du summoner avec son PUUID
app.get('/summoner/matches/:puuid', async (req, res) => {
  const { puuid } = req.params;
  try {
    const matchIdsResponse = await axios.get(
      `https://europe.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=8`,
      { headers: { 'X-Riot-Token': RIOT_API_KEY } }
    );

    const matchDetailsPromises = matchIdsResponse.data.map(matchId => {
      return axios.get(
        `https://europe.api.riotgames.com/lol/match/v5/matches/${matchId}`,
        { headers: { 'X-Riot-Token': RIOT_API_KEY } }
      );
    });

    const matchDetails = await Promise.all(matchDetailsPromises);
    res.json(matchDetails.map(detail => detail.data));  // Retourne les détails des matchs
  } catch (error) {
    console.error('Erreur API Riot (Historique) :', error.response?.data || error.message);
    res.status(error.response?.status || 500).send(error.response?.data || error.message);
  }
});
// Endpoint pour récupérer les parties en cours d'un summoner
app.get('/summoner/livematches/:puuid', async (req, res) => {
  const { puuid } = req.params;
  try {
    // Récupérer les informations sur la partie en cours
    const liveMatchResponse = await axios.get(
      `https://euw1.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${puuid}`,
      { headers: { 'X-Riot-Token': RIOT_API_KEY } }
    );
      console.log('données live:', liveMatchResponse.data)
    res.json(liveMatchResponse.data);  // Retourne les détails de la partie en cours
  } catch (error) {
    if (error.response && error.response.status === 404) {
      // Le summoner n'est pas en partie
      res.json({ isInGame: false });
    } else {
      console.error('Erreur API Riot (Live Match) :', error.response?.data || error.message);
      res.status(error.response?.status || 500).send(error.response?.data || error.message);
    }
  }
});

// Lancer le serveur
app.listen(port, () => {
  console.log(`Backend proxy en écoute sur http://localhost:${port}`);
});
