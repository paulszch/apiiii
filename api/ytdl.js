const yt = {
    url: Object.freeze({
        audio128: 'https://api.apiapi.lat',
        video: 'https://api5.apiapi.lat',
        else: 'https://api3.apiapi.lat',
        referrer: 'https://ogmp3.pro/'
    }),

    encUrl: (string) => string.split('').map(c => c.charCodeAt()).reverse().join(';'),
    xor: (string) => string.split('').map(s => String.fromCharCode(s.charCodeAt() ^ 1)).join(''),
    genRandomHex: () => {
        const hex = '0123456789abcdef'.split('')
        return Array.from({ length: 32 }, _ => hex[Math.floor(Math.random() * hex.length)]).join('')
    },

    init: async function (rpObj) {
        const { apiOrigin, payload } = rpObj
        const { data } = payload
        const api = apiOrigin + '/' + this.genRandomHex() + '/init/' + this.encUrl(this.xor(data)) + '/' + this.genRandomHex() + '/'
        let resp = await fetch(api, {
            method: 'post',
            body: JSON.stringify(payload)
        })
        if (!resp.ok) throw Error(`${resp.status} ${resp.statusText}\n${await resp.text()}`)
        const json = await resp.json()
        return json
    },

    genFileUrl: function (i, pk, rpObj) {
        const { apiOrigin } = rpObj
        const pk_value = pk ? pk + "/" : "";
        const downloadUrl = apiOrigin + "/" + this.genRandomHex() + "/download/" + i + "/" + this.genRandomHex() + "/" + pk_value;
        const result = { downloadUrl }
        return result
    },

    statusCheck: async function (i, pk, rpObj) {
        const { apiOrigin } = rpObj
        let json = {}
        let attempts = 0
        const maxAttempts = 20
        
        do {
            await new Promise(resolve => setTimeout(resolve, 5000))
            const pk_value = pk ? pk + '/' : ''
            let api = apiOrigin + '/' + this.genRandomHex() + '/status/' + i + '/' + this.genRandomHex() + '/' + pk_value
            const resp = await fetch(api, {
                method: 'post',
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ data: i })
            })
            if (!resp.ok) throw Error(`${resp.status} ${resp.statusText}\n${await resp.text()}`)
            json = await resp.json()
            attempts++
            
            if (attempts >= maxAttempts) {
                throw Error('Timeout: Processing took too long')
            }
        } while (json.s === "P")
        
        if (json.s === "E") throw Error('Processing failed: ' + JSON.stringify(json, null, 2))
        return this.genFileUrl(i, pk, rpObj)
    },

    download: async function (ytUrl, userFormat = '128k') {
        const rpObj = this.resolvePayload(ytUrl, userFormat)
        const initObj = await this.init(rpObj)
        const { i, pk, s } = initObj
        let result = { userFormat, taskId: i }
        if (s === 'C') {
            const wolep = this.genFileUrl(i, pk, rpObj)
            Object.assign(result, wolep)
        } else {
            const wolep = await this.statusCheck(i, pk, rpObj)
            Object.assign(result, wolep)
        }
        return result
    },

    resolvePayload: function (ytUrl, userFormat) {
        const validFormat = ['64k', '96k', '128k', '192k', '256k', '320k', '240p', '360p', '480p', '720p', '1080p']
        if (!validFormat.includes(userFormat)) {
            throw Error(`Invalid format. Available: ${validFormat.join(', ')}`)
        }
        if (typeof (ytUrl) !== "string" || !ytUrl.trim().length) {
            throw Error('YouTube URL is required')
        }

        let apiOrigin = this.url.audio128
        let data = this.xor(ytUrl)
        let referer = this.url.referrer
        let format = '0'
        let mp3Quality = '128'
        let mp4Quality = '720'

        if (userFormat === validFormat[2]) {
            apiOrigin = this.url.audio128
        } else if (/^\d+p$/.test(userFormat)) {
            apiOrigin = this.url.video
            mp4Quality = userFormat.match(/\d+/g)[0]
            format = '1'
        } else {
            apiOrigin = this.url.else
            mp3Quality = userFormat.match(/\d+/g)[0]
        }
        
        const payload = {
            data,
            format,
            referer,
            mp3Quality,
            mp4Quality,
            "userTimeZone": "-480"
        }
        return { apiOrigin, payload }
    }
}

// Vercel Serverless Function Handler
module.exports = async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end()
    }

    try {
        const { url, formats } = req.method === 'POST' ? req.body : req.query
        
        if (!url) {
            return res.status(400).json({ 
                error: 'URL parameter is required',
                usage: '/api/download?url=YOUTUBE_URL&formats=360p,128k'
            })
        }

        // Parse multiple formats
        const formatList = formats 
            ? formats.split(',').map(f => f.trim()).filter(f => f)
            : ['128k']

        // Download all formats
        const results = await Promise.all(
            formatList.map(format => yt.download(url, format))
        )

        res.status(200).json({
            success: true,
            url: url,
            results: results
        })

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        })
    }
}