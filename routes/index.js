var express = require('express');
const path = require('path')

var router = express.Router();

const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const reader = require('xlsx');
puppeteer.use(StealthPlugin());
const crypto = require("crypto");

const randstr = crypto.randomBytes(20).toString('hex');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.sendFile(path.join(__dirname,'/index.html'));
});

async function scrollPage(page, scrollContainer) {
  let lastHeight = await page.evaluate(`document.querySelector("${scrollContainer}").scrollHeight`);
  while (true) {
    await page.evaluate(`document.querySelector("${scrollContainer}").scrollTo(0, document.querySelector("${scrollContainer}").scrollHeight)`);
    await page.waitForTimeout(4000);
    let newHeight = await page.evaluate(`document.querySelector("${scrollContainer}").scrollHeight`);
    if (newHeight === lastHeight) {
      break;
    }
    lastHeight = newHeight;
  }
}

const getData = async (page) => {
  return await page.evaluate((opts) => {
    const elements = document.querySelectorAll(".bJzME.Hu9e2e.tTVLSc");
    const placesElements = Array.from(elements).map(element => element.parentElement);

    const places = placesElements.map((place) => {
      const name = (place.querySelector(".DUwDvf")?.textContent || '').trim();
      const number = (place.querySelector("button[data-tooltip='Скопировать номер']")?.textContent.trim());
      const address = (place.querySelector('.Io6YTe.fontBodyMedium')?.textContent.trim());
      const website = (place.querySelector('.rogA2c.ITvuef')?.textContent.trim());

      return { name, number, address, website};
    })
    return places;
  });
}

async function getLocalPlacesInfo(query) {
  const requestParams = {
    baseURL: `https://google.com`,
    query: query,
    hl: "ru",
  };

  const browser = await puppeteer.launch({
    headless: true,
    // executablePath: '/usr/bin/google-chrome',
    args: [
      "--no-sandbox",
      // "--disable-setuid-sandbox",
      // '--window-size=1440,1000'
    ],
  });

  try {
    const page = await browser.newPage();
    const URL = `${requestParams.baseURL}/maps/search/${requestParams.query}?hl=${requestParams.hl}`;
    await page.setDefaultNavigationTimeout(60000);
    await page.goto(URL);
    const [button] = await page.$x("//*[@id=\"yDmH0d\"]/c-wiz/div/div/div/div[2]/div[1]/div[3]/div[1]/div[1]/form[2]/div/div/button");
    if (button) {
      await button.click();
    }
    await page.waitForNavigation();
    const scrollContainer = ".m6QErb[aria-label]";
    let localPlacesInfo = [];
    // let res = [];
    // await scrollPage(page, scrollContainer);

    await page.waitForTimeout(2000);
    const elHandleArray = await page.$$('div.Nv2PK')
    for (const el of elHandleArray) {
      await page.waitForTimeout(300);
      await el.click('.hfpxzc');
      await page.waitForSelector(".DUwDvf");
      await page.waitForTimeout(1500);
      const page_info = await getData(page);
      await page.waitForTimeout(1500);
      localPlacesInfo = Array.from(new Set(localPlacesInfo.concat(page_info)));
      await el.click('.VfPpkd-icon-LgbsSe');
      await page.waitForTimeout(300);
    }
    await browser.close();
    const workSheet = reader.utils.json_to_sheet(localPlacesInfo);
    const workBook = reader.utils.book_new();
    reader.utils.book_append_sheet(workBook, workSheet, "Sheet 1");

    const filePath = 'files/' + randstr + '.xlsx';
    await reader.writeFile(workBook, path.join(__dirname, '../public/'+filePath));

    return filePath;

  }catch(e){
    console.log('Error');
    return e;
  }
}

router.post('/get-xlsx', function(req,res){

    getLocalPlacesInfo(req.body.places  + ", " + req.body.word).then((filePath)=>{
      res.status(200).json({file: filePath});
    }).catch(error=>{
      res.status(400).json({error:"cant do this"});
    });
})
module.exports = router;
