/* eslint-disable require-jsdoc */
'use strict';
import * as renderModule from './modules/renderUpdates.js';
import * as utilsModule from './modules/utils.js';

const playerVars = {
  myClientId: '',
  localGameState: {},
  isGameOn: false,
  gameRound: 1,
  totalPlayers: 1,
  endGameClicked: false,
  myNickname: localStorage.getItem('nickname'),
  myGameRoomCode: localStorage.getItem('roomCode'),
  amIHost: localStorage.getItem('isHost') === 'true'
};

const channelNames = {
  myPublishChName: '',
  globalChName: '',
  myGameRoomChName: playerVars.myGameRoomCode + ':primary'
};

const channelInstances = {
  myPublishChannel: '',
  myGameRoomChannel: '',
  globalChannel: ''
};

window.copyCode = copyCode;
window.startGame = startGame;
window.endGame = endGame;
window.clickBuzzer = clickBuzzer;
window.resetBuzzer = resetBuzzer;

// instantiate the Ably library
// authenticate via Token Auth strategy
const realtime = new Ably.Realtime({
  authUrl: '/auth'
});

// wait until connection with Ably is established
realtime.connection.once('connected', () => {
  // save the current players clientId
  playerVars.myClientId = realtime.auth.clientId;
  // call a method to attach to channels
  attachChannels();

  // request a new worker thread or enter existing
  if (playerVars.amIHost) {
    waitForGameRoom();
    enterMainThread();
  } else {
    enterGameRoom();
  }
  receiveGlobalGameState();
});

// method to attach to channels
function attachChannels() {
  // channel to publish player input
  channelNames.myPublishChName =
    playerVars.myGameRoomCode + ':player-ch-' + playerVars.myClientId;
  channelInstances.myPublishChannel = realtime.channels.get(
    channelNames.myPublishChName
  );
  // channel to receive global game state updates
  channelInstances.myGameRoomChannel = realtime.channels.get(
    channelNames.myGameRoomChName
  );
}

// method to wait for the worker thread to be ready
function waitForGameRoom() {
  channelInstances.myGameRoomChannel.subscribe('thread-ready', (msg) => {
    channelInstances.globalChannel.detach();
    enterGameRoom();
    renderModule.showRoomCodeToShare(playerVars.myGameRoomCode);
  });
}

// method to enter presence on the main server thread (for hosts only)
function enterMainThread() {
  channelNames.globalChName = 'main-game-thread';
  channelInstances.globalChannel = realtime.channels.get(
    channelNames.globalChName
  );
  channelInstances.globalChannel.presence.enter({
    nickname: playerVars.myNickname,
    roomCode: playerVars.myGameRoomCode,
    isHost: playerVars.amIHost
  });
}

// method to enter presence on the game server worker thread (for all players)
function enterGameRoom() {
  channelInstances.myGameRoomChannel.presence.enter({
    nickname: playerVars.myNickname,
    isHost: playerVars.amIHost
  });
}

// method to subscribe to global game state updates from game server
function receiveGlobalGameState() {
  channelInstances.myGameRoomChannel.subscribe('game-state', (msg) => {
    if (msg.data.isGameOn && !playerVars.isGameOn) {
      renderModule.showGameArea(playerVars.amIHost);
      playerVars.isGameOn = true;
    }
    if (!msg.data.isGameOver) {
      updateLocalState(msg.data);
    } else {
      endGameAndCleanup(msg.data.isGameOn);
    }
    if (msg.data.gameRound > playerVars.gameRound) {
      renderModule.updateGameNewsList('', `---- Buzzer has been reset (round ${msg.data.gameRound}) ----`);
      playerVars.gameRound = msg.data.gameRound;
    }
  });
}

// method to update local variables based on the update received from the server
function updateLocalState(msgData) {
  playerVars.totalPlayers = msgData.totalPlayers;
  for (const item in msgData.globalPlayersState) {
    if (
      playerVars.localGameState[item] &&
      msgData.globalPlayersState[item].isConnected
    ) {
      handlePlayerStateUpdate(msgData.globalPlayersState[item], item);
    } else if (
      playerVars.localGameState[item] &&
      !msgData.globalPlayersState[item].isConnected
    ) {
      handleExistingPlayerLeft(
        msgData.data.globalPlayersState[item].nickname,
        item
      );
    } else if (
      !playerVars.localGameState[item] &&
      msgData.globalPlayersState[item].isConnected
    ) {
      handleNewPlayerJoined(msgData.globalPlayersState[item], item);
    }
  }
}

// method to end the game and detach from channels
function endGameAndCleanup(isGlobalGameOn) {
  if (!isGlobalGameOn && playerVars.isGameOn) {
    renderModule.showEndGameAlert(playerVars.amIHost);
    channelInstances.myGameRoomChannel.detach();
    channelInstances.myPublishChannel.detach();
    realtime.connection.close();
    // redirect to the homepage after a bit
    setTimeout(() => {
      if (!playerVars.endGameClicked) {
        window.location.replace('/?restart');
      }
      playerVars.endGameClicked = true;
    }, 3000);
  }
}

// method to update the UI as per player state
function handlePlayerStateUpdate(globalState, playerId) {
  const { notClicked, nickname, gameRound } = globalState;
  
  if (notClicked) {
    playerVars.localGameState[playerId] = {
      ...globalState
    };
  } else if (!notClicked && playerVars.localGameState[playerId].notClicked) {
    playerVars.localGameState[playerId].notClicked = false;
    renderModule.updateGameNewsList(nickname, 'clicked the buzzer');
  }
}

// method to handle a player leaving the game
function handleExistingPlayerLeft(nickname, playerId) {
  if (!playerVars.isGameOn) {
    renderModule.updatePresenceList(
      nickname,
      'left',
      playerVars.amIHost,
      playerVars.totalPlayers
    );
  } else {
    renderModule.updateGameNewsList(nickname, 'left');
  }
  delete playerVars.localGameState[playerId];
}

// method to handle a new player joining the game
function handleNewPlayerJoined(newPlayerState, playerId) {
  // create a new entry for this player and copy the latest state from the server
  playerVars.localGameState[playerId] = { ...newPlayerState };
  // update the presence list
  renderModule.updatePresenceList(
    newPlayerState.nickname,
    'joined',
    playerVars.amIHost,
    playerVars.totalPlayers
  );
}

// method to start the game
// only game hosts have this button
function startGame() {
  channelInstances.myPublishChannel.publish('start-game', {
    startGame: true
  });
}

// method to end the game
// only game hosts have this button
function endGame() {
  channelInstances.myPublishChannel.publish('end-game', {
    endGame: true
  });
}

// method to click buzzer
// all players have this button
function clickBuzzer() {
  channelInstances.myPublishChannel.publish('player-clicked', {
    clickedPlayerId: playerVars.myClientId
  });
}

// method to reset the buzzer
// only game hosts have this button
function resetBuzzer() {
  channelInstances.myPublishChannel.publish('reset-buzzer', {
    gameRound: true
  });
}

// method to copy the room code to clipboard on button click
function copyCode() {
  navigator.clipboard.writeText(playerVars.myGameRoomCode);
}