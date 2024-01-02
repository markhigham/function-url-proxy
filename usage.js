function showHelp() {
  const pkg = require('./package.json')
  const version = pkg.version
  console.log(`function-url-proxy [-f handler] test_file
  version: ${version}
  
  test_file.js (required)
      Path to a file containing the lambda handler
  
  -f (optional) Name of the handler function. Defaults to handler
  
  -p (optional) Port number. Defaults to 3000
  
      `)
}

module.exports = showHelp
