const http = require('http')
const fs = require('fs')

// Run with "PORT=8081 node host.js" to use a port other than 80
const port = process.env.PORT || 80
const indexFile = 'index.html'
const error404File = '404.html'
var error404Response
const iconFile = "MonkeyHead.ico"
var icon
var visitorCount = 0

console.debug('[  OK  ] Starting server...')

fs.readFile(error404File, (err, data) =>
{
    if (err)
        console.error('[ FAIL ] Error reading 404 file:', err)
    else
        error404Response = data
})

fs.readFile(iconFile, (err, data) =>
{
    if (err)
        console.error('[ FAIL ] Error reading icon file:', err)
    else
        icon = data
})

function do404(res)
{
    res.writeHead(404, { 'Content-Type': 'text/html' })

    if (error404Response == null)
        res.end('Not found')
    else
        res.end(error404Response)
}


function getRandomImage()
{
    return new Promise((resolve, reject) =>
    {
        fs.readdir('./images', (err, files) =>
        {
            if (err)
            {
                console.error('[ FAIL ] Error reading images directory:', err)
                return reject('Unable to read image directory.')
            }
            else if (files.length == 0)
            {
                console.error('[ FAIL ] No image files found.')
                return reject('No image files found.')
            }
            else
            {
                const randFile = files[Math.floor(Math.random() * files.length)]

                fs.readFile('./images/' + randFile, (err, data) =>
                {
                    if (err)
                    {
                        console.error('[ FAIL ] Error reading image:', err)
                        return reject('Unable to read image.')
                    }
                    else
                        resolve(data)
                })
            }
        })
    })
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

function getData(req)
{
    return new Promise((resolve, reject) =>
    {
        const baseFileName = req.url.substring(10, req.url.length - 5)

        if (baseFileName.length <= 0 || baseFileName.length > 4)
            return reject('Invalid file name length')

        const imageNum = parseFloat(baseFileName)

        if (isNaN(imageNum) || imageNum < 0 || imageNum > 4999)
            return reject('Invalid data file number')

        const filePath = './metadata/' + baseFileName + '.json'

        fs.access(filePath, fs.constants.R_OK, (err) =>
        {
            if (err)
                reject('Unable to access data file ' + filePath)
            else
            {
                fs.readFile(filePath, (err, data) =>
                {
                    if (err)
                        reject('Unable to read data file ' + filePath)
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
        console.debug('[  OK  ] Remote address of connection:', req.socket.remoteAddress)
        visitorCount++
        console.debug('[  OK  ] Visitor number:', visitorCount)

        if (req.url === '/')
        {
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end(data)
        }
        else if (req.url === '/monkeys/random.png')
        {
            getRandomImage().then((data) =>
            {
                res.writeHead(200, { 'Content-Type': 'image/png' })
                res.end(data)
            })
            .catch((err) =>
            {
                console.error('[ FAIL ] Error getting random image:', err)
                console.debug('[ WARN ] Error 404:', req.url)
                do404(res)
            })
        }
        else if (req.url === '/favicon.ico')
        {
            if (icon == null)
            {
                console.error('[ FAIL ] Icon image not loaded.')
                console.debug('[ WARN ] Error 404:', req.url)
                do404(res)
            }
            else
            {
                res.writeHead(200, { 'Content-Type': 'image/x-icon' })
                res.end(icon)
            }
        }
        else if (req.url.startsWith('/monkeys/') && req.url.endsWith('.png'))
        {
            getImage(req).then((data) =>
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
        else if (req.url.startsWith('/metadata/') && req.url.endsWith('.json'))
        {
            getData(req).then((data) =>
            {
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(data)
            }).catch((err) =>
            {
                console.debug('[ WARN ] Error getting data at', req.url, ':', err)
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