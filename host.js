const http = require('http')
const fs = require('fs')

// Run with "PORT=8081 node host.js" to use a port other than 80
const port = process.env.PORT || 80
const indexFile = 'index.html'

function do404(res)
{
    res.writeHead(404)
    res.end('Not found')
}

 // Read the main page file
fs.readFile(indexFile, (err, data) =>
{
    if (err)
    {
        console.error('[ FAIL ] Error reading', indexFile, ':', err)
        process.exit(1)
    }

    // Respond to requests
    const server = http.createServer((req, res) =>
    {
        console.debug('[  OK  ] Received connection. URL:', req.url)

        if (req.url === '/')
        {
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end(data)
        }
        else
        {
            console.debug('[ WARN ] Error 404:', req.url)
            do404(res)
        }
    })

    // Listen for requests
    server.listen(port, () =>
    {
        console.info('[  OK  ] Server is running on port', port)
    })
})