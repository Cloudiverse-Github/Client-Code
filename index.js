async function main() {
    const fs = require("file-system")
    const fetch = require('node-fetch');
    const postUrl = require("./package.json").homepage;
    const extract = require('extract-zip')
    var runCmd = require("./code/package.json").scripts.start;
    const { execFile } = require('child_process');
    var colors = require('colors/safe');
    var runFile = runCmd.slice(5)
    var running = true;

    var ip = await fetch("https://jsonip.com/")
    ip = await ip.json();
    ip = ip.ip;
    console.log("Starting server on " + ip);
    fetch(postUrl, {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ip: ip
        })
    }).catch(err => err)

    const child = execFile('node', [`./code/${runFile}`], (error, stdout, stderr) => {
        if (error) {
            throw error;
        }
    });
    child.stdout.on('data', (data) => {
        console.log(colors.blue(data));
        fetch(postUrl, {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                newLog: data,
                time: Date.now()
            })
        }).catch(err => err)
    });
    child.stderr.on('data', (data) => {
        console.log(colors.red(data));
        fetch(postUrl, {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                newErr: data,
                time: Date.now()
            })
        }).catch(err => err)
    });
    child.on('close', (code) => {
        running = false;
        fetch(postUrl, {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                stopCode: code
            })
        }).catch(err => err)
        console.log(colors.bold.red(`Child process exited with code ${code}`));
    });

    postData();
    async function postData() {
        while (true) {
            console.log(postUrl)
            if (running === false) return;
            let dataRes = await fetch(postUrl, {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    online: true
                })
            }).catch(err => err)
            console.log(dataRes)
            let json = await dataRes.json();
            if (json.newCode) {
                console.log("Remote has changes! Fetching changes...")

                try {
                    fs.unlinkSync("./temp.zip")
                } catch (err) { }

                await downloadFile(json.newCode, __dirname + "/temp.zip")
                if (running === true) {
                    child.kill();
                }
                fs.rmdirSync("./code", { recursive: true });
                console.log("Extracting files...")
                await extract("./temp.zip", { dir: __dirname + "/code" });
                if (running === true) {
                    child.kill();
                }
                return restartProcess();
            } else {
                await sleep(60000)
            }
        }
    }
}






main();
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function restartProcess() {
    console.log("Restarting process due to code changes...")
    await sleep(1000)
    main();
}
const downloadFile = (async (url, path) => {
    const res = await fetch(url);
    const fileStream = fs.createWriteStream(path);
    await new Promise((resolve, reject) => {
        res.body.pipe(fileStream);
        res.body.on("error", reject);
        fileStream.on("finish", resolve);
    });
});


// FLOW CHART
/*

first, when "main" runs, starts up postData()

Then, postData does the normal sending online status messages
If server returns a message saying to update code, 

Starts downloading, unlinking, extracting the files, and killing the process.
Lastly, restarts the function "main"


*/