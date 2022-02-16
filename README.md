# 🅱️eopardy #

## An online buzzer game for trivia nights with friends. ##

#### How to play: ####
- Create a lobby or join a friend's lobby. Call each other (on discord, zoom, slack, etc) to play a trivia game together!
- Everyone can press the buzzer once, and the first one to press it may answer the question. If they get it wrong, the second one to press it can answer, and so on.
- Or you can make your own rules, up to you to decide!
- For the next question, the host can reset the buzzer and the players will be able to click on it again.

#### Preview online: ####
- https://beopardy.glitch.me/

#### Preview on local: ####
- Make an ably.com account and create an api key
- Copy `.env.example` to `.env` and change the `ABLY_API_KEY`
- Run `npm install`
- Run `npm start`
- Open your browser on `http://localhost:5000/`


#### Stack: ####

- [Node JS](https://nodejs.org/en/)
- [Express](https://expressjs.com/)
- [Vanilla JS](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
- [Ably Realtime](https://www.ably.io)
- [Bootstrap](https://getbootstrap.com/)
- [DotEnv](https://www.npmjs.com/package/dotenv)
