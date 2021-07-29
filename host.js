const http = require('http')
const fs = require('fs')

// Run with "PORT=8081 node host.js" to use a port other than 80
const port = process.env.PORT || 80
const indexFile = 'index.html'
const error404File = '404.html'
var error404Response

fs.readFile(error404File, (err, data) =>
{
    if (err)
        console.error('[ FAIL ] Error reading 404 file:', err)
    else
        error404Response = data
})

function do404(res)
{
    res.writeHead(404, { 'Content-Type': 'text/html' })

    if (error404Response == null)
        res.end('Not found')
    else
        res.end(error404Response)
}

function getImage(req)
{
    return new Promise((resolve, reject) =>
    {
        const baseFileName = req.url.substring(9, req.url.length - 4)

        if (baseFileName.length <= 0 || baseFileName.length > 4)
            return reject('Invalid file name length')

        const imageNum = parseFloat(baseFileName)

        if (isNaN(imageNum) || imageNum < 0 || imageNum > 4999)
            return reject('Invalid image number')

        const filePath = './images/' + baseFileName + '.png'

        fs.access(filePath, fs.constants.R_OK, (err) =>
        {
            if (err)
                reject('Unable to access image ' + filePath)
            else
            {
                fs.readFile(filePath, (err, data) =>
                {
                    if (err)
                        reject('Unable to read image ' + filePath)
                    else
                        resolve(data)
                })
            }
        })
    })
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
        else if (req.url.startsWith('/monkeys/') && req.url.endsWith('.png'))
        {
            getImage(req, res).then((data) =>
            {
                res.writeHead(200, { 'Content-Type': 'image/png' })
                res.end(data)
            }).catch((err) =>
            {
                console.debug('[ WARN ] Error getting image at', req.url, ':', err)
                console.debug('[ WARN ] Error 404:', req.url)
                do404(res)
            })
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