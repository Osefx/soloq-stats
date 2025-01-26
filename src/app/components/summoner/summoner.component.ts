import { Component, OnInit } from '@angular/core';
import { RiotApiService } from 'src/app/services/riot-api.service';
import { from, of } from 'rxjs';
import { concatMap, delay, catchError } from 'rxjs/operators';

@Component({
  selector: 'app-summoner',
  templateUrl: './summoner.component.html',
  styleUrls: ['./summoner.component.css']
})
export class SummonerComponent implements OnInit {
  pezzosList: any[] = []; // Liste des amis
  pezzosData: any[] = []; // Données complètes pour chaque ami
  errorMessage: string = '';

  constructor(private riotApiService: RiotApiService) {}

  ngOnInit(): void {
    // Charger la liste des amis
    this.riotApiService.getpezzosList().subscribe(
      (pezzos) => {
        this.pezzosList = pezzos;
        this.loadpezzosData();
      },
      (error) => {
        console.error('Erreur lors de la récupération de la liste des amis:', error);
        this.errorMessage = 'Erreur lors de la récupération de la liste des amis.';
      }
    );
  }

  // Charger les données avec un décalage entre chaque ami
  loadpezzosData(): void {
    from(this.pezzosList) // Convertir la liste des amis en un flux observable
      .pipe(
        concatMap((friend, index) => {
          return this.loadFriendData(friend).pipe(
            delay(3000), // Ajouter un délai de 2 secondes entre chaque requête
            catchError((error) => {
              console.error(`Erreur pour ${friend.gameName}:`, error);
              return of({ error: true, gameName: friend.gameName }); // Gérer les erreurs sans bloquer
            })
          );
        })
      )
      .subscribe((friendData) => {
        this.pezzosData.push(friendData); // Ajouter les données de l'ami au tableau
      });
  }

  getQueueType(queueId: number): string {
    const queueMap: { [key: number]: string } = {
      400: 'Draft',
      420: 'SoloQ',
      440: 'FlexQ',
      450: 'Aram',
      700: 'Clash',
      830: 'Coop vs AI (Intro)',
      840: 'Coop vs AI (Beginner)',
      850: 'Coop vs AI (Intermediate)',
      900: 'Urf'
      // Ajoute ici d'autres queueId si nécessaire
    };

    return queueMap[queueId] || 'Classic'; // Retourne "Classic" par défaut si queueId inconnu
  }

  // Charger les données pour un ami
  loadFriendData(friend: any) {
    let friendData: any = {
      gameName: friend.gameName,
      tagLine: friend.tagLine,
      opggUrl: friend.opggUrl, // Ajouter l'URL du profil OP.GG
      summonerData: null,
      rankData: null,
      matchHistory: null,
      profileIconId: null, // Nous allons maintenant récupérer le profileIconId ici
      error: null
    };

    return this.riotApiService.getSummonerByRiotId(friend.gameName, friend.tagLine).pipe(
      concatMap((data) => {
        console.log('Summoner Data récupéré:', data); // Debugging pour vérifier les données
        friendData.summonerData = data;

        return this.riotApiService.getSummonerByPuuid(data.puuid).pipe(
          concatMap((rankData) => {
            console.log('Rank Data récupéré:', rankData); // Debugging pour vérifier les données
            friendData.rankData = rankData.rank;

            // Récupérer le profileIconId à partir des données de rankData
            if (rankData && rankData.summoner) {
              friendData.profileIconId = rankData.summoner.profileIconId;
            }

            return this.riotApiService.getSummonerMatchHistory(data.puuid).pipe(
              concatMap((matchHistory) => {
                console.log('Match History récupéré:', matchHistory); // Debugging pour vérifier les données
                friendData.matchHistory = matchHistory.map((match: any) => {
                  const participant = match.info.participants.find(
                    (p: any) => p.puuid === data.puuid
                  );

                  const teamWin = match.info.teams.find(
                    (team: any) => team.win && team.teamId === participant.teamId
                  );

                  return {
                    ...match,
                    playerWon: !!teamWin, // Ajoute une clé pour indiquer si le joueur a gagné
                    queueType: this.getQueueType(match.info.queueId)
                  };
                });

                return of(friendData); // Retourner toutes les données une fois prêtes
              })
            );
          })
        );
      })
    );
  }

  /**
   * Calculer le taux de victoire (Winrate)
   * @param friend Objet contenant les données de l'ami
   * @returns Le Winrate formaté en pourcentage ou 'N/A' si non calculable
   */
  getWinrate(friend: any): string {
    if (!friend.rankData || !friend.rankData[0]) {
      return 'N/A';
    }
    const wins = friend.rankData[0]?.wins || 0;
    const losses = friend.rankData[0]?.losses || 0;

    if (wins + losses === 0) {
      return 'N/A';
    }

    const winrate = (wins / (wins + losses)) * 100;
    return winrate.toFixed(2) + ' %';
  }
  getWinratePercentage(wins: number, losses: number): number {
    if (!wins || !losses) return 0;
    return (wins / (wins + losses)) * 100;
  }

  getWinrateColor(wins: number, losses: number): string {
    const winrate = this.getWinratePercentage(wins, losses);
    if (winrate >= 50) {
        return 'green';
    } else if (winrate >= 30) {
        return 'orange';
    } else {
        return 'red';
    }
  }

}
