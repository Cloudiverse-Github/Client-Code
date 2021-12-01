const fs = require('fs-extra')
const fetch = require('node-fetch');
const postUrl = require("./package.json").homepage;
const extract = require('extract-zip')
const child_process = require('child_process');
let pidusage = require('pidusage');

var running = false;
var child

// things to do:
// 1. Fix the error occurs when people redeploy the code (port is in use)
// the reason for this, is when the child is killed, it sometimes doesn't decompose and free up resources
// i added the .kill("SIGKILL") thing, but haven't tested it yet
var log = console.log
var error = console.error
console.log = function(){
    log(arguments)
    var text = "";
    Array.prototype.slice.call(arguments).forEach(arg => {
        if (typeof arg === "object") arg = JSON.stringify(arg);
        text += arg.toString() + " "
    })
    fetch(postUrl, {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            newLog: text,
            time: Date.now()
        })
    }).catch(err => err)
}

console.error = function(){
    error(arguments)
    log("This was an error")
    var text = "";
    Array.prototype.slice.call(arguments).forEach(arg => {
        if (typeof arg === "object") arg = JSON.stringify(arg);
        text += arg.toString() + " "
    })
    fetch(postUrl, {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            newLog: text,
            time: Date.now()
        })
    }).catch(err => err)
}

async function main() {
    var colors = require('colors/safe');

    var ip = await fetch("https://jsonip.com/")
    ip = await ip.json();
    ip = ip.ip;
    console.log("Starting server on " + ip);

    let environmentalVariables = await fetch(postUrl, {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ip: ip,
            query: ["environmentalVariables", "runCmd"]
        })
    })
    environmentalVariables = await environmentalVariables.json();
    // installing dependencies
    child_process.execSync("npm --prefix ./code install")
    // running client code
    if ((environmentalVariables.query.runCmd || "npm run start").includes("../")) {
        fetch(postUrl, {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                newErr: "Run command includes ('../'). This is not allowed!",
                time: Date.now()
            })
        }).catch(err => err)
    }else{

        child = child_process.exec(`cd code; ${environmentalVariables.query.runCmd || "npm run start"}`, {
            env: environmentalVariables.query.environmentalVariables
        });
        running = true;
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
        child.on('close', async (code) => {
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
    }
    postData();
    async function postData() {
        while (true) {
            try {
                let currentResources = {
                    cpu: 0,
                    memory: 0
                }
                if (child.pid && running === true) {
                    currentResources = await pidusage(child.pid);
                    console.log(currentResources)
                }
                let dataRes = await fetch(postUrl, {
                    method: "POST",
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        online: running,
                        resources: currentResources
                    })
                }).catch(err => console.log(err))
                let json = await dataRes.json();
                if (json.status === "new-code") {
                    fetch(postUrl, {
                        method: "POST",
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            docAction: "recieved-new-code",
                            time: Date.now()
                        })
                    }).catch(err => err)
                    console.log("Remote has changes! Fetching changes...")
                    console.log(`Downloading file at: ${postUrl.slice(0, -129)}/cdn/servers/${postUrl.slice(-109)}.zip`)
                    try {
                        fs.unlinkSync("./temp.zip")
                    } catch (err) { }

                    await downloadFile(`${postUrl.slice(0, -129)}/cdn/servers/${postUrl.slice(-109)}.zip`, __dirname + "/temp.zip")
                    console.log("Download complete")
                    if (running === true) {
                        child.kill("SIGKILL");
                    }
                    console.log("Deleting old code...")
                    fs.rmdirSync("./code", { recursive: true });
                    console.log("Extracting files...")
                    await extract("./temp.zip", { dir: __dirname + "/temp-extracted" });
                    let directory = fs.readdirSync("./temp-extracted/");
                    fs.moveSync("./temp-extracted/"+directory[0], "./code", function (err) {
                        if (err) {                 
                          console.error(err);      
                        } else {
                          console.log("Moved folders successfully!");
                        }
                      });
                    if (running === true) {
                        child.kill("SIGKILL");
                    }
                    return restartProcess();
                } else {
                    await sleep(60000)
                }
            }catch(err){
                console.log("We had trouble posting to the cloudiverse servers! Please check your internet connection. Processes will continue running. \n Full error string: "+err.toString())
            }
        }
    }
}






main();
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function restartProcess() {
    if (running === true) {
        child.kill("SIGKILL");
    }
    try{
        child_process.execSync("lsof -i :8888 -sTCP:LISTEN |awk 'NR > 1 {print $2}'  |xargs kill -15")
    }catch(err){
        
    }

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