const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();

// Edpuzzle
//const puppeteer = require('puppeteer');

// Kahoot
const request = require('request');
const kahoot = require("kahoot.js-api");

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.get('/', (req, res) => {
    res.send('Nothing to see here.')
});

// Edpuzzle
const scrapeDataFrom = async (mediaID) => {
    // FIRST FROM URL: https://edpuzzle.com/api/v3/assignments/(code from url); data.teacherAssignments[0].contentID; then can get info from https://edpuzzle.com/api/v3/media/CONTENTID
    
    // Using puppeteer
    // const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    // const page = await browser.newPage();

    // await page.goto('https://edpuzzle.com/api/v3/media/' + mediaID, {
    //     waitUntil: 'networkidle2',
    // });

    // const newhtml = await page.evaluate(() => {
    //     return document.body.children[0].innerText;
    // });

    // const data = JSON.parse(newhtml);
    
    
    // await browser.close();

    // return {
    //     questions: data.questions.sort((a, b) => a.time - b.time),
    //     title: data.title,
    //     img: data.thumbnailURL,
    // }

    // Not using puppeteer
    let finalData;
    try {
      const initData = await request('https://edpuzzle.com/api/v3/media/' + mediaID, (error, response, html) => {
        if (!error && response.statusCode == 200) {
          const data = JSON.parse(html);
          console.log('data, ', data)
          finalData = {
            questions: data.questions.sort((a, b) => a.time - b.time),
            title: data.title,
            img: data.thumbnailURL,
         }
        } else {
          console.log(error);
        }
       });
    } catch(err) {
      console.error(err);
    }
    return finalData;
}


app.post('/edpuzzle/getdata', cors(), async (req, res) => {
    try {
        const data = await scrapeDataFrom(req.body.mediaID);
        if (data.error) {
          res.json({
            success: false,
            data,
          })
        }
        res.json({
            success: true,
            data,
        })
    } catch(err) {
        console.error(err);
    }
});

// Kahoot
const savedKahootData = {};
const fetchKahootData = async (uuid) => {
  request(`https://create.kahoot.it/rest/kahoots/${uuid}/card/?includeKahoot=true`, (error, response, html) => {
    if (!error && response.statusCode == 200) {
      const body = JSON.parse(html);

      const questions = body.kahoot.questions.map((que, f) => {
        let indexCorrect = 0;
        let answerCorrect = '';
        que.choices.forEach((choi, i) => {
          if (choi.correct) {
            indexCorrect = i
            answerCorrect = choi.answer;
          };
        });
        return {
          index: f,
          indexCorrect,
          answerCorrect,
        };
      });
      const finalObj = {
        uuid: body.kahoot.uuid,
        questions,
      };

      savedKahootData[body.kahoot.uuid] = finalObj;
      // console.log(finalObj);
    }
  });
};

app.post('/kahoot/joingame', cors(), async (req, res) => {
    try {
      let uuid = '';
      if (req.body.uuid) {
        uuid = req.body.uuid;
        if (!savedKahootData[uuid]) {
          fetchKahootData(req.body.uuid);
        }
      }
      const delay = parseInt(req.body.delay);
      let pin = req.body.pin;
      let bots = parseInt(req.body.bots);
      if (bots > 100) bots = 100;
      if (bots > 0) {
        for (var i = 1; i <= req.body.bots; i++) {
          const client = new kahoot();
          client.uuid = uuid;
          const botName = req.body.name + (i == 1 ? '' : i);
           
          client.on("Joined", () => {
            // console.log("I joined the Kahoot!");
          });
          client.on("QuizStart", () => {
            // console.log("The quiz has started!");
          });
          client.on("QuestionStart", question => {
            if (savedKahootData[client.uuid]) {
              const currectAnswerIndex = savedKahootData[client.uuid].questions[question.questionIndex].indexCorrect;
              console.log('QUESTION, ', question);
              // Wait for delay
              setTimeout(() => {
                question.answer(currectAnswerIndex);
              }, (Math.random() * delay) * 1000);
            } else {
              const amountOfQuestions = question.numberOfChoices;
              // Wait for delay
              setTimeout(() => {
                question.answer(question.answer(Math.floor(Math.random() * amountOfQuestions)));
              }, (Math.random() * delay) * 1000);
              // console.log('No saved Data');
              
            }
          });
          client.on("QuizEnd", () => {
            // console.log("The quiz has ended.");
          });
          client.join(pin, botName);
        }
      } else {
        return res.json({
          status: 'Number of bots is undefined!',
        });
      }
      res.json({
        status: 'DONE!',
      });
    } catch(err) {
      console.error(err);
    }
  });
  
  app.post('/kahoot/searchuuid', cors(), async (req, res) => {
    // https://create.kahoot.it/rest/kahoots/?query=sports
    try {
      const query = req.body.query;
      request(`https://create.kahoot.it/rest/kahoots/?query=${query}`, (error, response, html) => {
        if (!error && response.statusCode == 200) {
          const body = JSON.parse(html);
          const kahoots = body.entities.map(kahoot => {
            //console.log(kahoot);
            return {
              uuid: kahoot.card.uuid,
              title: kahoot.card.title,
              description: kahoot.card.description,
              numberOfQuestions: kahoot.card.number_of_questions,
              cover: kahoot.card.cover,
              author: kahoot.card.creator_username,
            };
          });
          res.json({
            kahoots,
            status: 'success',
          });
        }
      });
    } catch(err) {
      console.error(err);
    }
  });

  app.get('/test', async (req, res) => {
    try {
      let test = await scrapeDataFrom('62615a6e9e696e429ff317af');
      console.log('final, ', test);
      res.send(test);
    } catch(err) {
      console.error(err);
    }
  })

  app.listen(process.env.PORT || 3000, () => {
      console.log('Listening...')
  });
