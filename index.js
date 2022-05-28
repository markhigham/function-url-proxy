#!/usr/bin/env node

const argv = require("minimist")(process.argv.slice(2));
const path = require("path");
const showHelp = require("./usage");

const debug = require("debug")("function-url-proxy");

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const uuid = require("uuid");

let port = 10808;
let host = "0.0.0.0";

if (argv.h) {
  showHelp();
  process.exit(0);
}

if (argv._.length < 1) {
  // We expect at least test_file
  showHelp();
  process.exit(-1);
}

if (argv.p) {
  port = argv.p;
}

const moduleFilename = argv._[0];
const filename = path.resolve(moduleFilename);
debug(filename);

let handlerName = "handler";
if (argv.f) {
  handlerName = argv.f;
  debug(`handlerName: ${handlerName}`);
}

let handler;

try {
  const module = require(filename);
  debug("handlerName", handlerName);
  handler = module[handlerName];

  if (!handler) {
    console.error(
      `Error: Couldn't find handler function '${handlerName}' in ${filename}`
    );
    process.exit(-1);
  }
} catch (e) {
  console.error(e);
  process.exit(1);
}

if (handler.constructor.name !== "AsyncFunction") {
  console.error(`Expected '${handlerName}' to be an AsyncFunction`.red);
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.all("*", async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(`${req.method} ${req.path}`);
  const u = new URL(fullUrl);

  const packaged = {
    queryStringParameters: req.query,
    headers: req.headers,
    rawQueryString: u.search,
    rawPath: u.pathname,
    requestContext: {
      http: {
        method: req.method,
        path: u.pathname,
      },
      requestId: uuid.v4(),
    },
  };
  debug(`calling ${moduleFilename.replace(".js", "")}.${handlerName}`);
  const result = await handler(packaged);
  res.send(result);
});

app.listen(port, host, () => {
  console.log(`started on http://${host}:${port}`);
});
