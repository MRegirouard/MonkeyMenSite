const http = require('http')
const fs = require('fs')
const { PSDB } = require('planetscale-node')

// Run with "PORT=8081 node host.js" to use a port other than 80
const port = process.env.PORT || 80
const indexFile = 'index.html'
const error404File = '404.html'
var error404Response
const iconFile = "MonkeyHead.ico"
var icon
var currentNewVisitCount = 0 // Number of unique visits in the last minute
var currentVisitCount = 0 // Number of total visits in the last minute

var addressCache = [] // A cache of {addresses, visits, lastVisit} objects to avoid querying the database too often
// These are pushed every minute, and the visits counter is reset for each address
// If a visit is made to an address more than once in a minute (highly likely), we only have to update the database once
// If more than 1 minute has gone by since the last visit, drop the entry from the cache to avoid memory issues

console.debug('[  OK  ] Starting server...')

var data

try
{
    data = new PSDB('main')
}
catch (error)
{
    console.error('[ FAIL ] Could not connect to PlanetScale database:', error)
}

setInterval(() => // Every 60 seconds, update the number of unique visits (if there are any) and push to the database
{
    console.debug('[  OK  ] Running database updates...')

    pushToDatabase().catch(error => console.error('[ FAIL ] Error pushing cache to database:', error)).then(() =>
    {
        if (currentNewVisitCount > 0 || currentVisitCount > 0)
        {
            const date = new Date()
            var dateStr = date.toISOString()
            dateStr = dateStr.substr(0, dateStr.length - 5)
            dateStr = dateStr.replace(/T/g, ' ')

            data.execute('INSERT INTO visits VALUES ( \"' + dateStr + '\", ' + currentNewVisitCount + ', ' + currentVisitCount + ');')
                .catch(error => console.error('[ FAIL ] Error updating visit database:', error))

            currentNewVisitCount = 0
            currentVisitCount = 0
        }

        console.info('[  OK  ] Database updates complete.')
    }).catch(error => console.error('[ FAIL ] Error pushing to visits database:', error))

}, 3 * 60 * 1000)

function pushToDatabase()
{
    return new Promise((resolve, reject) =>
    {
        const waitingFor = [] // Hold database promises

        const dropThreshold = new Date(Date.now() - 1000 * 60) // If a cache entry's last visit is more than a minute ago, it will be dropped

        addressCache.forEach((address) =>
        {
            if (address.visits > 0) // Update the database if there are new visits
            {

                // Insert a new visitor entry, or update an existing one if it already exists
                var executeStr = `INSERT INTO visitors (address, visits) VALUES ( \"${address.address}\", ${address.visits} ) `
                executeStr += `ON DUPLICATE KEY UPDATE visits = visits + ${address.visits};`

                waitingFor.push(data.execute(executeStr).then((result) => 
                {
                    if (result[0].affectedRows === 1) // The "affectedRows" will be 1 if the entry is new, 2 if it already exists
                    {
                        currentNewVisitCount++
                        console.debug('[  OK  ] New visitor detected! Address', address.address)
                    }

                    address.visits = 0
                }))
            }

            if (address.lastVisit < dropThreshold)
                addressCache.splice(addressCache.indexOf(address, 1)) // Drop the entry if it's too old to free some memory
        })

        Promise.all(waitingFor).then(resolve).catch(reject) // Wait for all the database updates to finish
    })
}

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

function handleVisit(address)
{
    currentVisitCount++

    const thisCacheAddress = addressCache.filter(item => item.address === address)

    if (thisCacheAddress.length > 0) // We have a locally stored cached address, use this instead of querying the database
    {
        thisCacheAddress[0].visits++
        thisCacheAddress[0].lastVisit = new Date()
    }
    else // This address doesn't exist in the cache, create it
        addressCache.push({ address: address, visits: 1, lastVisit: new Date() })
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

        handleVisit(req.socket.remoteAddress)

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
