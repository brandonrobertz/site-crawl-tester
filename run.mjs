import puppeteer from 'puppeteer'; // or import puppeteer from 'puppeteer-core';
import readline from 'readline';

// const STARTURL = 'http://localhost:3000/';
const STARTURL = process.argv[process.argv.length - 1];

if (!STARTURL.startsWith("http")) {
  console.error("USAGE: run.mjs BASEURL");
  process.exit(1);
}

console.log("STARTURL", STARTURL);
// TODO: Get this from STARTURL
// const FILTERURL = "https://projects.propublica.org/rx-inspector/"; // "https://stg-projects-cf.propublica.org/";
// const FILTERURL = "http://localhost:5173/trump-team-financial-disclosures/";
const FILTERURL = getFilterUrl(STARTURL);
console.log("FILTERURL", FILTERURL);

// Launch the browser and open a new blank page
const browser = await puppeteer.launch({headless: false});
const page = await browser.newPage();

// Navigate the page to a URL.
await page.goto(STARTURL);

// Set screen size.
await page.setViewport({width: 1080, height: 1024});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Builds a filter URL to get additonal URLs to test. This gets
 * applied to all URLs we find, by checking for startsWith against it.
 * This will return the input domain and the first part of the
 * path, if one is given.
 *
 * Examples:
 * Input: https://projects.propublica.org/trump-team-financial-disclosures/appointees/
 * Output: https://projects.propublica.org/trump-team-financial-disclosures/
 *
 * Input: https://projects.propublica.org/
 * Output: https://projects.propublica.org/
 *
 * Input: http://localhost:5173
 * Output: http://localhost:5173/
 */
function getFilterUrl(urlString) {
  const url = new URL(urlString);

  // If there is no path (or only a single slash) we return the whole origin.
  if (!url.pathname || url.pathname === '/') {
    return url.origin;
  }

  // Grab the first non‑empty segment of the path.
  const firstSegment = url.pathname.split('/').filter(Boolean)[0];

  // Build the result: scheme + host + first segment + trailing slash.
  return `${url.origin}/${firstSegment}/`;
}

// Create a new readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to pause the application
function pauseApplication() {
  console.log("Press Enter to continue...");
  return new Promise((resolve) => {
    rl.question('', (answer) => {
      resolve(answer);
    });
  });
}

function logError(obj, filename) {
  // Convert the object to a JSON string
  const jsonString = JSON.stringify(obj);

  // Write the JSON string to the output file
  fs.appendFile(filename, jsonString + '\n', (err) => {
    if (err) {
      console.error(`Error writing to file: ${err}`);
    } else {
      console.log(`Object written to file successfully`);
    }
  });
}

page.on('response', async (response) => {
  const url = response.url();
  if (url.indexOf("/assets") > -1 || url.indexOf("/static") > -1) return;
  if (url.indexOf("_app/immutable") > -1) return;
  if (!url.startsWith(FILTERURL)) return;
  console.log(response.status(), response.url());
  if ([500, 501, 502, 503, 504].indexOf(response.status()) >= 0) {
    const text = await response.text();
    console.error("========================= ERROR")
    console.error(response.status(), url);
    console.error("Response:\n", text, "-------------------------");
    logError({
      datetime: new Date(),
      status: response.status(),
      url: url,
      body: text
    }, "errors.log");
    await pauseApplication();
    // process.exit(255);
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
      href: anchor.href.replace(/#.+$/, ""),
      text: anchor.textContent
    })).filter(x => x.href);
  });

  const currentLinks = new Set(queuedLinks.map(l => l.href));

  pageLinks.filter(l => {
    return l.href.startsWith(FILTERURL) || l.href.startsWith("/");
  }).filter((l) => {
    return !visitedLinks.has(l.href);
  }).forEach(l => {
    if (!currentLinks.has(l.href)) {
      currentLinks.add(l.href);
      queuedLinks.push(l);
    }
  });

  let link;
  let sgn;
  if (++n%3 == 0) {
    link = popRand(queuedLinks);
    sgn = "~";
  } else if (n%2 == 0) {
    link = queuedLinks.pop();
    sgn = "-";
  } else {
    link = queuedLinks.shift();
    sgn = "+";
  }
  if (!link) {
    console.log("Complete!");
    process.exit(0);
  }
  const url = link.href;
  console.log(" ", sgn, url);
  visitedLinks.add(url);

  // avoid tab crashing from extended operations that leak memory
  if (Math.random() < 0.1) await page.reload();

  await page.goto(url);
}

await browser.close();
