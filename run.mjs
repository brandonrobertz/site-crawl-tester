import puppeteer from 'puppeteer'; // or import puppeteer from 'puppeteer-core';

// const STARTURL = 'http://localhost:3000/';
const STARTURL = process.argv[-1];

if (!STARTURL.startsWith("http")) {
  console.error("USAGE: run.mjs BASEURL");
  process.exit(1);
}

// Launch the browser and open a new blank page
const browser = await puppeteer.launch();
const page = await browser.newPage();

// Navigate the page to a URL.
await page.goto(STARTURL);

// Set screen size.
await page.setViewport({width: 1080, height: 1024});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

page.on('response', async response => {
  const url = response.url();
  if (!url.startsWith(STARTURL)) return;
  if (!response.ok() && response.status() !== 304) {
    const text = await response.text();
    console.error("========================= ERROR")
    console.error(response.status(), url);
    console.error("Response:\n", text, "-------------------------");
    process.exit(255);
  } else if (url.indexOf("assets") === -1) {
    console.log("\t", response.status(), url);
  }
});

function popRand(array) {
  const randomIndex = Math.floor(Math.random() * array.length);
  return array.splice(randomIndex, 1)[0];
}

const visitedLinks = new Set();
let queuedLinks = [];
let n = 0;
while (true) {
  // Extract anchor tags and their href attributes
  const pageLinks = await page.evaluate(() => {
    const anchors = Array.from(document.getElementsByTagName('a'));
    return anchors.map(anchor => ({
      href: anchor.href,
      text: anchor.textContent
    }))
  });

  const currentLinks = new Set(queuedLinks.map(l => l.href));

  pageLinks.filter(l => {
    return l.href.startsWith(STARTURL);
  }).filter((l) => {
    return !visitedLinks.has(l.href);
  }).forEach(l => {
    if (!currentLinks.has(l.href)) {
      currentLinks.add(l.href);
      queuedLinks.push(l);
    }
  });

  let link;
  if (++n%3 == 0) {
    console.log("Popping random");
    link = popRand(queuedLinks);
  } else if (n%2 == 0) {
    console.log("Popping last");
    link = queuedLinks.pop();
  } else {
    console.log("Popping first");
    link = queuedLinks.shift();
  }
  const url = link.href;
  console.log(url);
  visitedLinks.add(url);
  await page.goto(url);
}

await browser.close();
