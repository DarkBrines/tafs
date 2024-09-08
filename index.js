const { statSync, existsSync, createReadStream, readdirSync } = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { isReadable } = require('node:stream');

const serving_path = process.env.SERVING_PATH ?? path.join(__dirname, "www")
const token = process.env.ACCESS_TOKEN ?? (() => { throw new Error("No access token was provided") })()

function getSafePath(unsafe_path) {
    const relative_path = path.resolve("/", unsafe_path).slice(1);

    return path.join(serving_path, relative_path)
}

function sendFileToHTTP(p, res, fstat) {
    res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': fstat.size,
    })

    const rs = createReadStream(p)
    rs.pipe(res)

    rs.on('error', (err) => {
        res.writeHead(500, {
            'Content-Type': 'text/plain',
        })
        res.end(err)
    })

    rs.on('close', () => {
        res.end()
    })
}

function sendIndexToHTTP(p, res) {
    const entries = readdirSync(p)

    res.writeHead(200, {
        'Content-Type': 'text/csv'
    })

    res.write("type,name,last_modified\r\n")

    for (const entry of entries) {
        const filestat = statSync(path.join(p, entry))
        let filetype

        if (filestat.isDirectory()) {
            filetype = "d"
        } else if (filestat.isFile()) {
            filetype = "f"
        } else {
            filetype = "?"
        }

        const filedate = filestat.ctime.getTime().toString()

        res.write(`${filetype},${entry},${filedate}\r\n`)
    }

    res.end()
}

const server = http.createServer((req, res) => {
    // Check key
    const auth_header = req.headers.authorization || ""
    if (auth_header.trim() != "Bearer " + token) {
        console.warn("Unauthorized connection received, aiming " + req.url)

        res.writeHead(403, "Unauthorized")
        res.end()
        return
    }

    // Get wanted path
    const unsafe_path = new URL(req.url, 'http://notimportant/').pathname
    const p = getSafePath(unsafe_path)

    console.log(`Accessed resource '${p}' using '${unsafe_path}'`)

    if (!existsSync(p)) {
        console.log(`Resource '${p} does not exist.'`)
        res.writeHead(404, "Not Found")
        res.end()
        return
    }

    const filestat = statSync(p)

    if (filestat.isFile()) {
        // Sends file
        sendFileToHTTP(p, res, filestat)
    } else if (filestat.isDirectory()) {
        // Sends directory index
        sendIndexToHTTP(p, res)
    } else {
        res.writeHead(400, "Not a file or directory")
        res.end()
    }
});

server.on('clientError', (err, socket) => {
    socket.end('HTTP 400 Bad Request\r\n\r\n');
});

server.on('listening', () => {
    console.log("Server listening...")
})

server.listen(process.env.PORT ?? 8000);