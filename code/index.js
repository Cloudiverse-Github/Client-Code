const express = require('express')
const app = express()
const port = 8888;

app.get('/', (req, res) => {
  console.log("New request recieved")
  res.send({message: "Hello World!", envs: process.env})
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})