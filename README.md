# Site Crawl Tester

This crawls a website and clicks on links, looking for 500 errors.

Run it like this:

```
python run.mjs http://localhost:3000
```

The crawler will crawl until it either hits a 500 error or clicks
every link on the site.
